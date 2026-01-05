/**
 * Token Repository
 * Database operations for platform OAuth tokens (YouTube, TikTok, Facebook, Instagram)
 */

import db from '../db.js';

const tokenRepository = {
    /**
     * Get token for platform
     */
    async findByPlatform(userId, platform) {
        const result = await db.query(
            'SELECT * FROM platform_tokens WHERE user_id = $1 AND platform = $2',
            [userId, platform]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get all tokens for user
     */
    async findByUserId(userId) {
        const result = await db.query(
            'SELECT * FROM platform_tokens WHERE user_id = $1',
            [userId]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Save or update platform token
     */
    async upsert(userId, platform, tokenData) {
        const {
            accessToken,
            refreshToken,
            expiresAt,
            channelId,
            channelName,
            scopes,
            metadata
        } = tokenData;

        const result = await db.query(
            `INSERT INTO platform_tokens (
                user_id, platform, access_token, refresh_token, expires_at,
                channel_id, channel_name, scopes, metadata
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (user_id, platform)
             DO UPDATE SET
                access_token = $3,
                refresh_token = COALESCE($4, platform_tokens.refresh_token),
                expires_at = $5,
                channel_id = COALESCE($6, platform_tokens.channel_id),
                channel_name = COALESCE($7, platform_tokens.channel_name),
                scopes = COALESCE($8, platform_tokens.scopes),
                metadata = COALESCE($9, platform_tokens.metadata),
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, platform, accessToken, refreshToken, expiresAt,
             channelId, channelName, scopes, metadata ? JSON.stringify(metadata) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Update access token only (for refresh)
     */
    async updateAccessToken(userId, platform, accessToken, expiresAt) {
        const result = await db.query(
            `UPDATE platform_tokens
             SET access_token = $3, expires_at = $4, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND platform = $2
             RETURNING *`,
            [userId, platform, accessToken, expiresAt]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Delete platform token
     */
    async delete(userId, platform) {
        const result = await db.query(
            'DELETE FROM platform_tokens WHERE user_id = $1 AND platform = $2 RETURNING id',
            [userId, platform]
        );
        return result.rowCount > 0;
    },

    /**
     * Delete all tokens for user
     */
    async deleteAll(userId) {
        const result = await db.query(
            'DELETE FROM platform_tokens WHERE user_id = $1 RETURNING id',
            [userId]
        );
        return result.rowCount;
    },

    /**
     * Check if token is expired or expiring soon
     */
    async isExpired(userId, platform, bufferMinutes = 5) {
        const result = await db.query(
            `SELECT expires_at FROM platform_tokens
             WHERE user_id = $1 AND platform = $2`,
            [userId, platform]
        );

        if (!result.rows[0] || !result.rows[0].expires_at) {
            return true;
        }

        const expiresAt = new Date(result.rows[0].expires_at);
        const bufferMs = bufferMinutes * 60 * 1000;
        return expiresAt.getTime() - bufferMs < Date.now();
    },

    /**
     * Get tokens expiring soon (for batch refresh)
     */
    async findExpiringSoon(minutes = 30) {
        const result = await db.query(
            `SELECT pt.*, u.email FROM platform_tokens pt
             JOIN users u ON pt.user_id = u.id
             WHERE pt.expires_at IS NOT NULL
             AND pt.expires_at <= CURRENT_TIMESTAMP + INTERVAL '${minutes} minutes'
             AND pt.expires_at > CURRENT_TIMESTAMP
             AND pt.refresh_token IS NOT NULL`,
            []
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get connection status for user
     */
    async getConnectionStatus(userId) {
        const result = await db.query(
            `SELECT * FROM platform_connection_status WHERE user_id = $1`,
            [userId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Count connected platforms for user
     */
    async countConnected(userId) {
        const result = await db.query(
            'SELECT COUNT(*) FROM platform_tokens WHERE user_id = $1',
            [userId]
        );
        return parseInt(result.rows[0].count);
    }
};

export default tokenRepository;
