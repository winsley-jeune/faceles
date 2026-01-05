/**
 * Instagram Smart Generation Routes
 * Analytics-driven content generation for Instagram
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import instagramSmartController from '../controllers/instagramSmartController.js';

const router = Router();

// Apply authentication to all Instagram smart routes
router.use(requireAuth);

// GET /instagram/smart/topic - Get smart topic for Instagram
router.get('/topic', asyncHandler(instagramSmartController.getTopic));

// GET /instagram/smart/patterns - Get Instagram patterns
router.get('/patterns', asyncHandler(instagramSmartController.getPatterns));

// POST /instagram/smart/create-and-post - Create and post to Instagram
router.post('/create-and-post', asyncHandler(instagramSmartController.createAndPost));

export default router;
