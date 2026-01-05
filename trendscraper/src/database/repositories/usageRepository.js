/**
 * Usage Repository
 * Database operations for usage tracking and transactions
 */

import db from '../db.js';

const usageRepository = {
    /**
     * Get current period usage for user
     */
    async getCurrentUsage(userId) {
        const period = db.getCurrentPeriod();
        const result = await db.query(
            'SELECT * FROM usage WHERE user_id = $1 AND period = $2',
            [userId, period]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : {
            userId,
            period,
            videosGenerated: 0,
            apiCalls: 0,
            storageUsed: 0
        };
    },

    /**
     * Get usage for specific period
     */
    async getUsageForPeriod(userId, period) {
        const result = await db.query(
            'SELECT * FROM usage WHERE user_id = $1 AND period = $2',
            [userId, period]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Increment video count
     */
    async incrementVideos(userId, count = 1) {
        const period = db.getCurrentPeriod();
        const result = await db.query(
            `INSERT INTO usage (user_id, period, videos_generated, last_updated)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, period)
             DO UPDATE SET videos_generated = usage.videos_generated + $3, last_updated = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, period, count]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Increment API calls
     */
    async incrementApiCalls(userId, count = 1) {
        const period = db.getCurrentPeriod();
        const result = await db.query(
            `INSERT INTO usage (user_id, period, api_calls, last_updated)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, period)
             DO UPDATE SET api_calls = usage.api_calls + $3, last_updated = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, period, count]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Add storage used
     */
    async addStorage(userId, bytes) {
        const period = db.getCurrentPeriod();
        const result = await db.query(
            `INSERT INTO usage (user_id, period, storage_used, last_updated)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, period)
             DO UPDATE SET storage_used = usage.storage_used + $3, last_updated = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, period, bytes]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get usage history for user
     */
    async getHistory(userId, months = 12) {
        const result = await db.query(
            `SELECT * FROM usage
             WHERE user_id = $1
             ORDER BY period DESC
             LIMIT $2`,
            [userId, months]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get total storage used by user (all time)
     */
    async getTotalStorage(userId) {
        const result = await db.query(
            'SELECT SUM(storage_used) as total FROM usage WHERE user_id = $1',
            [userId]
        );
        return parseInt(result.rows[0].total) || 0;
    },

    /**
     * Reset usage for new period
     */
    async resetForPeriod(userId, period) {
        const result = await db.query(
            `INSERT INTO usage (user_id, period, videos_generated, api_calls, storage_used)
             VALUES ($1, $2, 0, 0, 0)
             ON CONFLICT (user_id, period) DO NOTHING
             RETURNING *`,
            [userId, period]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    // ============================================
    // TRANSACTIONS
    // ============================================

    /**
     * Create transaction record
     */
    async createTransaction(data) {
        const { userId, type, amount, currency, status, stripeInvoiceId, metadata } = data;
        const result = await db.query(
            `INSERT INTO transactions (user_id, type, amount, currency, status, stripe_invoice_id, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [userId, type, amount, currency || 'USD', status || 'completed', stripeInvoiceId, JSON.stringify(metadata)]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get transactions for user
     */
    async getTransactions(userId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        const result = await db.query(
            `SELECT * FROM transactions
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get transaction by ID
     */
    async getTransaction(transactionId) {
        const result = await db.query(
            'SELECT * FROM transactions WHERE id = $1',
            [transactionId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Update transaction status
     */
    async updateTransactionStatus(transactionId, status) {
        const result = await db.query(
            'UPDATE transactions SET status = $2 WHERE id = $1 RETURNING *',
            [transactionId, status]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get revenue summary
     */
    async getRevenueSummary(days = 30) {
        const result = await db.query(`
            SELECT
                DATE(created_at) as date,
                SUM(amount) as total,
                COUNT(*) as count
            FROM transactions
            WHERE status = 'completed'
            AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);
        return result.rows.map(r => ({
            date: r.date,
            total: parseFloat(r.total),
            count: parseInt(r.count)
        }));
    }
};

export default usageRepository;
