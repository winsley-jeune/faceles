/**
 * Affiliate Repository
 * Database operations for affiliate program
 */

import db from '../db.js';

const affiliateRepository = {
    /**
     * Get affiliate by user ID
     */
    async findByUserId(userId) {
        const result = await db.query(
            'SELECT * FROM affiliates WHERE user_id = $1',
            [userId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get affiliate by code
     */
    async findByCode(code) {
        const result = await db.query(
            'SELECT * FROM affiliates WHERE code = $1',
            [code]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Create affiliate account
     */
    async create(userId, data = {}) {
        const { code, paypalEmail, commissionRate = 0.20 } = data;

        // Generate unique code if not provided
        const affiliateCode = code || this.generateCode();

        const result = await db.query(
            `INSERT INTO affiliates (user_id, code, paypal_email, commission_rate)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [userId, affiliateCode, paypalEmail, commissionRate]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Generate unique affiliate code
     */
    generateCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    /**
     * Update affiliate
     */
    async update(userId, updates) {
        const allowedFields = ['paypal_email', 'status', 'commission_rate'];
        const snakeUpdates = db.keysToSnake(updates);

        const fields = Object.keys(snakeUpdates).filter(k => allowedFields.includes(k));
        if (fields.length === 0) return this.findByUserId(userId);

        const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
        const values = fields.map(f => snakeUpdates[f]);

        const result = await db.query(
            `UPDATE affiliates SET ${setClause}, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 RETURNING *`,
            [userId, ...values]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Add earnings to affiliate
     */
    async addEarnings(affiliateId, amount) {
        const result = await db.query(
            `UPDATE affiliates
             SET total_earnings = total_earnings + $2,
                 pending_earnings = pending_earnings + $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [affiliateId, amount]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Deduct from pending (for payout)
     */
    async deductPending(affiliateId, amount) {
        const result = await db.query(
            `UPDATE affiliates
             SET pending_earnings = pending_earnings - $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND pending_earnings >= $2
             RETURNING *`,
            [affiliateId, amount]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Mark earnings as paid
     */
    async markPaid(affiliateId, amount) {
        const result = await db.query(
            `UPDATE affiliates
             SET paid_earnings = paid_earnings + $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [affiliateId, amount]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    // ============================================
    // REFERRALS
    // ============================================

    /**
     * Create referral
     */
    async createReferral(affiliateId, referredUserId, planId, commission) {
        const result = await db.query(
            `INSERT INTO affiliate_referrals (affiliate_id, referred_user_id, plan_id, commission)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [affiliateId, referredUserId, planId, commission]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get referrals for affiliate
     */
    async getReferrals(affiliateId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        const result = await db.query(
            `SELECT ar.*, u.email, u.name
             FROM affiliate_referrals ar
             JOIN users u ON ar.referred_user_id = u.id
             WHERE ar.affiliate_id = $1
             ORDER BY ar.created_at DESC
             LIMIT $2 OFFSET $3`,
            [affiliateId, limit, offset]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Update referral status
     */
    async updateReferralStatus(referralId, status) {
        const result = await db.query(
            'UPDATE affiliate_referrals SET status = $2 WHERE id = $1 RETURNING *',
            [referralId, status]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get referral stats
     */
    async getReferralStats(affiliateId) {
        const result = await db.query(`
            SELECT
                COUNT(*) as total_referrals,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_referrals,
                COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as monthly_referrals,
                SUM(CASE WHEN status = 'approved' THEN commission ELSE 0 END) as total_commission
            FROM affiliate_referrals
            WHERE affiliate_id = $1
        `, [affiliateId]);

        const row = result.rows[0];
        return {
            totalReferrals: parseInt(row.total_referrals),
            approvedReferrals: parseInt(row.approved_referrals),
            monthlyReferrals: parseInt(row.monthly_referrals),
            totalCommission: parseFloat(row.total_commission) || 0
        };
    },

    // ============================================
    // PAYOUTS
    // ============================================

    /**
     * Request payout
     */
    async requestPayout(affiliateId, amount, paypalEmail) {
        return db.transaction(async (client) => {
            // Check available balance
            const affiliateResult = await client.query(
                'SELECT * FROM affiliates WHERE id = $1',
                [affiliateId]
            );
            const affiliate = affiliateResult.rows[0];

            if (!affiliate || affiliate.pending_earnings < amount) {
                throw new Error('Insufficient balance');
            }

            // Deduct from pending
            await client.query(
                'UPDATE affiliates SET pending_earnings = pending_earnings - $2 WHERE id = $1',
                [affiliateId, amount]
            );

            // Create payout record
            const payoutResult = await client.query(
                `INSERT INTO affiliate_payouts (affiliate_id, amount, paypal_email)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [affiliateId, amount, paypalEmail]
            );

            return db.keysToCamel(payoutResult.rows[0]);
        });
    },

    /**
     * Get payouts for affiliate
     */
    async getPayouts(affiliateId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        const result = await db.query(
            `SELECT * FROM affiliate_payouts
             WHERE affiliate_id = $1
             ORDER BY requested_at DESC
             LIMIT $2 OFFSET $3`,
            [affiliateId, limit, offset]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Update payout status
     */
    async updatePayoutStatus(payoutId, status) {
        const processedAt = status === 'completed' ? 'CURRENT_TIMESTAMP' : 'NULL';
        const result = await db.query(
            `UPDATE affiliate_payouts
             SET status = $2, processed_at = ${processedAt}
             WHERE id = $1 RETURNING *`,
            [payoutId, status]
        );

        // If completed, add to paid earnings
        if (status === 'completed' && result.rows[0]) {
            const payout = result.rows[0];
            await db.query(
                'UPDATE affiliates SET paid_earnings = paid_earnings + $2 WHERE id = $1',
                [payout.affiliate_id, payout.amount]
            );
        }

        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get pending payouts (admin)
     */
    async getPendingPayouts() {
        const result = await db.query(`
            SELECT ap.*, a.code, u.email, u.name
            FROM affiliate_payouts ap
            JOIN affiliates a ON ap.affiliate_id = a.id
            JOIN users u ON a.user_id = u.id
            WHERE ap.status = 'pending'
            ORDER BY ap.requested_at ASC
        `);
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get affiliate dashboard data
     */
    async getDashboard(userId) {
        const result = await db.query(`
            SELECT * FROM affiliate_dashboard WHERE user_id = $1
        `, [userId]);
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    }
};

export default affiliateRepository;
