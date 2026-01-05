/**
 * Variations Routes
 * Content variation engine for multiplying winning content
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import variationsController from '../controllers/variationsController.js';

const router = Router();

// Apply authentication to all variation routes
router.use(requireAuth);

// POST /variations/generate - Generate variations from a winning video
router.post('/generate', asyncHandler(variationsController.generate));

// GET /variations/queue - Get variation queue
router.get('/queue', asyncHandler(variationsController.getQueue));

// GET /variations/next - Get next variation to process
router.get('/next', asyncHandler(variationsController.getNext));

// POST /variations/process - Process next variation
router.post('/process', asyncHandler(variationsController.process));

// GET /variations/schedule - Get variation schedule
router.get('/schedule', asyncHandler(variationsController.getSchedule));

// POST /variations/schedule - Update variation schedule
router.post('/schedule', asyncHandler(variationsController.updateSchedule));

// GET /variations/should-post - Check if should post variation
router.get('/should-post', asyncHandler(variationsController.shouldPost));

export default router;
