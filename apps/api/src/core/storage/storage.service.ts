import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Client as MinioClient } from 'minio';
import { GoogleDriveStorageProvider } from './google-drive-storage.provider';

/**
 * S3-compatible object storage (MinIO). Browsers use short-lived signed API
 * URLs; the API streams objects to and from MinIO over the private network.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: MinioClient;
  private readonly bucket = process.env.MINIO_BUCKET ?? 'nexus-files';

  constructor(private readonly googleDrive: GoogleDriveStorageProvider) {
    this.client = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ROOT_USER ?? 'minioadmin',
      secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'minioadmin',
    });
  }

  async onModuleInit() {
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        (async () => {
          const bucketExists = await this.client.bucketExists(this.bucket);
          if (!bucketExists) {
            await this.client.makeBucket(this.bucket);
            this.logger.log(`Created bucket "${this.bucket}"`);
          }
        })(),
        new Promise<void>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('MinIO bucket check timed out')), 3000);
          timeout.unref();
        }),
      ]);
    } catch (err) {
      // Don't crash boot if MinIO is briefly unavailable; log and continue.
      this.logger.warn(`Could not verify bucket "${this.bucket}": ${(err as Error).message}`);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  /**
   * Build a unique object key under a logical folder, preserving the extension.
   * e.g. presignedKey('employees/abc/documents', 'ktp.pdf') -> 'employees/abc/documents/<uuid>.pdf'
   */
  buildKey(folder: string, originalName: string) {
    const ext = originalName.includes('.') ? `.${originalName.split('.').pop()}` : '';
    return `${folder}/${randomUUID()}${ext}`;
  }

  /** Short-lived signed API URL used by the browser to upload an object. */
  async presignedUpload(key: string, expirySeconds = 300) {
    try {
      const url = this.signedProxyUrl('upload', 'PUT', key, expirySeconds);
      return { url, key, expiresIn: expirySeconds };
    } catch (err) {
      throw new InternalServerErrorException(`Storage error: ${(err as Error).message}`);
    }
  }

  /** Presigned GET URL for downloading/viewing a stored object. */
  async presignedDownload(key: string, expirySeconds = 300) {
    return this.signedProxyUrl('download', 'GET', key, expirySeconds);
  }

  async getObjectForDownload(key: string) {
    if (await this.googleDrive.isConfigured()) {
      const driveObject = await this.googleDrive.getObject(key);
      if (driveObject) return driveObject;
    }

    const [metadata, stream] = await Promise.all([
      this.client.statObject(this.bucket, key),
      this.client.getObject(this.bucket, key),
    ]);
    return {
      stream,
      size: metadata.size,
      contentType: String(metadata.metaData['content-type'] ?? 'application/octet-stream'),
    };
  }

  verifySignedRequest(method: 'GET' | 'PUT', key: string, expires: string, signature: string) {
    const expiresAt = Number(expires);
    if (!key || !Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
      throw new ForbiddenException('Storage URL is invalid or expired');
    }

    const expected = Buffer.from(this.sign(method, key, expiresAt), 'hex');
    const received = /^[a-f\d]{64}$/i.test(signature) ? Buffer.from(signature, 'hex') : Buffer.alloc(0);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new ForbiddenException('Storage URL is invalid or expired');
    }
  }

  async putObjectStream(key: string, stream: Readable, size: number | undefined, contentType: string) {
    if (await this.usesGoogleDrive()) {
      await this.googleDrive.putObjectStream(key, stream, size, contentType);
      return;
    }
    await this.client.putObject(this.bucket, key, stream, size, { 'Content-Type': contentType });
  }

  /** Server-side upload of an in-memory buffer (e.g. a base64 audit photo). */
  async putObject(folder: string, fileName: string, body: Buffer, contentType = 'application/octet-stream') {
    const key = this.buildKey(folder, fileName);
    await this.putObjectStream(key, Readable.from(body), body.length, contentType);
    return key;
  }

  /** Decode a (possibly data-URI) base64 image and store it; returns the object key. */
  async putBase64Image(folder: string, dataUrl: string) {
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const buffer = Buffer.from(base64, 'base64');
    return this.putObject(folder, `${Date.now()}.jpg`, buffer, 'image/jpeg');
  }

  async remove(key: string) {
    if (await this.googleDrive.isConfigured()) {
      try {
        await this.googleDrive.deleteObject(key);
      } catch (err) {
        this.logger.warn(`Failed to delete Google Drive object "${key}": ${(err as Error).message}`);
      }
    }
    try {
      await this.client.removeObject(this.bucket, key);
    } catch (err) {
      this.logger.warn(`Failed to delete object "${key}": ${(err as Error).message}`);
    }
  }

  private async usesGoogleDrive() {
    return this.googleDrive.isSelected();
  }

  async migrateMinioToGoogleDrive(options: { dryRun?: boolean; deleteMinio?: boolean } = {}) {
    const dryRun = options.dryRun ?? true;
    if (!(await this.googleDrive.isConfigured())) {
      throw new InternalServerErrorException('Configure Google Drive before migrating MinIO objects');
    }

    const objects = await new Promise<Array<{ name: string; size?: number }>>((resolve, reject) => {
      const found: Array<{ name: string; size?: number }> = [];
      const listing = this.client.listObjectsV2(this.bucket, '', true);
      listing.on('data', (object) => {
        if (object.name) found.push({ name: object.name, size: object.size });
      });
      listing.once('error', reject);
      listing.once('end', () => resolve(found));
    });

    const report = {
      dryRun,
      scanned: objects.length,
      bytesScanned: objects.reduce((total, object) => total + Number(object.size ?? 0), 0),
      migrated: 0,
      alreadyPresent: 0,
      deletedFromMinio: 0,
      failures: [] as Array<{ key: string; message: string }>,
    };
    if (dryRun) return report;

    for (const object of objects) {
      const key = object.name;
      try {
        const metadata = await this.client.statObject(this.bucket, key);
        const contentType = String(metadata.metaData['content-type'] ?? 'application/octet-stream');
        const sourceHash = await this.hashReadableStream(await this.client.getObject(this.bucket, key));
        let remote = await this.googleDrive.getObject(key);
        let alreadyPresent = false;

        if (remote) {
          const remoteHash = await this.hashReadableStream(remote.stream);
          alreadyPresent = remote.size === metadata.size && remoteHash === sourceHash;
        }

        if (!alreadyPresent) {
          const source = await this.client.getObject(this.bucket, key);
          const uploadHash = createHash('sha256');
          const hashingStream = new Transform({
            transform(chunk: Buffer, _encoding, callback) {
              uploadHash.update(chunk);
              callback(null, chunk);
            },
          });
          const streamPipeline = pipeline(source, hashingStream);
          try {
            await Promise.all([
              this.googleDrive.putObjectStream(key, hashingStream, metadata.size, contentType),
              streamPipeline,
            ]);
          } catch (error) {
            source.destroy();
            hashingStream.destroy();
            await streamPipeline.catch(() => undefined);
            throw error;
          }
          if (uploadHash.digest('hex') !== sourceHash) {
            throw new Error('Source changed while it was being copied');
          }

          remote = await this.googleDrive.getObject(key);
          if (!remote) throw new Error('Drive file could not be found after upload');
          const verifiedHash = await this.hashReadableStream(remote.stream);
          if (remote.size !== metadata.size || verifiedHash !== sourceHash) {
            throw new Error('Google Drive verification failed; MinIO copy was kept');
          }
          report.migrated += 1;
        } else {
          report.alreadyPresent += 1;
        }

        if (options.deleteMinio) {
          await this.client.removeObject(this.bucket, key);
          report.deletedFromMinio += 1;
        }
      } catch (error) {
        report.failures.push({ key, message: (error as Error).message });
      }
    }

    return report;
  }

  private async hashReadableStream(stream: Readable) {
    const hash = createHash('sha256');
    for await (const chunk of stream) hash.update(chunk as Buffer);
    return hash.digest('hex');
  }

  private signedProxyUrl(path: 'upload' | 'download', method: 'GET' | 'PUT', key: string, expirySeconds: number) {
    const expiresAt = Math.floor(Date.now() / 1000) + expirySeconds;
    const baseUrl = process.env.NODE_ENV === 'production'
      ? process.env.API_URL
      : `http://localhost:${process.env.API_PORT ?? 4100}`;
    if (!baseUrl) throw new InternalServerErrorException('API_URL is required for storage links');

    const url = new URL(`/api/v1/storage/${path}`, baseUrl);
    url.searchParams.set('key', key);
    url.searchParams.set('expires', String(expiresAt));
    url.searchParams.set('signature', this.sign(method, key, expiresAt));
    return url.toString();
  }

  private sign(method: 'GET' | 'PUT', key: string, expiresAt: number) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new InternalServerErrorException('JWT_ACCESS_SECRET is required for storage links');
    return createHmac('sha256', secret)
      .update(`${method}\n${this.bucket}\n${key}\n${expiresAt}`)
      .digest('hex');
  }
}
