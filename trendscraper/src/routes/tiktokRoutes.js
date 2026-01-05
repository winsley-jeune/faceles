/**
 * TikTok API Routes
 * TikTok Cloud API integration
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import tiktokController from '../controllers/tiktokController.js';

const router = Router();

// Apply authentication to all TikTok routes
router.use(requireAuth);

// GET /tiktok-api/auth - Get TikTok authorization URL
router.get('/auth', asyncHandler(tiktokController.getAuthUrl));

// GET /tiktok-api/status - Check TikTok API connection status
router.get('/status', asyncHandler(tiktokController.getStatus));

// GET /tiktok-api/creator-info - Get creator info
router.get('/creator-info', asyncHandler(tiktokController.getCreatorInfo));

// POST /tiktok-api/upload - Upload video to TikTok
router.post('/upload', asyncHandler(tiktokController.upload));

// POST /tiktok-api/upload-smart - Upload with auto-generated SEO content
router.post('/upload-smart', asyncHandler(tiktokController.uploadSmart));

// POST /tiktok-api/disconnect - Disconnect TikTok API
router.post('/disconnect', asyncHandler(tiktokController.disconnect));

// POST /tiktok-api/pull-analytics - Pull TikTok analytics
router.post('/pull-analytics', asyncHandler(tiktokController.pullAnalytics));

export default router;
