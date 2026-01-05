/**
 * Monetization Controller
 * Handles subscription management, billing, usage tracking, and affiliates
 */
import monetization from '../modules/monetization/monetization.js';

const monetizationController = {
    // ============================================
    // PLANS
    // ============================================

    /**
     * Get all available plans
     */
    getPlans: async (req, res) => {
        res.json({
            success: true,
            plans: Object.values(monetization.PLANS).map(plan => ({
                id: plan.id,
                name: plan.name,
                price: plan.price,
                interval: plan.interval,
                features: plan.features
            }))
        });
    },

    // ============================================
    // SUBSCRIPTIONS
    // ============================================

    /**
     * Get current user's subscription
     */
    getSubscription: async (req, res) => {
        const userId = req.user?.id || req.query.userId || 'default';

        const subscription = monetization.getUserSubscription(userId);
        const usage = monetization.getUserUsage(userId);
        const limits = monetization.checkUsageLimits(userId);

        res.json({
            success: true,
            subscription: {
                planId: subscription.planId,
                planName: subscription.plan.name,
                price: subscription.plan.price,
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                features: subscription.plan.features
            },
            usage,
            limits
        });
    },

    /**
     * Subscribe to a plan
     */
    subscribe: async (req, res) => {
        const userId = req.user?.id || req.body.userId || 'default';
        const { planId, paymentMethodId } = req.body;

        if (!planId) {
            return res.status(400).json({ success: false, error: 'Plan ID required' });
        }

        try {
            const result = await monetization.createSubscription(userId, planId, paymentMethodId);
            res.json(result);
        } catch (error) {
            console.error('Subscription error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    },

    /**
     * Cancel subscription
     */
    cancelSubscription: async (req, res) => {
        const userId = req.user?.id || req.body.userId || 'default';

        try {
            const result = await monetization.cancelSubscription(userId);
            res.json(result);
        } catch (error) {
            console.error('Cancel error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    },

    /**
     * Create checkout session for Stripe
     */
    createCheckout: async (req, res) => {
        const userId = req.user?.id || req.body.userId || 'default';
        const { planId, successUrl, cancelUrl } = req.body;

        if (!planId) {
            return res.status(400).json({ success: false, error: 'Plan ID required' });
        }

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const result = await monetization.createCheckoutSession(
            userId,
            planId,
            successUrl || `${baseUrl}/monetization?success=true`,
            cancelUrl || `${baseUrl}/monetization?canceled=true`
        );

        res.json(result);
    },

    /**
     * Create billing portal session
     */
    createBillingPortal: async (req, res) => {
        const userId = req.user?.id || req.body.userId || 'default';
        const { returnUrl } = req.body;

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const result = await monetization.createBillingPortalSession(
            userId,
            returnUrl || `${baseUrl}/monetization`
        );

        res.json(result);
    },

    /**
     * Handle Stripe webhook
     */
    handleWebhook: async (req, res) => {
        const signature = req.headers['stripe-signature'];

        try {
            const result = await monetization.handleStripeWebhook(req.rawBody, signature);
            res.json(result);
        } catch (error) {
            console.error('Webhook error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    },

    // ============================================
    // USAGE
    // ============================================

    /**
     * Get usage stats
     */
    getUsage: async (req, res) => {
        const userId = req.user?.id || req.query.userId || 'default';

        const usage = monetization.getUserUsage(userId);
        const limits = monetization.checkUsageLimits(userId);

        res.json({
            success: true,
            usage,
            limits
        });
    },

    /**
     * Check if user can generate video
     */
    checkLimits: async (req, res) => {
        const userId = req.user?.id || req.query.userId || 'default';

        const result = monetization.checkUsageLimits(userId);
        res.json({ success: true, ...result });
    },

    /**
     * Track video generation (internal use)
     */
    trackVideo: async (req, res) => {
        const userId = req.user?.id || req.body.userId || 'default';
        const { videoData } = req.body;

        const usage = monetization.trackVideoGeneration(userId, videoData);
        res.json({ success: true, usage });
    },

    // ============================================
    // AFFILIATES
    // ============================================

    /**
     * Get affiliate account
     */
    getAffiliate: async (req, res) => {
        const userId = req.user?.id || req.query.userId || 'default';

        const affiliate = monetization.getAffiliate(userId);

        if (!affiliate) {
            return res.json({
                success: true,
                hasAffiliate: false,
                affiliate: null
            });
        }

        const stats = monetization.getAffiliateStats(userId);
        res.json({
            success: true,
            hasAffiliate: true,
            affiliate: stats
        });
    },

    /**
     * Create affiliate account
     */
    createAffiliate: async (req, res) => {
        const userId = req.user?.id || req.body.userId || 'default';
        const { paypalEmail } = req.body;

        const result = monetization.createAffiliate(userId, { paypalEmail });

        if (!result.success) {
            return res.status(400).json(result);
        }

        const stats = monetization.getAffiliateStats(userId);
        res.json({
            success: true,
            affiliate: stats
        });
    },

    /**
     * Update affiliate payout details
     */
    updateAffiliatePaypal: async (req, res) => {
        const userId = req.user?.id || req.body.userId || 'default';
        const { paypalEmail } = req.body;

        if (!paypalEmail) {
            return res.status(400).json({ success: false, error: 'PayPal email required' });
        }

        // Load and update affiliate data
        const fs = await import('fs');
        const path = await import('path');
        const DATA_DIR = process.env.DATA_DIR || '/app/data';
        const AFFILIATES_PATH = path.join(DATA_DIR, 'affiliates.json');

        try {
            let affiliates = {};
            if (fs.existsSync(AFFILIATES_PATH)) {
                affiliates = JSON.parse(fs.readFileSync(AFFILIATES_PATH, 'utf8'));
            }

            if (!affiliates[userId]) {
                return res.status(404).json({ success: false, error: 'Affiliate account not found' });
            }

            affiliates[userId].paypalEmail = paypalEmail;
            fs.writeFileSync(AFFILIATES_PATH, JSON.stringify(affiliates, null, 2));

            res.json({ success: true, message: 'PayPal email updated' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Track referral (public endpoint)
     */
    trackReferral: async (req, res) => {
        const { affiliateCode, userId, planId } = req.body;

        if (!affiliateCode || !userId || !planId) {
            return res.status(400).json({
                success: false,
                error: 'Affiliate code, user ID, and plan ID required'
            });
        }

        const result = monetization.trackReferral(affiliateCode, userId, planId);
        res.json(result);
    },

    /**
     * Request payout
     */
    requestPayout: async (req, res) => {
        const userId = req.user?.id || req.body.userId || 'default';
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid amount required' });
        }

        const result = monetization.requestPayout(userId, amount);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    },

    // ============================================
    // TRANSACTIONS
    // ============================================

    /**
     * Get transaction history
     */
    getTransactions: async (req, res) => {
        const userId = req.user?.id || req.query.userId || 'default';
        const limit = parseInt(req.query.limit) || 50;

        const transactions = monetization.getTransactionHistory(userId, limit);
        res.json({
            success: true,
            transactions
        });
    }
};

export default monetizationController;
