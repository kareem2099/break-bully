/**
 * Cryptographic utilities for secure data handling in Break Bully
 * Focus: Privacy-preserving data collective with zero-trust architecture
 */

import * as crypto from 'crypto';

// Cryptographic constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits (GCM nonce can be 12-16 bytes, using 16 for consistency)
const HMAC_KEY_LENGTH = 32; // For additional HMAC integrity

// Note: Uses AES-256-GCM with HMAC-SHA256 for authenticated encryption
// GCM provides confidentiality and integrity, HMAC adds extra verification

// Derive a key from user-specific data (deterministic but unique per user/installation)
function deriveKey(salt: string, userId: string): Buffer {
  const input = `${userId}.${salt}`;
  return crypto.scryptSync(input, 'breakBullySalt2024', KEY_LENGTH);
}

/**
 * Encrypt data using AES-256-GCM with HMAC-SHA256 integrity
 * Returns base64-encoded encrypted data with IV, auth tag, and HMAC
 */
export function encryptData(data: string, userId: string): string {
  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const key = deriveKey(salt, userId);
    const hmacKey = deriveKey(salt + 'hmac', userId);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const dataWithAuth = 'breakBullyContribution' + data;

    let encrypted = cipher.update(dataWithAuth, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get the authentication tag for GCM
    const authTag = cipher.getAuthTag();

    // Combine: IV|encrypted|authTag
    const encryptedWithTag = iv.toString('base64') + '|' + encrypted + '|' + authTag.toString('base64');

    // Create HMAC for additional integrity verification
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(encryptedWithTag);
    const integrityHash = hmac.digest('base64');

    // Combine: salt|integrity|IV|encrypted|authTag
    const combined = salt + '|' + integrityHash + '|' + encryptedWithTag;

    return Buffer.from(combined).toString('base64');
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-256-GCM with HMAC integrity verification
 * Expects base64-encoded data with embedded IV, auth tag, and HMAC
 */
export function decryptData(encryptedData: string, userId: string): string {
  try {
    // Decode the combined data
    const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
    const parts = decoded.split('|');

    if (parts.length !== 5) {
      throw new Error('Invalid encrypted data format');
    }

    const [salt, expectedHmac, ivBase64, encryptedText, authTagBase64] = parts;
    const saltStr = salt;

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const key = deriveKey(saltStr, userId);
    const hmacKey = deriveKey(saltStr + 'hmac', userId);

    // Recreate the encryptedWithTag for HMAC verification
    const encryptedWithTag = ivBase64 + '|' + encryptedText + '|' + authTagBase64;

    // Verify HMAC first
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(encryptedWithTag);
    const actualHmac = hmac.digest('base64');

    if (!crypto.timingSafeEqual(Buffer.from(actualHmac, 'base64'), Buffer.from(expectedHmac, 'base64'))) {
      throw new Error('Data integrity check failed');
    }

    // Decrypt using GCM
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    // Remove auth prefix
    if (decrypted.startsWith('breakBullyContribution')) {
      decrypted = decrypted.slice('breakBullyContribution'.length);
    }

    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Create a SHA-256 hash of data for integrity verification
 */
export function createHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify data integrity using SHA-256 hash
 */
export function verifyHash(data: string, expectedHash: string): boolean {
  const actualHash = createHash(data);
  return crypto.timingSafeEqual(
    Buffer.from(actualHash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );
}

/**
 * Generate a cryptographically secure random UUID
 */
export function generateSecureId(): string {
  return crypto.randomUUID();
}

/**
 * Simple zero-knowledge proof simulation for contribution validity
 * Note: This is a simplified version for the open-source implementation.
 * Production systems should use proper ZKP libraries like SnarkJS.
 */
export function createValidityProof(data: any, userId: string): string {
  // Create a hash-based proof that data exists and follows expected format
  // without revealing the actual data
  const dataHash = createHash(JSON.stringify(data));
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');

  const proofData = {
    userId: createHash(userId), // Hash user ID to anonymize
    dataHash,
    timestamp,
    nonce,
    format: 'breakBully_v1'
  };

  return encryptData(JSON.stringify(proofData), `proof_${userId}`);
}

/**
 * Verify a validity proof
 */
export function verifyValidityProof(proof: string, userId: string): boolean {
  try {
    const proofData = JSON.parse(decryptData(proof, `proof_${userId}`));

    // Verify format and reasonable timestamp
    if (proofData.format !== 'breakBully_v1') return false;

    const now = Date.now();
    const proofAge = now - proofData.timestamp;

    // Proof should not be too old (max 1 hour) or from the future
    if (proofAge < 0 || proofAge > 3600000) return false;

    return true;
  } catch (error) {
    console.error('Proof verification failed:', error);
    return false;
  }
}

/**
 * Create an anonymous user identifier for community contributions
 * This ID is consistent for the same user but doesn't reveal identity
 */
export function createAnonymousId(machineId: string, installDate: string): string {
  const combined = `${machineId}.${installDate}`;
  return createHash(combined).substring(0, 16); // First 16 chars for readability
}

/**
 * Sanitize data for contribution by removing personally identifiable information
 */
export function sanitizeForContribution(data: any): any {
  // Deep clone to avoid modifying original
  const sanitized = JSON.parse(JSON.stringify(data));

  // Remove or hash any potentially identifying fields
  const fieldsToRemove = ['userName', 'email', 'workspace', 'filePaths'];
  const fieldsToHash = ['sessionId', 'taskName', 'projectName'];

  function sanitizeObject(obj: any): void {
    if (!obj || typeof obj !== 'object') return;

    // Remove sensitive fields
    fieldsToRemove.forEach(field => {
      if (field in obj) delete obj[field];
    });

    // Hash identifying but useful fields
    fieldsToHash.forEach(field => {
      if (field in obj && typeof obj[field] === 'string') {
        obj[field] = createHash(obj[field]).substring(0, 8); // Short hash
      }
    });

    // Recurse into nested objects
    Object.values(obj).forEach(val => {
      if (typeof val === 'object' && val !== null) {
        sanitizeObject(val);
      }
    });
  }

  sanitizeObject(sanitized);
  return sanitized;
}

export interface EncryptionResult {
  data: string;
  key: string; // Encrypted with community key
}

/**
 * Encrypt data for community sharing (simplified federated learning approach)
 * Uses a community key derived from known constants (transparent)
 */
export function encryptForCommunity(data: any, userId: string): EncryptionResult {
  const sanitizedData = sanitizeForContribution(data);
  const jsonData = JSON.stringify(sanitizedData);

  // Community key derived from constant (transparent)
  const communityKey = deriveKey('breakBullyCommunity2024', 'community_shared');

  // Encrypt with community key
  const encrypted = encryptData(jsonData, 'community_key');

  // User key for this contribution (for user to access their own data later)
  const userKey = deriveKey(crypto.randomBytes(16).toString('hex'), userId);
  const encryptedUserKey = encryptData(userKey.toString('hex'), 'community_key');

  return {
    data: encrypted,
    key: encryptedUserKey
  };
}

/**
 * Decrypt community data using provided key
 */
export function decryptCommunityData(encryptedData: string, encryptedKey: string, userId: string): any {
  try {
    // Decrypt the user key
    const userKeyHex = decryptData(encryptedKey, 'community_key');
    const userKey = Buffer.from(userKeyHex, 'hex');

    // Decrypt the data (this would be done by the community aggregator)
    // For now, return placeholder - full implementation would use proper federated learning
    return { status: 'placeholder', userKey: userKeyHex };
  } catch (error) {
    console.error('Community data decryption failed:', error);
    throw new Error('Failed to decrypt community data');
  }
}

/**
 * Cryptographic utilities summary
 * This module provides:
 * - AES-256-GCM with HMAC-SHA256 encryption/decryption for user data (authenticated encryption)
 * - SHA-256 hashing for integrity
 * - Zero-knowledge proof simulation for contribution validity
 * - Data sanitization for privacy-preserving sharing
 * - Community encryption utilities for federated learning
 *
 * All cryptographic operations are transparent and auditable in the open-source codebase.
 */
