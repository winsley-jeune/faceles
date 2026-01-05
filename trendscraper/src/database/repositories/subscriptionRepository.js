/**
 * Subscription Repository
 * Database operations for subscriptions and billing
 */

import db from '../db.js';

const subscriptionRepository = {
    /**
     * Get user subscription
     */
    async findByUserId(userId) {
        const result = await db.query(
            'SELECT * FROM subscriptions WHERE user_id = $1',
            [userId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get subscription by Stripe customer ID
     */
    async findByStripeCustomerId(stripeCustomerId) {
        const result = await db.query(
            'SELECT * FROM subscriptions WHERE stripe_customer_id = $1',
            [stripeCustomerId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get subscription by Stripe subscription ID
     */
    async findByStripeSubscriptionId(stripeSubscriptionId) {
        const result = await db.query(
            'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1',
            [stripeSubscriptionId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Create or update subscription
     */
    async upsert(userId, data) {
        const {
            planId,
            status,
            stripeCustomerId,
            stripeSubscriptionId,
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            canceledAt,
            demoMode
        } = data;

        const result = await db.query(
            `INSERT INTO subscriptions (
                user_id, plan_id, status, stripe_customer_id, stripe_subscription_id,
                current_period_start, current_period_end, cancel_at_period_end, canceled_at, demo_mode
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (user_id)
             DO UPDATE SET
                plan_id = COALESCE($2, subscriptions.plan_id),
                status = COALESCE($3, subscriptions.status),
                stripe_customer_id = COALESCE($4, subscriptions.stripe_customer_id),
                stripe_subscription_id = COALESCE($5, subscriptions.stripe_subscription_id),
                current_period_start = COALESCE($6, subscriptions.current_period_start),
                current_period_end = COALESCE($7, subscriptions.current_period_end),
                cancel_at_period_end = COALESCE($8, subscriptions.cancel_at_period_end),
                canceled_at = $9,
                demo_mode = COALESCE($10, subscriptions.demo_mode),
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, planId, status, stripeCustomerId, stripeSubscriptionId,
             currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd || false, canceledAt, demoMode || false]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Update subscription status
     */
    async updateStatus(userId, status) {
        const result = await db.query(
            `UPDATE subscriptions SET status = $2, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 RETURNING *`,
            [userId, status]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Cancel subscription
     */
    async cancel(userId, cancelAtPeriodEnd = true) {
        const result = await db.query(
            `UPDATE subscriptions
             SET cancel_at_period_end = $2, canceled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 RETURNING *`,
            [userId, cancelAtPeriodEnd]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Downgrade to free plan
     */
    async downgradeToFree(userId) {
        const result = await db.query(
            `UPDATE subscriptions
             SET plan_id = 'free', status = 'active', cancel_at_period_end = false,
                 current_period_end = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 RETURNING *`,
            [userId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get subscriptions by plan
     */
    async findByPlan(planId, options = {}) {
        const { limit = 100, offset = 0 } = options;
        const result = await db.query(
            `SELECT s.*, u.email, u.name FROM subscriptions s
             JOIN users u ON s.user_id = u.id
             WHERE s.plan_id = $1
             ORDER BY s.created_at DESC
             LIMIT $2 OFFSET $3`,
            [planId, limit, offset]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get active subscriptions expiring soon
     */
    async findExpiringSoon(days = 7) {
        const result = await db.query(
            `SELECT s.*, u.email, u.name FROM subscriptions s
             JOIN users u ON s.user_id = u.id
             WHERE s.status = 'active'
             AND s.current_period_end IS NOT NULL
             AND s.current_period_end <= CURRENT_TIMESTAMP + INTERVAL '${days} days'
             AND s.current_period_end > CURRENT_TIMESTAMP`,
            []
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get subscription summary
     */
    async getSummary() {
        const result = await db.query(`
            SELECT
                plan_id,
                COUNT(*) as count,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count
            FROM subscriptions
            GROUP BY plan_id
        `);
        return result.rows.reduce((acc, row) => {
            acc[row.plan_id] = { total: parseInt(row.count), active: parseInt(row.active_count) };
            return acc;
        }, {});
    },

    /**
     * Delete subscription
     */
    async delete(userId) {
        const result = await db.query(
            'DELETE FROM subscriptions WHERE user_id = $1 RETURNING id',
            [userId]
        );
        return result.rowCount > 0;
    }
};

export default subscriptionRepository;
