/**
 * Job Routes
 * API endpoints for video generation job management
 */

import { Router } from 'express';
import jobController from '../controllers/jobController.js';
import { asyncHandler } from '../middleware/index.js';

const router = Router();

/**
 * @route   POST /jobs
 * @desc    Create a new video generation job
 * @access  Public (userId extracted from req.user if authenticated)
 * @body    { jobType, niche, topic, platforms, autoPost, priority }
 */
router.post('/', asyncHandler(jobController.createJob));

/**
 * @route   GET /jobs
 * @desc    List user's jobs (with filters)
 * @access  Private (requires authentication)
 * @query   ?status=queued&limit=50&offset=0
 */
router.get('/', asyncHandler(jobController.listJobs));

/**
 * @route   GET /jobs/stats
 * @desc    Get user's job statistics
 * @access  Private (requires authentication)
 */
router.get('/stats', asyncHandler(jobController.getStats));

/**
 * @route   GET /jobs/queue/stats
 * @desc    Get global queue statistics
 * @access  Public (for monitoring)
 */
router.get('/queue/stats', asyncHandler(jobController.getQueueStats));

/**
 * @route   GET /jobs/:id
 * @desc    Get job status and progress
 * @access  Public (ownership enforced if userId provided)
 */
router.get('/:id', asyncHandler(jobController.getJob));

/**
 * @route   POST /jobs/:id/cancel
 * @desc    Cancel a job
 * @access  Public (ownership enforced if userId provided)
 */
router.post('/:id/cancel', asyncHandler(jobController.cancelJob));

export default router;
