/**
 * A/B Testing Routes
 * Endpoints for experiment management and results tracking
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/index.js';
import { requireAuth } from '../middleware/auth.js';
import abTestingController from '../controllers/abTestingController.js';

const router = Router();

// Apply authentication to all A/B testing routes
router.use(requireAuth);

// ===========================================
// EXPERIMENT MANAGEMENT
// ===========================================

// GET /ab-testing/experiments - List experiments
router.get('/experiments', asyncHandler(abTestingController.getExperiments));

// GET /ab-testing/summary - Dashboard summary
router.get('/summary', asyncHandler(abTestingController.getSummary));

// POST /ab-testing/experiments - Create custom experiment
router.post('/experiments', asyncHandler(abTestingController.createExperiment));

// POST /ab-testing/experiments/hook - Create hook A/B test
router.post('/experiments/hook', asyncHandler(abTestingController.createHookExperiment));

// POST /ab-testing/experiments/visual - Create visual theme A/B test
router.post('/experiments/visual', asyncHandler(abTestingController.createVisualExperiment));

// POST /ab-testing/experiments/duration - Create duration A/B test
router.post('/experiments/duration', asyncHandler(abTestingController.createDurationExperiment));

// ===========================================
// RUNNING EXPERIMENTS
// ===========================================

// GET /ab-testing/experiments/:id/next-variant - Get next variant for even distribution
router.get('/experiments/:id/next-variant', asyncHandler(abTestingController.getNextVariant));

// POST /ab-testing/experiments/:id/assign - Assign video to variant
router.post('/experiments/:id/assign', asyncHandler(abTestingController.assignToExperiment));

// POST /ab-testing/results - Record video results
router.post('/results', asyncHandler(abTestingController.recordResults));

// ===========================================
// WINNERS & RECOMMENDATIONS
// ===========================================

// GET /ab-testing/winners - Get winning patterns
router.get('/winners', asyncHandler(abTestingController.getWinners));

// POST /ab-testing/apply-winners - Apply winners to weights
router.post('/apply-winners', asyncHandler(abTestingController.applyWinners));

// GET /ab-testing/recommendations - Get experiment recommendations
router.get('/recommendations', asyncHandler(abTestingController.getRecommendations));

export default router;
