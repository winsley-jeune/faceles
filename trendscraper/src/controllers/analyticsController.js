/**
 * Analytics Controller
 * AI Marketing Executive - Multi-platform performance analysis
 *
 * Platform-specific Game Theory Strategies:
 * - YouTube: MINIMAX - Maximize minimum views, avoid flops
 * - Facebook: TIT-FOR-TAT - Consistency builds trust, regular posting
 * - Instagram: NASH EQUILIBRIUM - Balance follower vs reach content
 * - TikTok: Uses exploration/exploitation based on virality
 */
import youtubeAnalytics from '../modules/analytics/youtube_analytics.js';
import facebookAnalytics from '../modules/analytics/facebook_analytics.js';
import instagramAnalytics from '../modules/analytics/instagram_analytics.js';
import geminiAnalyst from '../modules/analytics/gemini_analyst.js';
import contentConfig from '../modules/analytics/content_config.js';
import trainingData from '../modules/analytics/training_data.js';
import crossPlatform from '../modules/analytics/cross_platform.js';
import viralIntelligence from '../modules/analytics/viral_intelligence.js';
import crossPlatformIntelligence from '../modules/analytics/cross_platform_intelligence.js';
import retentionOptimizer from '../modules/analytics/retention_optimizer.js';

const analyticsController = {
    /**
     * GET /analytics/videos
     * Fetch current video stats from YouTube channel
     */
    getVideos: async (req, res) => {
        const userId = req.user.id;
        const { platform = 'youtube' } = req.query;

        if (platform === 'youtube') {
            const data = await youtubeAnalytics.fetchAllVideoStats(userId);
            res.json({ platform: 'youtube', strategy: 'minimax', ...data });
        } else if (platform === 'facebook') {
            const data = await facebookAnalytics.fetchReelsStats(userId);
            res.json({ platform: 'facebook', strategy: 'tit-for-tat', ...data });
        } else if (platform === 'instagram') {
            const data = await instagramAnalytics.fetchReelsStats(userId);
            res.json({ platform: 'instagram', strategy: 'nash-equilibrium', ...data });
        } else {
            // Default: YouTube
            const data = await youtubeAnalytics.fetchAllVideoStats(userId);
            res.json({ platform: 'youtube', strategy: 'minimax', ...data });
        }
    },

    /**
     * GET /analytics/health
     * Quick health check with AI analysis
     */
    getHealth: async (req, res) => {
        const userId = req.user.id;
        const data = await youtubeAnalytics.fetchAllVideoStats(userId);
        const health = await geminiAnalyst.quickHealthCheck(data.summary);
        res.json({ summary: data.summary, health });
    },

    /**
     * POST /analytics/weekly-analysis
     * Run full weekly analysis - updates patterns, config, and training data
     */
    runWeeklyAnalysis: async (req, res) => {
        const userId = req.user.id;
        const { platform = 'youtube' } = req.body;
        console.log(`📊 Starting weekly analysis for ${platform}...`);

        // Fetch platform-specific data
        let data, updatePatternsFn, calculateScoreFn;

        if (platform === 'youtube') {
            data = await youtubeAnalytics.fetchAllVideoStats(userId);
            updatePatternsFn = youtubeAnalytics.updateWinningPatterns;
            calculateScoreFn = youtubeAnalytics.calculateMinimaxScore;
        } else if (platform === 'facebook') {
            data = await facebookAnalytics.fetchReelsStats(userId);
            updatePatternsFn = facebookAnalytics.updateWinningPatterns;
            calculateScoreFn = facebookAnalytics.calculateTitForTatScore;
        } else if (platform === 'instagram') {
            data = await instagramAnalytics.fetchReelsStats(userId);
            updatePatternsFn = instagramAnalytics.updateWinningPatterns;
            calculateScoreFn = instagramAnalytics.calculateNashScore;
        } else {
            data = await youtubeAnalytics.fetchAllVideoStats(userId);
            updatePatternsFn = youtubeAnalytics.updateWinningPatterns;
            calculateScoreFn = youtubeAnalytics.calculateMinimaxScore;
        }

        // Save snapshot
        await youtubeAnalytics.saveAnalyticsSnapshot(userId, data);
        const weekOverWeek = await youtubeAnalytics.getWeekOverWeekComparison(userId);

        // Run Gemini AI analysis
        const analysis = await geminiAnalyst.analyzeWeeklyPerformance({
            ...data,
            weekOverWeek,
            platform
        });

        await youtubeAnalytics.saveAnalysis(userId, analysis);
        const videoIdeas = await geminiAnalyst.generateVideoIdeas(analysis, 5);

        // Update content generation config
        console.log('Updating content generation config...');
        const updatedConfig = await contentConfig.updateFromAnalysis(userId, analysis);

        // Update winning patterns for this platform
        console.log(`Updating ${platform} winning patterns...`);
        if (updatePatternsFn && data.videos) {
            await updatePatternsFn(userId, data.videos);
        }

        // Sync performance to training data
        console.log('Syncing performance to training data...');
        let trainingSynced = 0;
        const samples = await trainingData.loadAllSamples(userId);

        for (const video of data.videos || []) {
            const sample = samples.find(s =>
                s.platformVariants?.[platform]?.videoId === video.videoId
            );

            if (sample && !sample.performance?.[platform]) {
                const scoreResult = calculateScoreFn ? calculateScoreFn(video) : { score: 0, label: 'UNKNOWN' };
                await trainingData.updatePerformance(userId, sample.id, platform, {
                    views: video.stats?.views || 0,
                    likes: video.stats?.likes || 0,
                    comments: video.stats?.comments || 0,
                    shares: video.stats?.shares || 0,
                    score: scoreResult.score,
                    label: scoreResult.label
                });
                trainingSynced++;
            }
        }

        res.json({
            success: true,
            platform,
            analysis,
            videoIdeas,
            trainingSynced,
            configUpdated: !!updatedConfig
        });
    },

    /**
     * GET /analytics/history
     * Get analytics history snapshots
     */
    getHistory: async (req, res) => {
        const userId = req.user.id;
        const history = await youtubeAnalytics.loadAnalyticsHistory(userId);
        res.json(history);
    },

    /**
     * POST /analytics/compare
     * Compare performance between two periods
     */
    compare: async (req, res) => {
        const userId = req.user.id;
        const { period1, period2 } = req.body;
        const comparison = await youtubeAnalytics.comparePeriods(userId, period1, period2);
        res.json(comparison);
    },

    /**
     * POST /analytics/generate-ideas
     * Generate video ideas based on performance analysis
     */
    generateIdeas: async (req, res) => {
        const userId = req.user.id;
        const { count = 5 } = req.body;
        const data = await youtubeAnalytics.fetchAllVideoStats(userId);
        const ideas = await geminiAnalyst.generateVideoIdeas(data, count);
        res.json({ ideas });
    },

    /**
     * POST /analytics/auto-generate
     * Auto-generate content recommendation based on analytics
     */
    autoGenerate: async (req, res) => {
        const userId = req.user.id;
        const { niche = 'general' } = req.body;
        const data = await youtubeAnalytics.fetchAllVideoStats(userId);
        const analysis = await geminiAnalyst.analyzeWeeklyPerformance(data);
        const ideas = await geminiAnalyst.generateVideoIdeas(analysis, 3);

        res.json({
            niche,
            analysis: analysis.summary,
            recommendedTopics: ideas
        });
    },

    /**
     * GET /analytics/config
     * Get current content config
     */
    getConfig: async (req, res) => {
        const userId = req.user.id;
        const config = await contentConfig.loadConfig(userId);
        res.json(config);
    },

    /**
     * GET /analytics/best-niche
     * Get best performing niche from YouTube data
     */
    getBestNiche: async (req, res) => {
        const userId = req.user.id;
        const bestNiche = await youtubeAnalytics.getBestNiche(userId);
        res.json(bestNiche);
    },

    /**
     * GET /analytics/optimal-strategy
     * Get optimal content strategy
     */
    getOptimalStrategy: async (req, res) => {
        const userId = req.user.id;
        const strategy = await contentConfig.getOptimalStrategy(userId);
        res.json(strategy);
    },

    /**
     * GET /analytics/viral-intelligence
     * Get viral intelligence analysis with emotion mapping
     */
    getViralIntelligence: async (req, res) => {
        const userId = req.user.id;
        const data = await youtubeAnalytics.fetchAllVideoStats(userId);
        const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, data.videos);
        const viralData = viralIntelligence.analyzeForOutliers(data.videos, emotionMap);
        res.json(viralData);
    },

    /**
     * GET /analytics/outliers
     * Get viral outliers (videos performing 3x+ above average)
     */
    getOutliers: async (req, res) => {
        const userId = req.user.id;
        const data = await youtubeAnalytics.fetchAllVideoStats(userId);
        const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, data.videos);
        const viralData = viralIntelligence.analyzeForOutliers(data.videos, emotionMap);
        res.json({
            outliers: viralData.outliers,
            avgViews: viralData.avgViews,
            threshold: viralData.outlierThreshold
        });
    },

    /**
     * GET /analytics/viral-scores
     * Get viral scores for all videos
     */
    getViralScores: async (req, res) => {
        const userId = req.user.id;
        const data = await youtubeAnalytics.fetchAllVideoStats(userId);
        const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, data.videos);
        const viralData = viralIntelligence.analyzeForOutliers(data.videos, emotionMap);
        res.json({
            videos: viralData.topVideos,
            avgViews: viralData.avgViews
        });
    },

    /**
     * GET /analytics/recommended-pattern
     * Get AI-recommended pattern based on viral intelligence
     */
    getRecommendedPattern: async (req, res) => {
        const userId = req.user.id;
        const data = await youtubeAnalytics.fetchAllVideoStats(userId);
        const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, data.videos);
        const viralData = viralIntelligence.analyzeForOutliers(data.videos, emotionMap);
        const recommendation = await viralIntelligence.getRecommendedPattern(userId, viralData);
        res.json(recommendation);
    },

    /**
     * GET /analytics/killed-patterns
     * Get patterns that have failed too many times
     */
    getKilledPatterns: async (req, res) => {
        const userId = req.user.id;
        const patterns = await viralIntelligence.loadViralData(userId);
        res.json({ killedPatterns: patterns.killedPatterns });
    },

    /**
     * GET /analytics/config/prompt
     * Get AI-optimized prompt enhancement
     */
    getPromptConfig: async (req, res) => {
        const userId = req.user.id;
        const prompt = await contentConfig.getStoryboardEnhancement(userId);
        res.json({ prompt });
    },

    /**
     * POST /analytics/config/reset
     * Reset content config to defaults
     */
    resetConfig: async (req, res) => {
        const userId = req.user.id;
        await contentConfig.resetConfig(userId);
        res.json({ success: true, message: "Config reset" });
    },

    /**
     * GET /analytics/next-video
     * Get recommendation for next video
     */
    getNextVideo: async (req, res) => {
        const userId = req.user.id;
        const recommendation = await contentConfig.getNextVideoRecommendation(userId);
        res.json(recommendation);
    },

    /**
     * POST /analytics/cross-platform
     * Get cross-platform analytics summary
     */
    crossPlatform: async (req, res) => {
        const userId = req.user.id;
        const summary = await crossPlatform.getCrossPlatformSummary(userId);
        res.json(summary);
    },

    /**
     * GET /analytics/patterns
     * Get universal winning patterns across all platforms
     */
    getPatterns: async (req, res) => {
        const userId = req.user.id;
        const patterns = await crossPlatform.getUniversalWinners(userId);
        res.json(patterns);
    },

    /**
     * GET /analytics/recommendation
     * Get content recommendation based on cross-platform data
     */
    getRecommendation: async (req, res) => {
        const userId = req.user.id;
        const recommendation = await crossPlatform.getContentRecommendation(userId);
        res.json(recommendation);
    },

    /**
     * GET /analytics/unified-prompt
     * Get unified prompt enhancement for all platforms
     */
    getUnifiedPrompt: async (req, res) => {
        const userId = req.user.id;
        const prompt = await crossPlatform.generateUnifiedPrompt(userId);
        res.json({ prompt });
    },

    /**
     * GET /analytics/prompt/:platform
     * Get platform-specific prompt enhancement
     */
    getPlatformPrompt: async (req, res) => {
        const userId = req.user.id;
        const { platform } = req.params;
        const prompt = await crossPlatform.getPlatformPrompt(userId, platform);
        res.json({ platform, prompt });
    },

    // ===========================================
    // CROSS-PLATFORM INTELLIGENCE
    // ===========================================

    /**
     * GET /analytics/cross-platform/summary
     * Get cross-platform intelligence summary
     */
    getCrossPlatformSummary: async (req, res) => {
        const userId = req.user.id;
        const summary = await crossPlatformIntelligence.getCrossPlatformSummary(userId);
        res.json(summary);
    },

    /**
     * GET /analytics/cross-platform/recommendations/:niche
     * Get recommendations for a specific niche across platforms
     */
    getCrossPlatformRecommendations: async (req, res) => {
        const userId = req.user.id;
        const { niche } = req.params;
        const recommendations = await crossPlatformIntelligence.getCrossPlatformRecommendations(userId, niche);
        res.json(recommendations);
    },

    /**
     * GET /analytics/cross-platform/best-times
     * Get best posting times based on cross-platform data
     */
    getBestPostingTimes: async (req, res) => {
        const userId = req.user.id;
        const { platform } = req.query;
        const times = await crossPlatformIntelligence.getBestPostingTimes(userId, platform || null);
        res.json(times);
    },

    /**
     * GET /analytics/cross-platform/universal-winners
     * Get patterns that work across multiple platforms
     */
    getUniversalWinners: async (req, res) => {
        const userId = req.user.id;
        const winners = await crossPlatformIntelligence.getUniversalWinners(userId);
        res.json(winners);
    },

    /**
     * POST /analytics/cross-platform/record
     * Record video performance for cross-platform learning
     */
    recordCrossPlatformPerformance: async (req, res) => {
        const userId = req.user.id;
        const videoData = req.body;
        const result = await crossPlatformIntelligence.recordCrossPlatformPerformance(userId, videoData);
        res.json(result);
    },

    /**
     * GET /analytics/cross-platform/suggest-platform
     * Suggest best platform for a topic/niche
     */
    suggestPlatformForTopic: async (req, res) => {
        const userId = req.user.id;
        const { niche, topic } = req.query;
        const suggestion = await crossPlatformIntelligence.suggestPlatformForTopic(userId, niche, topic);
        res.json(suggestion);
    },

    // ===========================================
    // RETENTION OPTIMIZER
    // ===========================================

    /**
     * GET /analytics/retention/summary
     * Get overall retention analytics summary
     */
    getRetentionSummary: async (req, res) => {
        const userId = req.user.id;
        const summary = await retentionOptimizer.getRetentionSummary(userId);
        res.json(summary);
    },

    /**
     * GET /analytics/retention/optimal-duration/:platform
     * Get optimal video duration for a platform
     */
    getOptimalDuration: async (req, res) => {
        const userId = req.user.id;
        const { platform } = req.params;
        const duration = await retentionOptimizer.getOptimalDuration(userId, platform);
        res.json(duration);
    },

    /**
     * GET /analytics/retention/best-hooks/:platform?
     * Get best performing hooks by retention
     */
    getBestRetentionHooks: async (req, res) => {
        const userId = req.user.id;
        const { platform } = req.params;
        const hooks = await retentionOptimizer.getBestRetentionHooks(userId, platform || null);
        res.json(hooks);
    },

    /**
     * GET /analytics/retention/drop-offs/:platform?
     * Get common drop-off points
     */
    getCommonDropOffs: async (req, res) => {
        const userId = req.user.id;
        const { platform } = req.params;
        const dropOffs = await retentionOptimizer.getCommonDropOffs(userId, platform || null);
        res.json(dropOffs);
    },

    /**
     * GET /analytics/retention/recommendations/:platform
     * Get storyboard recommendations based on retention data
     */
    getRetentionRecommendations: async (req, res) => {
        const userId = req.user.id;
        const { platform } = req.params;
        const recommendations = await retentionOptimizer.getStoryboardRecommendations(userId, platform);
        res.json(recommendations);
    },

    /**
     * POST /analytics/retention/track
     * Track retention metrics for a video
     */
    trackVideoRetention: async (req, res) => {
        const userId = req.user.id;
        const videoData = req.body;
        const result = await retentionOptimizer.trackVideoRetention(userId, videoData);
        res.json({ success: true, record: result });
    },

    /**
     * POST /analytics/retention/score
     * Calculate retention score for video metrics
     */
    calculateRetentionScore: async (req, res) => {
        const userId = req.user.id;
        const { metrics, platform } = req.body;
        const score = await retentionOptimizer.calculateRetentionScore(userId, metrics, platform || 'youtube');
        res.json(score);
    }
};

export default analyticsController;
