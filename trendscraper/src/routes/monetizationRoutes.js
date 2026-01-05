/**
 * Monetization Routes
 * Subscription, billing, usage tracking, and affiliate management
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import monetizationController from '../controllers/monetizationController.js';

const router = Router();

// ============================================
// PLANS
// ============================================

// GET /monetization/plans - Get all available plans
router.get('/plans', asyncHandler(monetizationController.getPlans));

// ============================================
// SUBSCRIPTIONS
// ============================================

// GET /monetization/subscription - Get current subscription
router.get('/subscription', asyncHandler(monetizationController.getSubscription));

// POST /monetization/subscribe - Subscribe to a plan
router.post('/subscribe', asyncHandler(monetizationController.subscribe));

// POST /monetization/cancel - Cancel subscription
router.post('/cancel', asyncHandler(monetizationController.cancelSubscription));

// POST /monetization/checkout - Create Stripe checkout session
router.post('/checkout', asyncHandler(monetizationController.createCheckout));

// POST /monetization/billing-portal - Create billing portal session
router.post('/billing-portal', asyncHandler(monetizationController.createBillingPortal));

// POST /monetization/webhook - Stripe webhook (needs raw body)
router.post('/webhook', asyncHandler(monetizationController.handleWebhook));

// ============================================
// USAGE
// ============================================

// GET /monetization/usage - Get usage stats
router.get('/usage', asyncHandler(monetizationController.getUsage));

// GET /monetization/check-limits - Check if user can generate
router.get('/check-limits', asyncHandler(monetizationController.checkLimits));

// POST /monetization/track-video - Track video generation
router.post('/track-video', asyncHandler(monetizationController.trackVideo));

// ============================================
// AFFILIATES
// ============================================

// GET /monetization/affiliate - Get affiliate account
router.get('/affiliate', asyncHandler(monetizationController.getAffiliate));

// POST /monetization/affiliate - Create affiliate account
router.post('/affiliate', asyncHandler(monetizationController.createAffiliate));

// PUT /monetization/affiliate/paypal - Update PayPal email
router.put('/affiliate/paypal', asyncHandler(monetizationController.updateAffiliatePaypal));

// POST /monetization/affiliate/track - Track referral (public)
router.post('/affiliate/track', asyncHandler(monetizationController.trackReferral));

// POST /monetization/affiliate/payout - Request payout
router.post('/affiliate/payout', asyncHandler(monetizationController.requestPayout));

// ============================================
// TRANSACTIONS
// ============================================

// GET /monetization/transactions - Get transaction history
router.get('/transactions', asyncHandler(monetizationController.getTransactions));

export default router;
