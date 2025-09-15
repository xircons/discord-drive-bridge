import { EncryptionService } from '../../src/utils/encryption';

describe('EncryptionService', () => {
  const testString = 'This is a test string with special characters: !@#$%^&*()';
  const testPassword = 'testPassword123!';

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const encrypted = EncryptionService.encrypt(testString);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(encrypted).not.toBe(testString);
      expect(decrypted).toBe(testString);
    });

    it('should produce different encrypted strings for the same input', () => {
      const encrypted1 = EncryptionService.encrypt(testString);
      const encrypted2 = EncryptionService.encrypt(testString);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty string', () => {
      const encrypted = EncryptionService.encrypt('');
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe('');
    });

    it('should handle special characters and unicode', () => {
      const specialString = '🚀 Hello 世界! @#$%^&*()';
      const encrypted = EncryptionService.encrypt(specialString);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(specialString);
    });
  });

  describe('hashPassword and verifyPassword', () => {
    it('should hash and verify password correctly', () => {
      const hashedPassword = EncryptionService.hashPassword(testPassword);
      const isValid = EncryptionService.verifyPassword(testPassword, hashedPassword);

      expect(hashedPassword).not.toBe(testPassword);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', () => {
      const hashedPassword = EncryptionService.hashPassword(testPassword);
      const isValid = EncryptionService.verifyPassword('wrongPassword', hashedPassword);

      expect(isValid).toBe(false);
    });

    it('should produce different hashes for the same password', () => {
      const hash1 = EncryptionService.hashPassword(testPassword);
      const hash2 = EncryptionService.hashPassword(testPassword);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateRandomString', () => {
    it('should generate string of correct length', () => {
      const randomString = EncryptionService.generateRandomString(32);
      expect(randomString).toHaveLength(64); // 32 bytes = 64 hex characters
    });

    it('should generate different strings each time', () => {
      const string1 = EncryptionService.generateRandomString(16);
      const string2 = EncryptionService.generateRandomString(16);

      expect(string1).not.toBe(string2);
    });
  });

  describe('generateCodeChallenge and generateCodeVerifier', () => {
    it('should generate code verifier of correct length', () => {
      const codeVerifier = EncryptionService.generateCodeVerifier();
      expect(codeVerifier).toHaveLength(64); // 32 bytes = 64 hex characters
    });

    it('should generate consistent code challenge for same verifier', () => {
      const codeVerifier = EncryptionService.generateCodeVerifier();
      const challenge1 = EncryptionService.generateCodeChallenge(codeVerifier);
      const challenge2 = EncryptionService.generateCodeChallenge(codeVerifier);

      expect(challenge1).toBe(challenge2);
    });

    it('should generate different challenges for different verifiers', () => {
      const verifier1 = EncryptionService.generateCodeVerifier();
      const verifier2 = EncryptionService.generateCodeVerifier();
      const challenge1 = EncryptionService.generateCodeChallenge(verifier1);
      const challenge2 = EncryptionService.generateCodeChallenge(verifier2);

      expect(challenge1).not.toBe(challenge2);
    });
  });
});
