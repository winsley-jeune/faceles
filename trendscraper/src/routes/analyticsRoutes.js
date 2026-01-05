/**
 * Analytics Routes
 * AI Marketing Executive - Performance analysis and insights
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import analyticsController from '../controllers/analyticsController.js';

const router = Router();

// Apply authentication to all analytics routes
router.use(requireAuth);

// GET /analytics/videos - Fetch current video stats
router.get('/videos', asyncHandler(analyticsController.getVideos));

// GET /analytics/health - Quick health check
router.get('/health', asyncHandler(analyticsController.getHealth));

// POST /analytics/weekly-analysis - Run full weekly analysis
router.post('/weekly-analysis', asyncHandler(analyticsController.runWeeklyAnalysis));

// GET /analytics/history - Get analytics history
router.get('/history', asyncHandler(analyticsController.getHistory));

// POST /analytics/compare - Compare performance periods
router.post('/compare', asyncHandler(analyticsController.compare));

// POST /analytics/generate-ideas - Generate video ideas from analysis
router.post('/generate-ideas', asyncHandler(analyticsController.generateIdeas));

// POST /analytics/auto-generate - Auto-generate content based on analytics
router.post('/auto-generate', asyncHandler(analyticsController.autoGenerate));

// GET /analytics/config - Get content config
router.get('/config', asyncHandler(analyticsController.getConfig));

// GET /analytics/best-niche - Get best performing niche
router.get('/best-niche', asyncHandler(analyticsController.getBestNiche));

// GET /analytics/optimal-strategy - Get optimal strategy
router.get('/optimal-strategy', asyncHandler(analyticsController.getOptimalStrategy));

// GET /analytics/viral-intelligence - Get viral intelligence data
router.get('/viral-intelligence', asyncHandler(analyticsController.getViralIntelligence));

// GET /analytics/outliers - Get viral outliers
router.get('/outliers', asyncHandler(analyticsController.getOutliers));

// GET /analytics/viral-scores - Get viral scores for all videos
router.get('/viral-scores', asyncHandler(analyticsController.getViralScores));

// GET /analytics/recommended-pattern - Get recommended pattern
router.get('/recommended-pattern', asyncHandler(analyticsController.getRecommendedPattern));

// GET /analytics/killed-patterns - Get killed/failed patterns
router.get('/killed-patterns', asyncHandler(analyticsController.getKilledPatterns));

// GET /analytics/config/prompt - Get prompt configuration
router.get('/config/prompt', asyncHandler(analyticsController.getPromptConfig));

// POST /analytics/config/reset - Reset content config
router.post('/config/reset', asyncHandler(analyticsController.resetConfig));

// GET /analytics/next-video - Get next recommended video
router.get('/next-video', asyncHandler(analyticsController.getNextVideo));

// POST /analytics/cross-platform - Cross-platform analysis
router.post('/cross-platform', asyncHandler(analyticsController.crossPlatform));

// GET /analytics/patterns - Get all patterns
router.get('/patterns', asyncHandler(analyticsController.getPatterns));

// GET /analytics/recommendation - Get content recommendation
router.get('/recommendation', asyncHandler(analyticsController.getRecommendation));

// GET /analytics/unified-prompt - Get unified prompt for all platforms
router.get('/unified-prompt', asyncHandler(analyticsController.getUnifiedPrompt));

// GET /analytics/prompt/:platform - Get platform-specific prompt
router.get('/prompt/:platform', asyncHandler(analyticsController.getPlatformPrompt));

// ===========================================
// CROSS-PLATFORM INTELLIGENCE
// ===========================================

// GET /analytics/cross-platform/summary - Get cross-platform intelligence summary
router.get('/cross-platform/summary', asyncHandler(analyticsController.getCrossPlatformSummary));

// GET /analytics/cross-platform/recommendations/:niche - Get niche recommendations
router.get('/cross-platform/recommendations/:niche', asyncHandler(analyticsController.getCrossPlatformRecommendations));

// GET /analytics/cross-platform/best-times - Get best posting times
router.get('/cross-platform/best-times', asyncHandler(analyticsController.getBestPostingTimes));

// GET /analytics/cross-platform/universal-winners - Get universal winning patterns
router.get('/cross-platform/universal-winners', asyncHandler(analyticsController.getUniversalWinners));

// POST /analytics/cross-platform/record - Record video performance
router.post('/cross-platform/record', asyncHandler(analyticsController.recordCrossPlatformPerformance));

// GET /analytics/cross-platform/suggest-platform - Suggest best platform for topic
router.get('/cross-platform/suggest-platform', asyncHandler(analyticsController.suggestPlatformForTopic));

// ===========================================
// RETENTION OPTIMIZER
// ===========================================

// GET /analytics/retention/summary - Get retention summary
router.get('/retention/summary', asyncHandler(analyticsController.getRetentionSummary));

// GET /analytics/retention/optimal-duration/:platform - Get optimal duration
router.get('/retention/optimal-duration/:platform', asyncHandler(analyticsController.getOptimalDuration));

// GET /analytics/retention/best-hooks - Get best hooks overall
router.get('/retention/best-hooks', asyncHandler(analyticsController.getBestRetentionHooks));

// GET /analytics/retention/best-hooks/:platform - Get best hooks for platform
router.get('/retention/best-hooks/:platform', asyncHandler(analyticsController.getBestRetentionHooks));

// GET /analytics/retention/drop-offs - Get common drop-offs overall
router.get('/retention/drop-offs', asyncHandler(analyticsController.getCommonDropOffs));

// GET /analytics/retention/drop-offs/:platform - Get drop-offs for platform
router.get('/retention/drop-offs/:platform', asyncHandler(analyticsController.getCommonDropOffs));

// GET /analytics/retention/recommendations/:platform - Get storyboard recommendations
router.get('/retention/recommendations/:platform', asyncHandler(analyticsController.getRetentionRecommendations));

// POST /analytics/retention/track - Track video retention
router.post('/retention/track', asyncHandler(analyticsController.trackVideoRetention));

// POST /analytics/retention/score - Calculate retention score
router.post('/retention/score', asyncHandler(analyticsController.calculateRetentionScore));

export default router;
