import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM encryption for sensitive data at rest (face embeddings are
 * biometric PII). Output layout: [12-byte IV][16-byte auth tag][ciphertext].
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer;

  constructor() {
    const raw = process.env.FACE_ENCRYPTION_KEY ?? '';
    // Accept a 64-char hex key; otherwise derive a stable 32-byte key via SHA-256.
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      this.key = Buffer.from(raw, 'hex');
    } else {
      this.logger.warn('FACE_ENCRYPTION_KEY is not 64 hex chars — deriving a key via SHA-256.');
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FACE_ENCRYPTION_KEY phải là khóa hex 64 ký tự khi chạy production');
      }
      this.key = createHash('sha256').update(raw || 'nexus-default-key').digest();
    }
  }

  encrypt(data: Buffer): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]);
  }

  decrypt(payload: Buffer): Buffer {
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const enc = payload.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }
}
