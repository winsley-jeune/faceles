/**
 * Facebook API Routes
 * Facebook Graph API integration for Reels
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import facebookController from '../controllers/facebookController.js';

const router = Router();

// Apply authentication to all Facebook routes
router.use(requireAuth);

// === Facebook API Routes ===

// GET /facebook-api/auth - Get Facebook authorization URL
router.get('/auth', asyncHandler(facebookController.getAuthUrl));

// GET /facebook-api/status - Check Facebook API connection status
router.get('/status', asyncHandler(facebookController.getStatus));

// GET /facebook-api/pages - Get available Facebook pages
router.get('/pages', asyncHandler(facebookController.getPages));

// POST /facebook-api/switch-page - Switch active Facebook page
router.post('/switch-page', asyncHandler(facebookController.switchPage));

// POST /facebook-api/upload - Upload video to Facebook
router.post('/upload', asyncHandler(facebookController.upload));

// POST /facebook-api/upload-smart - Upload with auto-generated SEO content
router.post('/upload-smart', asyncHandler(facebookController.uploadSmart));

// POST /facebook-api/disconnect - Disconnect Facebook API
router.post('/disconnect', asyncHandler(facebookController.disconnect));

// POST /facebook-api/pull-analytics - Pull Facebook analytics
router.post('/pull-analytics', asyncHandler(facebookController.pullAnalytics));

export default router;
