/**
 * Token encryption at rest (AES-256-GCM).
 *
 * Platform OAuth tokens (access/refresh) must not be stored in plaintext.
 * encryptToken() is applied before persisting, decryptToken() after loading, at
 * the dataService.tokenService seam — so every uploader benefits transparently.
 *
 * Values are tagged `enc:v1:<iv>:<authTag>:<ciphertext>` (base64). decryptToken
 * passes through any value lacking that prefix, so legacy plaintext rows keep
 * working until they're rewritten (forward-compatible migration).
 */
import crypto from 'crypto';

const PREFIX = 'enc:v1:';

function getKey() {
    // Prefer a dedicated key; fall back to JWT_SECRET (guaranteed stable across
    // restarts). SESSION_SECRET is intentionally NOT used — it can be generated
    // randomly per boot, which would make previously-encrypted tokens unreadable.
    const secret =
        process.env.TOKEN_ENCRYPTION_KEY ||
        process.env.JWT_SECRET;
    if (!secret) {
        throw new Error(
            'Token encryption requires TOKEN_ENCRYPTION_KEY, SESSION_SECRET, or JWT_SECRET to be set'
        );
    }
    // Derive a stable 32-byte key from the secret.
    return crypto.createHash('sha256').update(String(secret)).digest();
}

/** Encrypt a token string. Returns null/empty unchanged; idempotent on already-encrypted input. */
export function encryptToken(value) {
    if (value == null || value === '') return value;
    if (typeof value === 'string' && value.startsWith(PREFIX)) return value;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Decrypt a token string. Values without the enc: prefix (legacy plaintext) pass through. */
export function decryptToken(value) {
    if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
    const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}

export default { encryptToken, decryptToken };
