/**
 * Cryptographic utilities for secure data handling in DotSense
 * Focus: Privacy-preserving data collective with zero-trust architecture
 */

import * as crypto from 'crypto';
import { Logger } from './logger';

// Type definitions for cryptographic utilities
interface ValidityProofData {
  userId: string;
  dataHash: string;
  timestamp: number;
  nonce: string;
  format: string;
}

interface SanitizedData {
  [key: string]: unknown;
}

interface CommunityData {
  [key: string]: unknown;
}

interface DecryptionResult {
  status: string;
  userKey: string;
  userId: string;
  userKeyLength: number;
}

// Cryptographic constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits (GCM nonce can be 12-16 bytes, using 16 for consistency)
const HMAC_KEY_LENGTH = 32; // For additional HMAC integrity

// Note: Uses AES-256-GCM with HMAC-SHA256 for authenticated encryption
// GCM provides confidentiality and integrity, HMAC adds extra verification

/**
 * Encrypt data using a provided key (AES-256-GCM)
 * Returns base64-encoded encrypted data with IV and auth tag
 */
function encryptWithKey(data: string, key: Buffer): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const dataWithAuth = 'dotsenseContribution' + data;

    let encrypted = cipher.update(dataWithAuth, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get the authentication tag for GCM
    const authTag = cipher.getAuthTag();

    // Combine: IV|encrypted|authTag
    const encryptedWithTag = iv.toString('base64') + '|' + encrypted + '|' + authTag.toString('base64');

    return Buffer.from(encryptedWithTag).toString('base64');
  } catch (error) {
    Logger.error('Encryption with key failed:', error);
    throw new Error('Failed to encrypt data with key');
  }
}

// Derive a key from user-specific data (deterministic but unique per user/installation)
function deriveKey(salt: string, userId: string, length = KEY_LENGTH): Buffer {
  const input = `${userId}.${salt}`;
  return crypto.scryptSync(input, 'dotsenseSalt2024', length);
}

/**
 * Encrypt data using AES-256-GCM with HMAC-SHA256 integrity
 * Returns base64-encoded encrypted data with IV, auth tag, and HMAC
 */
export function encryptData(data: string, userId: string): string {
  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const key = deriveKey(salt, userId);
    const hmacKey = deriveKey(salt + 'hmac', userId, HMAC_KEY_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const dataWithAuth = 'dotsenseContribution' + data;

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
    Logger.error('Encryption failed:', error);
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
    const hmacKey = deriveKey(saltStr + 'hmac', userId, HMAC_KEY_LENGTH);

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
    if (decrypted.startsWith('dotsenseContribution')) {
      decrypted = decrypted.slice('dotsenseContribution'.length);
    }

    return decrypted;
  } catch (error) {
    Logger.error('Decryption failed:', error);
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
export function createValidityProof(data: unknown, userId: string): string {
  // Create a hash-based proof that data exists and follows expected format
  // without revealing the actual data
  const dataHash = createHash(JSON.stringify(data));
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');

  const proofData: ValidityProofData = {
    userId: createHash(userId), // Hash user ID to anonymize
    dataHash,
    timestamp,
    nonce,
    format: 'dotsense_v1'
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
    if (proofData.format !== 'dotsense_v1') return false;

    const now = Date.now();
    const proofAge = now - proofData.timestamp;

    // Proof should not be too old (max 1 hour) or from the future
    if (proofAge < 0 || proofAge > 3600000) return false;

    return true;
  } catch (error) {
    Logger.error('Proof verification failed:', error);
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
export function sanitizeForContribution(data: unknown): SanitizedData {
  // Deep clone to avoid modifying original
  const sanitized: SanitizedData = JSON.parse(JSON.stringify(data));

  // Remove or hash any potentially identifying fields
  const fieldsToRemove = ['userName', 'email', 'workspace', 'filePaths'];
  const fieldsToHash = ['sessionId', 'taskName', 'projectName'];

  function sanitizeObject(obj: Record<string, unknown>): void {
    if (!obj || typeof obj !== 'object') return;

    // Remove sensitive fields
    fieldsToRemove.forEach(field => {
      if (field in obj) delete obj[field];
    });

    // Hash identifying but useful fields
    fieldsToHash.forEach(field => {
      if (field in obj && typeof obj[field] === 'string') {
        obj[field] = createHash(obj[field] as string).substring(0, 8); // Short hash
      }
    });

    // Recurse into nested objects
    Object.values(obj).forEach(val => {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        sanitizeObject(val as Record<string, unknown>);
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
export function encryptForCommunity(data: CommunityData, userId: string): EncryptionResult {
  const sanitizedData = sanitizeForContribution(data);
  const jsonData = JSON.stringify(sanitizedData);

  // Community key derived from constant (transparent)
  const communityKey = deriveKey('dotsenseCommunity2024', 'community_shared');

  // Encrypt with community key
  const encrypted = encryptWithKey(jsonData, communityKey);

  // User key for this contribution (for user to access their own data later)
  const userKey = deriveKey(crypto.randomBytes(16).toString('hex'), userId);
  const encryptedUserKey = encryptWithKey(userKey.toString('hex'), communityKey);

  return {
    data: encrypted,
    key: encryptedUserKey
  };
}

/**
 * Decrypt community data using provided key
 */
export function decryptCommunityData(encryptedData: string, encryptedKey: string, userId: string): DecryptionResult {
  try {
    // Decrypt the user key
    const userKeyHex = decryptData(encryptedKey, 'community_key');
    const userKey = Buffer.from(userKeyHex, 'hex');

    // Decrypt the data (this would be done by the community aggregator)
    // For now, return placeholder - full implementation would use proper federated learning
    return { status: 'placeholder', userKey: userKeyHex, userId, userKeyLength: userKey.length };
  } catch (error) {
    Logger.error('Community data decryption failed:', error);
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
