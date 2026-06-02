import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Client as MinioClient } from 'minio';

/**
 * S3-compatible object storage (MinIO). Uses presigned URLs so the browser
 * uploads/downloads directly, keeping large files out of the API process.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: MinioClient;
  private readonly bucket = process.env.MINIO_BUCKET ?? 'nexus-files';

  constructor() {
    this.client = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ROOT_USER ?? 'minioadmin',
      secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'minioadmin',
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created bucket "${this.bucket}"`);
      }
    } catch (err) {
      // Don't crash boot if MinIO is briefly unavailable; log and continue.
      this.logger.warn(`Could not verify bucket "${this.bucket}": ${(err as Error).message}`);
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

  /** Presigned PUT URL the browser uses to upload a file directly to MinIO. */
  async presignedUpload(key: string, expirySeconds = 300) {
    try {
      const url = await this.client.presignedPutObject(this.bucket, key, expirySeconds);
      return { url, key, expiresIn: expirySeconds };
    } catch (err) {
      throw new InternalServerErrorException(`Storage error: ${(err as Error).message}`);
    }
  }

  /** Presigned GET URL for downloading/viewing a stored object. */
  async presignedDownload(key: string, expirySeconds = 300) {
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  /** Server-side upload of an in-memory buffer (e.g. a base64 audit photo). */
  async putObject(folder: string, fileName: string, body: Buffer, contentType = 'application/octet-stream') {
    const key = this.buildKey(folder, fileName);
    await this.client.putObject(this.bucket, key, body, body.length, { 'Content-Type': contentType });
    return key;
  }

  /** Decode a (possibly data-URI) base64 image and store it; returns the object key. */
  async putBase64Image(folder: string, dataUrl: string) {
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const buffer = Buffer.from(base64, 'base64');
    return this.putObject(folder, `${Date.now()}.jpg`, buffer, 'image/jpeg');
  }

  async remove(key: string) {
    try {
      await this.client.removeObject(this.bucket, key);
    } catch (err) {
      this.logger.warn(`Failed to delete object "${key}": ${(err as Error).message}`);
    }
  }
}
