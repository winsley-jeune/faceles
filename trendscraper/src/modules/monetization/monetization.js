/**
 * Monetization Module
 * Handles subscriptions, payments, usage tracking, and affiliate management
 *
 * Integrates with Stripe for payment processing
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Data paths
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const SUBSCRIPTIONS_PATH = path.join(DATA_DIR, 'subscriptions.json');
const USAGE_PATH = path.join(DATA_DIR, 'usage.json');
const AFFILIATES_PATH = path.join(DATA_DIR, 'affiliates.json');
const TRANSACTIONS_PATH = path.join(DATA_DIR, 'transactions.json');

// Stripe configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Initialize Stripe if configured
let stripe = null;
if (STRIPE_SECRET_KEY) {
    try {
        const Stripe = (await import('stripe')).default;
        stripe = new Stripe(STRIPE_SECRET_KEY);
        console.log('💳 Stripe initialized');
    } catch (e) {
        console.warn('⚠️ Stripe not available:', e.message);
    }
}

// ============================================
// SUBSCRIPTION PLANS
// ============================================

export const PLANS = {
    free: {
        id: 'free',
        name: 'Free',
        price: 0,
        interval: 'month',
        features: {
            videosPerMonth: 5,
            maxVideoDuration: 60,
            platforms: ['youtube'],
            aiVoice: false,
            customBranding: false,
            analytics: 'basic',
            support: 'community',
            apiAccess: false,
            teamMembers: 1,
            storage: '1GB',
            watermark: true
        },
        stripePriceId: null
    },
    starter: {
        id: 'starter',
        name: 'Starter',
        price: 29,
        interval: 'month',
        features: {
            videosPerMonth: 30,
            maxVideoDuration: 180,
            platforms: ['youtube', 'tiktok'],
            aiVoice: true,
            customBranding: false,
            analytics: 'standard',
            support: 'email',
            apiAccess: false,
            teamMembers: 1,
            storage: '10GB',
            watermark: true
        },
        stripePriceId: process.env.STRIPE_STARTER_PRICE_ID
    },
    professional: {
        id: 'professional',
        name: 'Professional',
        price: 79,
        interval: 'month',
        features: {
            videosPerMonth: 100,
            maxVideoDuration: 300,
            platforms: ['youtube', 'tiktok', 'facebook', 'instagram'],
            aiVoice: true,
            customBranding: true,
            analytics: 'advanced',
            support: 'priority',
            apiAccess: true,
            teamMembers: 3,
            storage: '50GB',
            watermark: false
        },
        stripePriceId: process.env.STRIPE_PRO_PRICE_ID
    },
    enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 199,
        interval: 'month',
        features: {
            videosPerMonth: -1, // Unlimited
            maxVideoDuration: 600,
            platforms: ['youtube', 'tiktok', 'facebook', 'instagram'],
            aiVoice: true,
            customBranding: true,
            analytics: 'enterprise',
            support: 'dedicated',
            apiAccess: true,
            teamMembers: -1, // Unlimited
            storage: '500GB',
            watermark: false,
            whiteLabel: true,
            customIntegrations: true
        },
        stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID
    }
};

// ============================================
// DATA PERSISTENCE
// ============================================

const loadData = (filePath, defaultValue = {}) => {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error(`Error loading ${filePath}:`, e.message);
    }
    return defaultValue;
};

const saveData = (filePath, data) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

/**
 * Get user's current subscription
 */
export const getUserSubscription = (userId) => {
    const subscriptions = loadData(SUBSCRIPTIONS_PATH, {});
    const sub = subscriptions[userId];

    if (!sub) {
        return {
            planId: 'free',
            plan: PLANS.free,
            status: 'active',
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false
        };
    }

    // Check if subscription is expired
    if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) {
        if (!sub.cancelAtPeriodEnd) {
            // Would auto-renew in real Stripe integration
        } else {
            // Downgrade to free
            sub.planId = 'free';
            sub.status = 'canceled';
        }
    }

    return {
        ...sub,
        plan: PLANS[sub.planId] || PLANS.free
    };
};

/**
 * Create or update subscription
 */
export const createSubscription = async (userId, planId, paymentMethodId = null) => {
    if (!PLANS[planId]) {
        throw new Error(`Invalid plan: ${planId}`);
    }

    const plan = PLANS[planId];
    const subscriptions = loadData(SUBSCRIPTIONS_PATH, {});

    // For free plan, just save directly
    if (planId === 'free') {
        subscriptions[userId] = {
            planId: 'free',
            status: 'active',
            createdAt: new Date().toISOString(),
            currentPeriodEnd: null
        };
        saveData(SUBSCRIPTIONS_PATH, subscriptions);
        return { success: true, subscription: getUserSubscription(userId) };
    }

    // For paid plans, use Stripe if available
    if (stripe && plan.stripePriceId) {
        try {
            // Create or get Stripe customer
            let customerId = subscriptions[userId]?.stripeCustomerId;

            if (!customerId) {
                const customer = await stripe.customers.create({
                    metadata: { userId }
                });
                customerId = customer.id;
            }

            // Attach payment method
            if (paymentMethodId) {
                await stripe.paymentMethods.attach(paymentMethodId, {
                    customer: customerId
                });
                await stripe.customers.update(customerId, {
                    invoice_settings: { default_payment_method: paymentMethodId }
                });
            }

            // Create subscription
            const stripeSubscription = await stripe.subscriptions.create({
                customer: customerId,
                items: [{ price: plan.stripePriceId }],
                payment_behavior: 'default_incomplete',
                expand: ['latest_invoice.payment_intent']
            });

            subscriptions[userId] = {
                planId,
                status: stripeSubscription.status,
                stripeCustomerId: customerId,
                stripeSubscriptionId: stripeSubscription.id,
                currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
                createdAt: new Date().toISOString()
            };
            saveData(SUBSCRIPTIONS_PATH, subscriptions);

            return {
                success: true,
                subscription: getUserSubscription(userId),
                clientSecret: stripeSubscription.latest_invoice?.payment_intent?.client_secret
            };
        } catch (error) {
            console.error('Stripe subscription error:', error);
            throw new Error(`Payment failed: ${error.message}`);
        }
    }

    // Demo mode - create subscription without payment
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    subscriptions[userId] = {
        planId,
        status: 'active',
        currentPeriodEnd: periodEnd.toISOString(),
        createdAt: new Date().toISOString(),
        demoMode: true
    };
    saveData(SUBSCRIPTIONS_PATH, subscriptions);

    return { success: true, subscription: getUserSubscription(userId), demoMode: true };
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (userId) => {
    const subscriptions = loadData(SUBSCRIPTIONS_PATH, {});
    const sub = subscriptions[userId];

    if (!sub || sub.planId === 'free') {
        return { success: true, message: 'No active subscription to cancel' };
    }

    if (stripe && sub.stripeSubscriptionId) {
        try {
            await stripe.subscriptions.update(sub.stripeSubscriptionId, {
                cancel_at_period_end: true
            });
        } catch (error) {
            console.error('Stripe cancel error:', error);
        }
    }

    sub.cancelAtPeriodEnd = true;
    sub.canceledAt = new Date().toISOString();
    saveData(SUBSCRIPTIONS_PATH, subscriptions);

    return { success: true, subscription: getUserSubscription(userId) };
};

/**
 * Handle Stripe webhook events
 */
export const handleStripeWebhook = async (payload, signature) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
        throw new Error('Stripe not configured');
    }

    const event = stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
    const subscriptions = loadData(SUBSCRIPTIONS_PATH, {});

    switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const userId = Object.keys(subscriptions).find(
                id => subscriptions[id].stripeSubscriptionId === subscription.id
            );

            if (userId) {
                subscriptions[userId].status = subscription.status;
                subscriptions[userId].currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

                if (subscription.status === 'canceled') {
                    subscriptions[userId].planId = 'free';
                }

                saveData(SUBSCRIPTIONS_PATH, subscriptions);
            }
            break;
        }

        case 'invoice.payment_succeeded': {
            const invoice = event.data.object;
            recordTransaction({
                type: 'subscription',
                amount: invoice.amount_paid / 100,
                currency: invoice.currency,
                stripeInvoiceId: invoice.id,
                userId: invoice.metadata?.userId
            });
            break;
        }

        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            console.error(`Payment failed for invoice ${invoice.id}`);
            break;
        }
    }

    return { received: true };
};

// ============================================
// USAGE TRACKING
// ============================================

/**
 * Get user's usage for current period
 */
export const getUserUsage = (userId) => {
    const usage = loadData(USAGE_PATH, {});
    const userUsage = usage[userId] || {};

    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return {
        period: periodKey,
        videosGenerated: userUsage[periodKey]?.videosGenerated || 0,
        storageUsed: userUsage.storageUsed || 0,
        apiCalls: userUsage[periodKey]?.apiCalls || 0,
        lastUpdated: userUsage[periodKey]?.lastUpdated || null
    };
};

/**
 * Track video generation
 */
export const trackVideoGeneration = (userId, videoData = {}) => {
    const usage = loadData(USAGE_PATH, {});
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (!usage[userId]) usage[userId] = {};
    if (!usage[userId][periodKey]) {
        usage[userId][periodKey] = { videosGenerated: 0, apiCalls: 0 };
    }

    usage[userId][periodKey].videosGenerated += 1;
    usage[userId][periodKey].lastUpdated = now.toISOString();

    // Track storage
    if (videoData.fileSize) {
        usage[userId].storageUsed = (usage[userId].storageUsed || 0) + videoData.fileSize;
    }

    saveData(USAGE_PATH, usage);

    return getUserUsage(userId);
};

/**
 * Track API call
 */
export const trackApiCall = (userId) => {
    const usage = loadData(USAGE_PATH, {});
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (!usage[userId]) usage[userId] = {};
    if (!usage[userId][periodKey]) {
        usage[userId][periodKey] = { videosGenerated: 0, apiCalls: 0 };
    }

    usage[userId][periodKey].apiCalls += 1;
    saveData(USAGE_PATH, usage);
};

/**
 * Check if user can generate video based on plan limits
 */
export const checkUsageLimits = (userId) => {
    const subscription = getUserSubscription(userId);
    const usage = getUserUsage(userId);
    const limits = subscription.plan.features;

    const canGenerate = limits.videosPerMonth === -1 ||
                        usage.videosGenerated < limits.videosPerMonth;

    return {
        canGenerate,
        videosRemaining: limits.videosPerMonth === -1
            ? 'unlimited'
            : Math.max(0, limits.videosPerMonth - usage.videosGenerated),
        usage,
        limits: {
            videosPerMonth: limits.videosPerMonth,
            maxVideoDuration: limits.maxVideoDuration,
            platforms: limits.platforms
        }
    };
};

// ============================================
// AFFILIATE MANAGEMENT
// ============================================

/**
 * Create affiliate account
 */
export const createAffiliate = (userId, details = {}) => {
    const affiliates = loadData(AFFILIATES_PATH, {});

    if (affiliates[userId]) {
        return { success: false, error: 'Affiliate account already exists' };
    }

    const affiliateCode = crypto.randomBytes(6).toString('hex').toUpperCase();

    affiliates[userId] = {
        code: affiliateCode,
        createdAt: new Date().toISOString(),
        status: 'active',
        commissionRate: 0.20, // 20% default
        paypalEmail: details.paypalEmail || null,
        earnings: {
            total: 0,
            pending: 0,
            paid: 0
        },
        referrals: [],
        payouts: []
    };

    saveData(AFFILIATES_PATH, affiliates);

    return { success: true, affiliate: affiliates[userId] };
};

/**
 * Get affiliate account
 */
export const getAffiliate = (userId) => {
    const affiliates = loadData(AFFILIATES_PATH, {});
    return affiliates[userId] || null;
};

/**
 * Track affiliate referral
 */
export const trackReferral = (affiliateCode, referredUserId, planId) => {
    const affiliates = loadData(AFFILIATES_PATH, {});

    // Find affiliate by code
    const affiliateUserId = Object.keys(affiliates).find(
        id => affiliates[id].code === affiliateCode
    );

    if (!affiliateUserId) {
        return { success: false, error: 'Invalid affiliate code' };
    }

    const affiliate = affiliates[affiliateUserId];
    const plan = PLANS[planId];

    if (!plan || plan.price === 0) {
        return { success: false, error: 'No commission for free plan' };
    }

    const commission = plan.price * affiliate.commissionRate;

    affiliate.referrals.push({
        userId: referredUserId,
        planId,
        commission,
        createdAt: new Date().toISOString(),
        status: 'pending'
    });

    affiliate.earnings.total += commission;
    affiliate.earnings.pending += commission;

    saveData(AFFILIATES_PATH, affiliates);

    return { success: true, commission };
};

/**
 * Get affiliate stats
 */
export const getAffiliateStats = (userId) => {
    const affiliate = getAffiliate(userId);

    if (!affiliate) {
        return null;
    }

    const now = new Date();
    const thisMonth = affiliate.referrals.filter(r => {
        const date = new Date(r.createdAt);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });

    return {
        code: affiliate.code,
        referralLink: `${process.env.APP_URL || 'https://viralshorts.app'}/?ref=${affiliate.code}`,
        earnings: affiliate.earnings,
        totalReferrals: affiliate.referrals.length,
        monthlyReferrals: thisMonth.length,
        monthlyEarnings: thisMonth.reduce((sum, r) => sum + r.commission, 0),
        commissionRate: affiliate.commissionRate * 100 + '%',
        status: affiliate.status
    };
};

/**
 * Request affiliate payout
 */
export const requestPayout = (userId, amount) => {
    const affiliates = loadData(AFFILIATES_PATH, {});
    const affiliate = affiliates[userId];

    if (!affiliate) {
        return { success: false, error: 'No affiliate account' };
    }

    if (amount > affiliate.earnings.pending) {
        return { success: false, error: 'Insufficient pending balance' };
    }

    if (amount < 50) {
        return { success: false, error: 'Minimum payout is $50' };
    }

    if (!affiliate.paypalEmail) {
        return { success: false, error: 'PayPal email not set' };
    }

    const payout = {
        id: crypto.randomUUID(),
        amount,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        paypalEmail: affiliate.paypalEmail
    };

    affiliate.payouts.push(payout);
    affiliate.earnings.pending -= amount;

    saveData(AFFILIATES_PATH, affiliates);

    return { success: true, payout };
};

// ============================================
// TRANSACTION HISTORY
// ============================================

/**
 * Record a transaction
 */
const recordTransaction = (transaction) => {
    const transactions = loadData(TRANSACTIONS_PATH, []);

    transactions.push({
        id: crypto.randomUUID(),
        ...transaction,
        createdAt: new Date().toISOString()
    });

    saveData(TRANSACTIONS_PATH, transactions);
};

/**
 * Get user's transaction history
 */
export const getTransactionHistory = (userId, limit = 50) => {
    const transactions = loadData(TRANSACTIONS_PATH, []);

    return transactions
        .filter(t => t.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
};

// ============================================
// BILLING PORTAL
// ============================================

/**
 * Create Stripe billing portal session
 */
export const createBillingPortalSession = async (userId, returnUrl) => {
    const subscriptions = loadData(SUBSCRIPTIONS_PATH, {});
    const sub = subscriptions[userId];

    if (!stripe || !sub?.stripeCustomerId) {
        return {
            success: false,
            error: 'Billing portal not available',
            demoMode: true
        };
    }

    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: sub.stripeCustomerId,
            return_url: returnUrl
        });

        return { success: true, url: session.url };
    } catch (error) {
        console.error('Billing portal error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Create Stripe checkout session
 */
export const createCheckoutSession = async (userId, planId, successUrl, cancelUrl) => {
    const plan = PLANS[planId];

    if (!plan || !plan.stripePriceId) {
        return { success: false, error: 'Invalid plan or Stripe not configured' };
    }

    if (!stripe) {
        return { success: false, error: 'Stripe not configured', demoMode: true };
    }

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [{
                price: plan.stripePriceId,
                quantity: 1
            }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: { userId, planId }
        });

        return { success: true, url: session.url, sessionId: session.id };
    } catch (error) {
        console.error('Checkout session error:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// EXPORTS
// ============================================

export default {
    PLANS,
    getUserSubscription,
    createSubscription,
    cancelSubscription,
    handleStripeWebhook,
    getUserUsage,
    trackVideoGeneration,
    trackApiCall,
    checkUsageLimits,
    createAffiliate,
    getAffiliate,
    trackReferral,
    getAffiliateStats,
    requestPayout,
    getTransactionHistory,
    createBillingPortalSession,
    createCheckoutSession
};
