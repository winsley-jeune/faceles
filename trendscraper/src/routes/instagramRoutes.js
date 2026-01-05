/**
 * Instagram API Routes
 * Instagram Graph API integration for Reels
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import instagramController from '../controllers/instagramController.js';

const router = Router();

// Apply authentication to all Instagram routes
router.use(requireAuth);

// GET /instagram-api/status - Check Instagram API connection status
router.get('/status', asyncHandler(instagramController.getStatus));

// GET /instagram-api/account-id - Get Instagram Business Account ID
router.get('/account-id', asyncHandler(instagramController.getAccountId));

// GET /instagram-api/media - Get Instagram media
router.get('/media', asyncHandler(instagramController.getMedia));

// POST /instagram-api/upload - Upload video to Instagram
router.post('/upload', asyncHandler(instagramController.upload));

// POST /instagram-api/upload-smart - Upload with auto-generated SEO content
router.post('/upload-smart', asyncHandler(instagramController.uploadSmart));

// POST /instagram-api/refresh-token - Refresh Instagram/Facebook token
router.post('/refresh-token', asyncHandler(instagramController.refreshToken));

// POST /instagram-api/pull-analytics - Pull Instagram analytics
router.post('/pull-analytics', asyncHandler(instagramController.pullAnalytics));

export default router;
