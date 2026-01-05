/**
 * PROMOTIONAL CONTENT ROUTES
 *
 * API routes for promotional content generation and configuration
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getPromoConfig,
    updatePromoConfig,
    generatePromoVideo,
    getPromoHistory,
    testPromoTopic,
    getNextPromoSchedule,
    getPromoStats,
    enablePromo,
    disablePromo
} from '../controllers/promoController.js';

const router = express.Router();

// Apply authentication to all promo routes
router.use(requireAuth);

// Configuration endpoints
router.get('/config', getPromoConfig);
router.put('/config', updatePromoConfig);
router.post('/enable', enablePromo);
router.post('/disable', disablePromo);

// Generation endpoints
router.post('/generate', generatePromoVideo);
router.post('/test-topic', testPromoTopic);

// Status & history endpoints
router.get('/history', getPromoHistory);
router.get('/next-schedule', getNextPromoSchedule);
router.get('/stats', getPromoStats);

export default router;
