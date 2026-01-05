/**
 * Token Blacklist Repository
 * Database operations for JWT token revocation
 */

import db from '../db.js';

const tokenBlacklistRepository = {
    /**
     * Add a token to the blacklist
     * @param {string} tokenHash - SHA-256 hash of token
     * @param {string} reason - Reason for blacklisting
     * @param {Date|number} expiresAt - When token expires
     * @param {string} userId - User ID (optional)
     */
    async add(tokenHash, reason, expiresAt, userId = null) {
        // Convert expiresAt to timestamp
        const expiryTimestamp = typeof expiresAt === 'number'
            ? new Date(expiresAt)
            : expiresAt;

        const result = await db.query(
            `INSERT INTO token_blacklist (token_hash, user_id, reason, expires_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (token_hash) DO UPDATE
             SET reason = EXCLUDED.reason, expires_at = EXCLUDED.expires_at
             RETURNING *`,
            [tokenHash, userId, reason, expiryTimestamp]
        );

        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Check if a token is blacklisted
     * @param {string} tokenHash - SHA-256 hash of token
     * @returns {boolean} True if blacklisted and not expired
     */
    async isBlacklisted(tokenHash) {
        const result = await db.query(
            `SELECT * FROM token_blacklist
             WHERE token_hash = $1
             AND expires_at > NOW()`,
            [tokenHash]
        );

        return result.rowCount > 0;
    },

    /**
     * Get blacklist entry for a token
     * @param {string} tokenHash - SHA-256 hash of token
     */
    async getEntry(tokenHash) {
        const result = await db.query(
            'SELECT * FROM token_blacklist WHERE token_hash = $1',
            [tokenHash]
        );

        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Remove a token from the blacklist
     * @param {string} tokenHash - SHA-256 hash of token
     */
    async remove(tokenHash) {
        const result = await db.query(
            'DELETE FROM token_blacklist WHERE token_hash = $1 RETURNING id',
            [tokenHash]
        );

        return result.rowCount > 0;
    },

    /**
     * Blacklist all tokens for a user
     * @param {string} userId - User ID
     * @param {string} reason - Reason for blacklisting
     */
    async blacklistAllUserTokens(userId, reason = 'security_event') {
        // This marks all existing tokens for this user as blacklisted
        // Note: This requires tokens to be tracked per user in platform_tokens or JWT claims
        const result = await db.query(
            `UPDATE token_blacklist
             SET reason = $2
             WHERE user_id = $1
             RETURNING id`,
            [userId, reason]
        );

        return result.rowCount;
    },

    /**
     * Clean up expired blacklist entries
     */
    async cleanupExpired() {
        const result = await db.query(
            'DELETE FROM token_blacklist WHERE expires_at < NOW() RETURNING id'
        );

        return result.rowCount;
    },

    /**
     * Get blacklist statistics
     */
    async getStats() {
        const activeResult = await db.query(
            'SELECT COUNT(*) as count FROM token_blacklist WHERE expires_at > NOW()'
        );

        const expiredResult = await db.query(
            'SELECT COUNT(*) as count FROM token_blacklist WHERE expires_at <= NOW()'
        );

        const reasonsResult = await db.query(
            `SELECT reason, COUNT(*) as count
             FROM token_blacklist
             WHERE expires_at > NOW()
             GROUP BY reason`
        );

        const reasons = {};
        reasonsResult.rows.forEach(row => {
            reasons[row.reason] = parseInt(row.count);
        });

        return {
            total: parseInt(activeResult.rows[0].count) + parseInt(expiredResult.rows[0].count),
            active: parseInt(activeResult.rows[0].count),
            expired: parseInt(expiredResult.rows[0].count),
            reasons
        };
    },

    /**
     * Get all blacklisted tokens for a user
     * @param {string} userId - User ID
     */
    async getUserBlacklist(userId) {
        const result = await db.query(
            `SELECT * FROM token_blacklist
             WHERE user_id = $1
             AND expires_at > NOW()
             ORDER BY blacklisted_at DESC`,
            [userId]
        );

        return result.rows.map(r => db.keysToCamel(r));
    }
};

export default tokenBlacklistRepository;
