/**
 * Social Routes
 * Auto-poster and social media management
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import socialController from '../controllers/socialController.js';

const router = Router();

// POST /social/login/:platform - Login to a platform
router.post('/login/:platform', asyncHandler(socialController.login));

// POST /social/login-all - Login to all platforms
router.post('/login-all', asyncHandler(socialController.loginAll));

// GET /social/sessions - Check session status for all platforms
router.get('/sessions', asyncHandler(socialController.getSessions));

// POST /social/queue - Add video to posting queue
router.post('/queue', asyncHandler(socialController.addToQueue));

// GET /social/queue - Get posting queue
router.get('/queue', asyncHandler(socialController.getQueue));

// GET /social/history - Get posting history
router.get('/history', asyncHandler(socialController.getHistory));

// POST /social/post-now - Post immediately to all platforms
router.post('/post-now', asyncHandler(socialController.postNow));

// POST /social/post/:platform - Post to specific platform
router.post('/post/:platform', asyncHandler(socialController.postToPlatform));

// POST /social/process-queue - Process next item in queue
router.post('/process-queue', asyncHandler(socialController.processQueue));

// GET /social/settings - Get settings
router.get('/settings', asyncHandler(socialController.getSettings));

// POST /social/settings - Update settings
router.post('/settings', asyncHandler(socialController.updateSettings));

// POST /social/scheduler/start - Start scheduler
router.post('/scheduler/start', asyncHandler(socialController.startScheduler));

// POST /social/scheduler/stop - Stop scheduler
router.post('/scheduler/stop', asyncHandler(socialController.stopScheduler));

export default router;
