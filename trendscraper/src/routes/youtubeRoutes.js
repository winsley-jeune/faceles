/**
 * YouTube API Routes
 * Official YouTube API integration (6 uploads/day limit)
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import youtubeController from '../controllers/youtubeController.js';

const router = Router();

// Apply authentication to all YouTube routes
router.use(requireAuth);

// GET /youtube-api/auth - Get YouTube API authorization URL
router.get('/auth', asyncHandler(youtubeController.getAuthUrl));
// POST /youtube-api/disconnect - Disconnect YouTube API
router.post('/disconnect', asyncHandler(youtubeController.disconnect));
// POST /youtube-api/exchange-code - Manual code exchange (fallback)
router.post('/exchange-code', asyncHandler(youtubeController.exchangeCode));

// GET /youtube-api/status - Check YouTube API connection status
router.get('/status', asyncHandler(youtubeController.getStatus));

// GET /youtube-api/quota - Get quota info
router.get('/quota', asyncHandler(youtubeController.getQuota));

// POST /youtube-api/upload - Upload video via YouTube API
router.post('/upload', asyncHandler(youtubeController.upload));
//review the SEO to optimize titles and description this play a big role on the video recoemendations by youtube.
// POST /youtube-api/upload-smart - Upload with auto-generated SEO content
router.post('/upload-smart', asyncHandler(youtubeController.uploadSmart));

// POST /youtube-api/pull-analytics - Pull YouTube analytics for dashboard
router.post('/pull-analytics', asyncHandler(youtubeController.pullAnalytics));

export default router;
