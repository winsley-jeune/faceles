/**
 * User Repository
 * Database operations for users and authentication
 */

import db from '../db.js';

const userRepository = {
    /**
     * Find user by ID
     */
    async findById(id) {
        const result = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Find user by email
     */
    async findByEmail(email) {
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Find user by provider
     */
    async findByProvider(provider, providerId) {
        const result = await db.query(
            `SELECT u.* FROM users u
             JOIN user_providers up ON u.id = up.user_id
             WHERE up.provider = $1 AND up.provider_id = $2`,
            [provider, providerId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Create new user
     */
    async create(userData) {
        const { email, name, avatar } = userData;
        const result = await db.query(
            `INSERT INTO users (email, name, avatar, last_login)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             RETURNING *`,
            [email, name, avatar]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Update user
     */
    async update(id, updates) {
        const allowedFields = ['email', 'name', 'avatar', 'is_active', 'last_login'];
        const snakeUpdates = db.keysToSnake(updates);

        const fields = Object.keys(snakeUpdates).filter(k => allowedFields.includes(k));
        if (fields.length === 0) return this.findById(id);

        const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
        const values = fields.map(f => snakeUpdates[f]);

        const result = await db.query(
            `UPDATE users SET ${setClause} WHERE id = $1 RETURNING *`,
            [id, ...values]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Update last login timestamp
     */
    async updateLastLogin(id) {
        await db.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );
    },

    /**
     * Delete user
     */
    async delete(id) {
        const result = await db.query(
            'DELETE FROM users WHERE id = $1 RETURNING id',
            [id]
        );
        return result.rowCount > 0;
    },

    /**
     * Add provider to user
     */
    async addProvider(userId, providerData) {
        const { provider, providerId, accessToken, refreshToken, tokenExpiresAt, profileData } = providerData;
        const result = await db.query(
            `INSERT INTO user_providers (user_id, provider, provider_id, access_token, refresh_token, token_expires_at, profile_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (provider, provider_id)
             DO UPDATE SET access_token = $4, refresh_token = $5, token_expires_at = $6, profile_data = $7, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, provider, providerId, accessToken, refreshToken, tokenExpiresAt, JSON.stringify(profileData)]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get user providers
     */
    async getProviders(userId) {
        const result = await db.query(
            'SELECT provider, provider_id, created_at FROM user_providers WHERE user_id = $1',
            [userId]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Remove provider from user
     */
    async removeProvider(userId, provider) {
        const result = await db.query(
            'DELETE FROM user_providers WHERE user_id = $1 AND provider = $2 RETURNING id',
            [userId, provider]
        );
        return result.rowCount > 0;
    },

    /**
     * Find or create user from OAuth
     */
    async findOrCreateFromOAuth(provider, profile) {
        return db.transaction(async (client) => {
            // Check if user exists by provider
            let userResult = await client.query(
                `SELECT u.* FROM users u
                 JOIN user_providers up ON u.id = up.user_id
                 WHERE up.provider = $1 AND up.provider_id = $2`,
                [provider, profile.id]
            );

            let user = userResult.rows[0];

            if (!user && profile.email) {
                // Check if user exists by email
                userResult = await client.query(
                    'SELECT * FROM users WHERE email = $1',
                    [profile.email]
                );
                user = userResult.rows[0];
            }

            if (!user) {
                // Create new user
                userResult = await client.query(
                    `INSERT INTO users (email, name, avatar, last_login)
                     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                     RETURNING *`,
                    [profile.email, profile.name, profile.avatar]
                );
                user = userResult.rows[0];
            } else {
                // Update last login
                await client.query(
                    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                    [user.id]
                );
            }

            // Add/update provider
            await client.query(
                `INSERT INTO user_providers (user_id, provider, provider_id, access_token, refresh_token, token_expires_at, profile_data)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (provider, provider_id)
                 DO UPDATE SET access_token = $4, refresh_token = $5, token_expires_at = $6, profile_data = $7, updated_at = CURRENT_TIMESTAMP`,
                [user.id, provider, profile.id, profile.accessToken, profile.refreshToken, profile.tokenExpiresAt, JSON.stringify(profile)]
            );

            return db.keysToCamel(user);
        });
    },

    /**
     * Get all users (paginated)
     */
    async findAll(options = {}) {
        const { limit = 50, offset = 0, orderBy = 'created_at DESC' } = options;
        const result = await db.query(
            `SELECT * FROM users ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Count total users
     */
    async count() {
        const result = await db.query('SELECT COUNT(*) FROM users');
        return parseInt(result.rows[0].count);
    }
};

export default userRepository;
