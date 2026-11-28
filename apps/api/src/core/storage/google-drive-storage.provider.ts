import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { google, type drive_v3 } from 'googleapis';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';

export interface GoogleDriveStoredObject {
  stream: Readable;
  size: number;
  contentType: string;
}

type DriveConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  email?: string;
  folderId: string;
  fingerprint: string;
};

@Injectable()
export class GoogleDriveStorageProvider {
  private driveClient?: { fingerprint: string; drive: drive_v3.Drive };

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async createOAuthAuthorizationUrl(state: string) {
    const [setting] = await this.prisma.$queryRaw<Array<{
      googleDriveOAuthClientId: string | null;
      googleDriveOAuthClientSecretEnc: Uint8Array | null;
    }>>`SELECT "googleDriveOAuthClientId", "googleDriveOAuthClientSecretEnc" FROM "company_settings" WHERE id = 'default' LIMIT 1`;
    const clientId = setting?.googleDriveOAuthClientId?.trim();
    const clientSecret = setting?.googleDriveOAuthClientSecretEnc
      ? this.crypto.decrypt(Buffer.from(setting.googleDriveOAuthClientSecretEnc)).toString('utf8')
      : '';
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Hãy lưu OAuth Client ID và Client Secret trước khi kết nối.');
    }
    const auth = new google.auth.OAuth2(clientId, clientSecret, this.oauthRedirectUri());
    return auth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent select_account',
      state,
      scope: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive'],
    });
  }

  async exchangeOAuthCode(code: string) {
    const [setting] = await this.prisma.$queryRaw<Array<{
      googleDriveOAuthClientId: string | null;
      googleDriveOAuthClientSecretEnc: Uint8Array | null;
    }>>`SELECT "googleDriveOAuthClientId", "googleDriveOAuthClientSecretEnc" FROM "company_settings" WHERE id = 'default' LIMIT 1`;
    const clientId = setting?.googleDriveOAuthClientId?.trim();
    const clientSecret = setting?.googleDriveOAuthClientSecretEnc
      ? this.crypto.decrypt(Buffer.from(setting.googleDriveOAuthClientSecretEnc)).toString('utf8')
      : '';
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Cấu hình Google OAuth chưa đầy đủ.');
    }
    const auth = new google.auth.OAuth2(clientId, clientSecret, this.oauthRedirectUri());
    const { tokens } = await auth.getToken(code);
    if (!tokens.refresh_token || !tokens.id_token) {
      throw new BadRequestException('Google không trả refresh token. Hãy thu hồi quyền ứng dụng Nexus ECM trong tài khoản Google rồi kết nối lại.');
    }
    const ticket = await auth.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.email || payload.email_verified !== true) {
      throw new BadRequestException('Không xác minh được địa chỉ email của tài khoản Google.');
    }
    return { refreshToken: tokens.refresh_token, email: payload.email };
  }

  oauthRedirectUri() {
    let apiUrl = process.env.API_URL?.trim() || `http://localhost:${process.env.API_PORT?.trim() || '4100'}`;
    while (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
    return `${apiUrl}/api/v1/settings/storage/google-drive/oauth/callback`;
  }

  /** Only validated DB credentials are available to normal storage operations. */
  async isConfigured() {
    const [setting] = await this.prisma.$queryRaw<Array<{
      googleDriveOAuthClientId: string | null;
      googleDriveOAuthClientSecretEnc: Uint8Array | null;
      googleDriveOAuthRefreshTokenEnc: Uint8Array | null;
      googleDriveFolderId: string | null;
      googleDriveConnectionVerifiedAt: Date | null;
      googleDriveConfigFingerprint: string | null;
    }>>`SELECT "googleDriveOAuthClientId", "googleDriveOAuthClientSecretEnc", "googleDriveOAuthRefreshTokenEnc", "googleDriveFolderId", "googleDriveConnectionVerifiedAt", "googleDriveConfigFingerprint" FROM "company_settings" WHERE id = 'default' LIMIT 1`;
    if (!setting?.googleDriveOAuthClientId || !setting.googleDriveOAuthClientSecretEnc || !setting.googleDriveOAuthRefreshTokenEnc || !setting.googleDriveFolderId) return false;
    const clientSecret = this.crypto.decrypt(Buffer.from(setting.googleDriveOAuthClientSecretEnc)).toString('utf8');
    const refreshToken = this.crypto.decrypt(Buffer.from(setting.googleDriveOAuthRefreshTokenEnc)).toString('utf8');
    const fingerprint = this.fingerprint(JSON.stringify({
      clientId: setting.googleDriveOAuthClientId,
      clientSecret,
      refreshToken,
    }), setting.googleDriveFolderId);
    return Boolean(setting.googleDriveConnectionVerifiedAt && setting.googleDriveConfigFingerprint === fingerprint);
  }

  async isSelected() {
    const [setting] = await this.prisma.$queryRaw<Array<{ storageProvider: string | null }>>`SELECT "storageProvider"::text AS "storageProvider" FROM "company_settings" WHERE id = 'default' LIMIT 1`;
    const selected = setting?.storageProvider ?? process.env.STORAGE_PROVIDER?.trim().toUpperCase() ?? 'MINIO';
    if (selected !== 'MINIO' && selected !== 'GOOGLE_DRIVE') {
      throw new InternalServerErrorException('STORAGE_PROVIDER must be MINIO or GOOGLE_DRIVE');
    }
    if (selected === 'GOOGLE_DRIVE' && !(await this.isConfigured())) {
      throw new InternalServerErrorException(
        'Google Drive chưa được kết nối thành công. Hãy kiểm tra kết nối trong Cài đặt > Lưu trữ.',
      );
    }
    return selected === 'GOOGLE_DRIVE';
  }

  /** Checks read and write access by creating and deleting a temporary file. */
  async testConnection() {
    const config = await this.loadConfig(true);
    const drive = this.clientFor(config);
    let tempFileId: string | undefined;
    try {
      const folder = await drive.files.get({
        fileId: config.folderId,
        fields: 'id,name,mimeType',
      });
      if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error('Folder ID không trỏ đến thư mục Google Drive.');
      }
      const testFile = await drive.files.create({
        requestBody: {
          name: `.nexus-connection-test-${randomUUID()}.txt`,
          parents: [config.folderId],
        },
        media: { mimeType: 'text/plain', body: 'Nexus ECM Google Drive connection check' },
        fields: 'id',
      });
      tempFileId = testFile.data.id ?? undefined;
      if (!tempFileId) throw new Error('Drive không trả về ID tệp kiểm tra.');
      await drive.files.delete({
        fileId: tempFileId,
      });
      return {
        connected: true,
        folderName: folder.data.name ?? config.folderId,
        clientEmail: config.email ?? '',
        configFingerprint: config.fingerprint,
      };
    } catch (error) {
      if (tempFileId) {
        await drive.files.delete({
          fileId: tempFileId,
        }).catch(() => undefined);
      }
      const message = (error as Error).message;
      throw new InternalServerErrorException(`Không kết nối được Google Drive: ${message}`);
    }
  }

  private async loadConfig(allowUnverifiedDatabaseConfig = false): Promise<DriveConfig> {
    const [setting] = await this.prisma.$queryRaw<Array<{
      googleDriveOAuthClientId: string | null;
      googleDriveOAuthClientSecretEnc: Uint8Array | null;
      googleDriveOAuthRefreshTokenEnc: Uint8Array | null;
      googleDriveOAuthEmail: string | null;
      googleDriveFolderId: string | null;
    }>>`SELECT "googleDriveOAuthClientId", "googleDriveOAuthClientSecretEnc", "googleDriveOAuthRefreshTokenEnc", "googleDriveOAuthEmail", "googleDriveFolderId" FROM "company_settings" WHERE id = 'default' LIMIT 1`;
    const folderId = setting?.googleDriveFolderId?.trim();
    const clientId = setting?.googleDriveOAuthClientId?.trim();
    const clientSecret = setting?.googleDriveOAuthClientSecretEnc
      ? this.crypto.decrypt(Buffer.from(setting.googleDriveOAuthClientSecretEnc)).toString('utf8')
      : '';
    const refreshToken = setting?.googleDriveOAuthRefreshTokenEnc
      ? this.crypto.decrypt(Buffer.from(setting.googleDriveOAuthRefreshTokenEnc)).toString('utf8')
      : '';
    if (!folderId || !clientId || !clientSecret) {
      throw new InternalServerErrorException('Cần lưu folder ID và Google OAuth Client ID/Secret trước khi kết nối.');
    }
    if (!refreshToken) {
      throw new InternalServerErrorException('Hãy bấm “Kết nối tài khoản Google” trước khi dùng Drive.');
    }
    const fingerprint = this.fingerprint(JSON.stringify({ clientId, clientSecret, refreshToken }), folderId);
    if (!allowUnverifiedDatabaseConfig && !(await this.isConfigured())) {
      throw new InternalServerErrorException('Hãy kiểm tra kết nối Google Drive trước khi sử dụng.');
    }
    return { clientId, clientSecret, refreshToken, email: setting.googleDriveOAuthEmail ?? undefined, folderId, fingerprint };
  }

  private fingerprint(raw: string, folderId: string) {
    return createHash('sha256')
      // Keep the pre-cleanup OAuth fingerprint stable for existing connections.
      .update(JSON.stringify({ raw, folderId, sharedDriveId: '' }))
      .digest('hex');
  }

  private clientFor(config: DriveConfig) {
    if (this.driveClient?.fingerprint === config.fingerprint) return this.driveClient.drive;
    const auth = new google.auth.OAuth2(config.clientId, config.clientSecret);
    auth.setCredentials({ refresh_token: config.refreshToken });
    const drive = google.drive({ version: 'v3', auth });
    this.driveClient = { fingerprint: config.fingerprint, drive };
    return drive;
  }

  private async findFile(key: string, config: DriveConfig, drive: drive_v3.Drive) {
    const fingerprint = createHash('sha256').update(key).digest('hex');
    const listed = await drive.files.list({
      q: `'${config.folderId}' in parents and appProperties has { key='nexusKeySha256' and value='${fingerprint}' } and trashed = false`,
      pageSize: 2,
      fields: 'files(id,name,mimeType,size)',
    });
    return listed.data.files?.[0] ?? null;
  }

  async putObjectStream(key: string, stream: Readable, size: number | undefined, contentType: string) {
    const config = await this.loadConfig();
    const drive = this.clientFor(config);
    const existing = await this.findFile(key, config, drive);
    const fileName = key.split('/').filter(Boolean).slice(-1)[0] || 'file';
    const media = { mimeType: contentType || 'application/octet-stream', body: stream };
    const result = existing?.id
      ? await drive.files.update({
          fileId: existing.id, media, fields: 'id,name,mimeType,size',
        })
      : await drive.files.create({
          requestBody: {
            name: fileName,
            parents: [config.folderId],
            appProperties: { nexusKeySha256: createHash('sha256').update(key).digest('hex') },
          },
          media,
          fields: 'id,name,mimeType,size',
        });
    if (!result.data.id) throw new InternalServerErrorException('Google Drive không trả về ID tệp.');
    const actualSize = Number(result.data.size ?? size ?? 0);
    if (size !== undefined && actualSize !== size) {
      throw new InternalServerErrorException(`Google Drive upload size mismatch for key ${key}`);
    }
    return { size: actualSize, contentType: result.data.mimeType ?? contentType ?? 'application/octet-stream' };
  }

  async getObject(key: string): Promise<GoogleDriveStoredObject | null> {
    const config = await this.loadConfig();
    const drive = this.clientFor(config);
    const metadata = await this.findFile(key, config, drive);
    if (!metadata?.id) return null;
    const response = await drive.files.get(
      { fileId: metadata.id, alt: 'media' },
      { responseType: 'stream' },
    );
    return {
      stream: response.data as Readable,
      size: Number(metadata.size ?? 0),
      contentType: metadata.mimeType ?? 'application/octet-stream',
    };
  }

  async deleteObject(key: string) {
    const config = await this.loadConfig();
    const drive = this.clientFor(config);
    const listed = await drive.files.list({
      q: `'${config.folderId}' in parents and appProperties has { key='nexusKeySha256' and value='${createHash('sha256').update(key).digest('hex')}' } and trashed = false`,
      pageSize: 100,
      fields: 'files(id)',
    });
    await Promise.all((listed.data.files ?? []).flatMap((file) =>
      file.id ? [drive.files.delete({ fileId: file.id })] : [],
    ));
  }
}
