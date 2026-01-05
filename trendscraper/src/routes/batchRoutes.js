/**
 * Batch Routes
 * Bulk video generation and processing
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import batchController from '../controllers/batchController.js';

const router = Router();

// POST /batch/generate - Generate batch of videos
router.post('/generate', asyncHandler(batchController.generate));

// GET /batch/queue - Get batch queue
router.get('/queue', asyncHandler(batchController.getQueue));

// POST /batch/schedule - Schedule batch processing
router.post('/schedule', asyncHandler(batchController.updateSchedule));

// POST /batch/process - Process batch queue
router.post('/process', asyncHandler(batchController.process));

// POST /batch/auto-run - Auto-run batch generation
router.post('/auto-run', asyncHandler(batchController.autoRun));

// DELETE /batch/queue - Clear batch queue
router.delete('/queue', asyncHandler(batchController.clearQueue));

// GET /batch/analytics - Get batch analytics
router.get('/analytics', asyncHandler(batchController.getAnalytics));

export default router;
