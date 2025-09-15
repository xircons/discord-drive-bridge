import * as crypto from 'crypto';
import { config } from '../config';

const IV_LENGTH = 16;
const SALT_LENGTH = 64;

export class EncryptionService {
  private static getKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(config.security.encryptionKey, salt, 100000, 32, 'sha512');
  }

  static encrypt(text: string): string {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = this.getKey(salt);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine salt + iv + encrypted data
    const combined = Buffer.concat([salt, iv, Buffer.from(encrypted, 'hex')]);
    return combined.toString('base64');
  }

  static decrypt(encryptedData: string): string {
    const combined = Buffer.from(encryptedData, 'base64');
    
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH);
    
    const key = this.getKey(salt);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  static hashPassword(password: string): string {
    const salt = crypto.randomBytes(32);
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    return salt.toString('hex') + ':' + hash.toString('hex');
  }

  static verifyPassword(password: string, hashedPassword: string): boolean {
    const [saltHex, hashHex] = hashedPassword.split(':');
    if (!saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const hash = Buffer.from(hashHex, 'hex');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    return crypto.timingSafeEqual(hash, verifyHash);
  }

  static generateRandomString(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }

  static generateCodeChallenge(codeVerifier: string): string {
    return crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
  }

  static generateCodeVerifier(): string {
    return this.generateRandomString(32);
  }
}
