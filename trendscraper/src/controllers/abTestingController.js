/**
 * A/B Testing Controller
 * Manages experiments, variants, and winner tracking
 */
import abTesting from '../modules/analytics/ab_testing.js';

const abTestingController = {
    /**
     * GET /ab-testing/experiments
     * List all experiments (active and completed)
     */
    getExperiments: async (req, res) => {
        const userId = req.user.id;
        const { platform, niche, status = 'active' } = req.query;

        if (status === 'active') {
            const experiments = await abTesting.getActiveExperiments(userId, platform, niche);
            res.json({ status: 'active', count: experiments.length, experiments });
        } else {
            const summary = await abTesting.getExperimentSummary(userId);
            res.json(summary);
        }
    },

    /**
     * GET /ab-testing/summary
     * Get overall A/B testing summary
     */
    getSummary: async (req, res) => {
        const userId = req.user.id;
        const summary = await abTesting.getExperimentSummary(userId);
        res.json(summary);
    },

    /**
     * POST /ab-testing/experiments
     * Create a new experiment
     */
    createExperiment: async (req, res) => {
        const userId = req.user.id;
        const { name, type, platform, niche, variants, targetSamples } = req.body;

        if (!name || !type || !platform || !variants || variants.length < 2) {
            return res.status(400).json({
                error: 'Invalid experiment config',
                required: ['name', 'type', 'platform', 'variants (min 2)']
            });
        }

        const experiment = await abTesting.createExperiment(userId, {
            name,
            type,
            platform,
            niche: niche || 'all',
            variants,
            targetSamples: targetSamples || 10
        });

        res.json({ success: true, experiment });
    },

    /**
     * POST /ab-testing/experiments/hook
     * Create a hook A/B test (which hook style performs best)
     */
    createHookExperiment: async (req, res) => {
        const userId = req.user.id;
        const { platform, niche, hooks } = req.body;

        if (!platform || !hooks || hooks.length < 2) {
            return res.status(400).json({
                error: 'Invalid config',
                required: ['platform', 'hooks (min 2 with name and config)']
            });
        }

        const experiment = await abTesting.createHookExperiment(userId, platform, niche || 'all', hooks);
        res.json({ success: true, experiment });
    },

    /**
     * POST /ab-testing/experiments/visual
     * Create a visual theme A/B test
     */
    createVisualExperiment: async (req, res) => {
        const userId = req.user.id;
        const { platform, themes } = req.body;

        if (!platform || !themes || themes.length < 2) {
            return res.status(400).json({
                error: 'Invalid config',
                required: ['platform', 'themes (min 2 theme names)']
            });
        }

        const experiment = await abTesting.createVisualExperiment(userId, platform, themes);
        res.json({ success: true, experiment });
    },

    /**
     * POST /ab-testing/experiments/duration
     * Create a video duration A/B test
     */
    createDurationExperiment: async (req, res) => {
        const userId = req.user.id;
        const { platform, durations } = req.body;

        if (!platform || !durations || durations.length < 2) {
            return res.status(400).json({
                error: 'Invalid config',
                required: ['platform', 'durations (min 2 numbers in seconds)']
            });
        }

        const experiment = await abTesting.createDurationExperiment(userId, platform, durations);
        res.json({ success: true, experiment });
    },

    /**
     * GET /ab-testing/experiments/:id/next-variant
     * Get the next variant to use for even distribution
     */
    getNextVariant: async (req, res) => {
        const userId = req.user.id;
        const { id } = req.params;
        const variant = await abTesting.getNextVariant(userId, id);

        if (!variant) {
            return res.status(404).json({ error: 'Experiment not found or not active' });
        }

        res.json({ variant });
    },

    /**
     * POST /ab-testing/experiments/:id/assign
     * Assign a video to an experiment variant
     */
    assignToExperiment: async (req, res) => {
        const userId = req.user.id;
        const { id } = req.params;
        const { videoId, variantId } = req.body;

        if (!videoId || !variantId) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['videoId', 'variantId']
            });
        }

        const result = await abTesting.assignToExperiment(userId, id, videoId, variantId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    },

    /**
     * POST /ab-testing/results
     * Record results for a video in an experiment
     */
    recordResults: async (req, res) => {
        const userId = req.user.id;
        const { experimentId, videoId, views, retention, avgChannelViews } = req.body;

        if (!experimentId || !videoId) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['experimentId', 'videoId']
            });
        }

        const result = await abTesting.recordExperimentResult(userId, experimentId, videoId, {
            views: views || 0,
            retention: retention || 0,
            avgChannelViews: avgChannelViews || 1000
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    },

    /**
     * GET /ab-testing/winners
     * Get all winning patterns from completed experiments
     */
    getWinners: async (req, res) => {
        const userId = req.user.id;
        const { type, platform } = req.query;
        const winners = await abTesting.getWinningPatterns(userId, type, platform);
        res.json({ count: winners.length, winners });
    },

    /**
     * POST /ab-testing/apply-winners
     * Apply winning patterns to performance weights (boost winners)
     */
    applyWinners: async (req, res) => {
        const userId = req.user.id;
        try {
            // Import performance weights dynamically
            const performanceWeights = (await import('../modules/analytics/performance_weights.js')).default;
            await abTesting.applyWinningPatterns(userId, performanceWeights);
            res.json({ success: true, message: 'Winning patterns applied to weights' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to apply winners', message: error.message });
        }
    },

    /**
     * GET /ab-testing/recommendations
     * Get recommendations for new experiments based on data gaps
     */
    getRecommendations: async (req, res) => {
        const userId = req.user.id;
        const { platform = 'youtube' } = req.query;

        const summary = await abTesting.getExperimentSummary(userId);
        const activeTypes = summary.experiments.map(e => e.type);

        const recommendations = [];

        // Recommend experiments not currently running
        if (!activeTypes.includes('hook')) {
            recommendations.push({
                type: 'hook',
                reason: 'No active hook experiments - test which hooks retain viewers best',
                suggestedVariants: [
                    { name: 'Question Hook', config: { style: 'question' } },
                    { name: 'Shock Hook', config: { style: 'shock' } },
                    { name: 'Story Hook', config: { style: 'story' } }
                ]
            });
        }

        if (!activeTypes.includes('duration')) {
            recommendations.push({
                type: 'duration',
                reason: 'No active duration experiments - find optimal video length',
                suggestedVariants: [30, 45, 60]
            });
        }

        if (!activeTypes.includes('visual')) {
            recommendations.push({
                type: 'visual',
                reason: 'No active visual experiments - test which themes perform best',
                suggestedVariants: ['cinematic', 'minimalist', 'vibrant', 'dark']
            });
        }

        res.json({
            platform,
            activeExperiments: summary.active,
            completedExperiments: summary.completed,
            recommendations
        });
    }
};

export default abTestingController;
