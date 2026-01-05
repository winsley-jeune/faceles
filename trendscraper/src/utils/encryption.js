/**
 * Token Encryption Utility
 * Provides AES-256-GCM encryption for sensitive data like OAuth tokens
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Data directory for storing encryption key
const DATA_DIR = process.env.DATA_DIR ||
    (fs.existsSync('/app/data') ? '/app/data' : path.resolve(process.cwd(), 'data'));
const ENCRYPTION_KEY_PATH = path.join(DATA_DIR, '.encryption_key');

/**
 * Get or create encryption key
 * Priority: 1) Environment variable 2) Persisted file 3) Generate and persist
 */
const getOrCreateEncryptionKey = () => {
    // 1. Check environment variable first (highest priority for production)
    if (process.env.TOKEN_ENCRYPTION_KEY) {
        const keyBuffer = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');
        if (keyBuffer.length === 32) {
            return keyBuffer;
        }
        console.warn('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Falling back to file.');
    }

    // 2. Try to load from persisted file
    try {
        if (fs.existsSync(ENCRYPTION_KEY_PATH)) {
            const keyHex = fs.readFileSync(ENCRYPTION_KEY_PATH, 'utf8').trim();
            const keyBuffer = Buffer.from(keyHex, 'hex');
            if (keyBuffer.length === 32) {
                return keyBuffer;
            }
        }
    } catch (err) {
        console.warn('Could not read encryption key file:', err.message);
    }

    // 3. Generate new key and persist it
    const newKey = crypto.randomBytes(32);
    try {
        const dir = path.dirname(ENCRYPTION_KEY_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(ENCRYPTION_KEY_PATH, newKey.toString('hex'), { mode: 0o600 });
        console.log('Generated and persisted new encryption key');
    } catch (err) {
        console.error('Warning: Could not persist encryption key:', err.message);
        console.error('Set TOKEN_ENCRYPTION_KEY env var for production.');
    }

    return newKey;
};

// Initialize encryption key
let ENCRYPTION_KEY = null;

const getKey = () => {
    if (!ENCRYPTION_KEY) {
        ENCRYPTION_KEY = getOrCreateEncryptionKey();
    }
    return ENCRYPTION_KEY;
};

/**
 * Encrypt data using AES-256-GCM
 * @param {string|object} data - Data to encrypt (objects will be JSON stringified)
 * @returns {string} Encrypted data as base64 string with format: iv:authTag:ciphertext
 */
export const encrypt = (data) => {
    try {
        const key = getKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        // Format: iv:authTag:ciphertext (all base64)
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (err) {
        console.error('Encryption failed:', err.message);
        throw new Error('Failed to encrypt data');
    }
};

/**
 * Decrypt data encrypted with encrypt()
 * @param {string} encryptedData - Encrypted data in format iv:authTag:ciphertext
 * @returns {string} Decrypted plaintext
 */
export const decrypt = (encryptedData) => {
    try {
        const key = getKey();
        const [ivBase64, authTagBase64, ciphertext] = encryptedData.split(':');

        if (!ivBase64 || !authTagBase64 || !ciphertext) {
            throw new Error('Invalid encrypted data format');
        }

        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (err) {
        console.error('Decryption failed:', err.message);
        throw new Error('Failed to decrypt data');
    }
};

/**
 * Encrypt an object (convenience method)
 * @param {object} obj - Object to encrypt
 * @returns {string} Encrypted data
 */
export const encryptObject = (obj) => {
    return encrypt(JSON.stringify(obj));
};

/**
 * Decrypt to object (convenience method)
 * @param {string} encryptedData - Encrypted data
 * @returns {object} Decrypted object
 */
export const decryptObject = (encryptedData) => {
    const decrypted = decrypt(encryptedData);
    return JSON.parse(decrypted);
};

/**
 * Check if data appears to be encrypted
 * @param {string} data - Data to check
 * @returns {boolean} True if data appears to be encrypted
 */
export const isEncrypted = (data) => {
    if (typeof data !== 'string') return false;
    const parts = data.split(':');
    if (parts.length !== 3) return false;

    // Check if parts are valid base64
    try {
        const iv = Buffer.from(parts[0], 'base64');
        const authTag = Buffer.from(parts[1], 'base64');
        return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
    } catch {
        return false;
    }
};

/**
 * Encrypt sensitive fields in a token object
 * Only encrypts the actual token values, preserves metadata
 * @param {object} tokens - Token object with accessToken, refreshToken, etc.
 * @returns {object} Token object with encrypted sensitive fields
 */
export const encryptTokens = (tokens) => {
    if (!tokens) return tokens;

    const sensitiveFields = ['accessToken', 'refreshToken', 'access_token', 'refresh_token'];
    const encrypted = { ...tokens, _encrypted: true };

    for (const field of sensitiveFields) {
        if (tokens[field] && typeof tokens[field] === 'string' && !isEncrypted(tokens[field])) {
            encrypted[field] = encrypt(tokens[field]);
        }
    }

    return encrypted;
};

/**
 * Decrypt sensitive fields in a token object
 * @param {object} tokens - Token object with encrypted fields
 * @returns {object} Token object with decrypted sensitive fields
 */
export const decryptTokens = (tokens) => {
    if (!tokens) return tokens;
    if (!tokens._encrypted) return tokens; // Not encrypted, return as-is

    const sensitiveFields = ['accessToken', 'refreshToken', 'access_token', 'refresh_token'];
    const decrypted = { ...tokens };
    delete decrypted._encrypted;

    for (const field of sensitiveFields) {
        if (tokens[field] && typeof tokens[field] === 'string' && isEncrypted(tokens[field])) {
            try {
                decrypted[field] = decrypt(tokens[field]);
            } catch (err) {
                console.error(`Failed to decrypt ${field}:`, err.message);
                // Keep encrypted value if decryption fails
            }
        }
    }

    return decrypted;
};

/**
 * Generate a secure random string
 * @param {number} length - Length of string to generate
 * @returns {string} Random hex string
 */
export const generateSecureRandom = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash a string using SHA-256
 * @param {string} data - Data to hash
 * @returns {string} SHA-256 hash as hex string
 */
export const hash = (data) => {
    return crypto.createHash('sha256').update(data).digest('hex');
};

export default {
    encrypt,
    decrypt,
    encryptObject,
    decryptObject,
    isEncrypted,
    encryptTokens,
    decryptTokens,
    generateSecureRandom,
    hash
};
