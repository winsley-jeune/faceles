/**
 * TikTok Smart Generation Routes
 * Analytics-driven content generation for TikTok
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import tiktokSmartController from '../controllers/tiktokSmartController.js';

const router = Router();

// Apply authentication to all TikTok smart routes
router.use(requireAuth);

// GET /tiktok/smart/topic - Get smart topic for TikTok
router.get('/topic', asyncHandler(tiktokSmartController.getTopic));

// GET /tiktok/smart/patterns - Get TikTok patterns
router.get('/patterns', asyncHandler(tiktokSmartController.getPatterns));

// POST /tiktok/smart/create-and-post - Create and post to TikTok
router.post('/create-and-post', asyncHandler(tiktokSmartController.createAndPost));

export default router;
