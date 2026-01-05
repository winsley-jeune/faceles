/**
 * Facebook Smart Generation Routes
 * Analytics-driven content generation for Facebook
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import facebookSmartController from '../controllers/facebookSmartController.js';

const router = Router();

// Apply authentication to all Facebook smart routes
router.use(requireAuth);

// GET /facebook/smart/topic - Get smart topic for Facebook
router.get('/topic', asyncHandler(facebookSmartController.getTopic));

// GET /facebook/smart/patterns - Get Facebook patterns
router.get('/patterns', asyncHandler(facebookSmartController.getPatterns));

// POST /facebook/smart/create-and-post - Create and post to Facebook
router.post('/create-and-post', asyncHandler(facebookSmartController.createAndPost));

export default router;
