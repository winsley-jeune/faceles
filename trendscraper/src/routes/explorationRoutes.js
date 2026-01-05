/**
 * Exploration Routes
 * Exploit/Explore balance configuration
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import explorationController from '../controllers/explorationController.js';

const router = Router();

// Apply authentication to all exploration routes
router.use(requireAuth);

// GET /exploration/config - Get exploration config
router.get('/config', asyncHandler(explorationController.getConfig));

// GET /exploration/summary - Get exploration summary
router.get('/summary', asyncHandler(explorationController.getSummary));

// GET /exploration/platform/:platform - Get platform-specific config
router.get('/platform/:platform', asyncHandler(explorationController.getPlatformConfig));

// POST /exploration/update - Update exploration config
router.post('/update', asyncHandler(explorationController.updateSetting));

// POST /exploration/rate - Set exploration rate
router.post('/rate', asyncHandler(explorationController.setRate));

// POST /exploration/stupid-hustle - Toggle stupid hustle mode
router.post('/stupid-hustle', asyncHandler(explorationController.toggleStupidHustle));

// GET /exploration/test/:platform - Test exploration for platform
router.get('/test/:platform', asyncHandler(explorationController.test));

// POST /exploration/auto-adjust - Auto-adjust based on performance
router.post('/auto-adjust', asyncHandler(explorationController.autoAdjust));

// POST /exploration/reset - Reset exploration config
router.post('/reset', asyncHandler(explorationController.reset));

export default router;
