/**
 * Smart Generation Routes
 * Analytics-driven video generation with no duplicates
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import smartController from '../controllers/smartController.js';

const router = Router();

// Apply authentication to all smart generation routes
router.use(requireAuth);

// GET /smart/topic - Get smart topic recommendation based on analytics
router.get('/topic', asyncHandler(smartController.getTopic));

// GET /smart/patterns - Get pattern analysis from analytics
router.get('/patterns', asyncHandler(smartController.getPatterns));

// POST /smart/create-and-post - Create video using smart topic + post to YouTube (LEGACY - synchronous)
router.post('/create-and-post', asyncHandler(smartController.createAndPost));

// POST /smart/create-job - Create background video generation job (NEW - async, non-blocking)
router.post('/create-job', asyncHandler(smartController.createJob));

// POST /smart/check-duplicate - Check if topic would be duplicate
router.post('/check-duplicate', asyncHandler(smartController.checkDuplicate));

export default router;
