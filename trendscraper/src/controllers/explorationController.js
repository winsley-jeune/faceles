/**
 * Exploration Controller
 * Exploration vs Exploitation configuration
 * Controls balance between proven patterns and new experiments
 */
import explorationConfig from '../modules/analytics/exploration_config.js';

const explorationController = {
    getConfig: async (req, res) => {
        const userId = req.user.id;
        const config = await explorationConfig.loadConfig(userId);
        res.json({
            success: true,
            config
        });
    },

    getSummary: async (req, res) => {
        const userId = req.user.id;
        const summary = await explorationConfig.getSummary(userId);
        res.json({
            success: true,
            summary
        });
    },

    getPlatformConfig: async (req, res) => {
        const userId = req.user.id;
        const { platform } = req.params;
        const platformConfig = await explorationConfig.getPlatformConfig(userId, platform);
        res.json({
            success: true,
            platform,
            config: platformConfig
        });
    },

    updateSetting: async (req, res) => {
        const userId = req.user.id;
        const { path, value } = req.body;
        if (!path) {
            return res.status(400).json({ error: 'Path required (e.g., "global.exploration_rate")' });
        }
        if (value === undefined) {
            return res.status(400).json({ error: 'Value required' });
        }

        const config = await explorationConfig.updateSetting(userId, path, value);
        res.json({
            success: true,
            message: `Updated ${path} to ${value}`,
            config
        });
    },

    setRate: async (req, res) => {
        const userId = req.user.id;
        const { rate } = req.body;
        if (rate === undefined || rate < 0 || rate > 1) {
            return res.status(400).json({ error: 'Rate must be between 0 and 1' });
        }

        const config = await explorationConfig.updateSetting(userId, 'global.exploration_rate', rate);
        res.json({
            success: true,
            message: `Global exploration rate set to ${rate * 100}%`,
            newRate: rate
        });
    },

    toggleStupidHustle: async (req, res) => {
        const userId = req.user.id;
        const { enabled, maxPerDay } = req.body;

        if (enabled !== undefined) {
            await explorationConfig.updateSetting(userId, 'stupid_hustle.enabled', enabled);
        }
        if (maxPerDay !== undefined) {
            await explorationConfig.updateSetting(userId, 'stupid_hustle.max_per_day', maxPerDay);
        }

        const config = await explorationConfig.loadConfig(userId);
        res.json({
            success: true,
            message: `Stupid hustle: ${config.stupid_hustle.enabled ? 'ENABLED' : 'DISABLED'}`,
            stupidHustle: config.stupid_hustle
        });
    },

    test: async (req, res) => {
        const userId = req.user.id;
        const { platform } = req.params;
        const explorationDecision = await explorationConfig.shouldExplore(userId, platform);
        const stupidHustleDecision = await explorationConfig.shouldBeStupidHustle(userId, platform);

        res.json({
            success: true,
            platform,
            exploration: explorationDecision,
            stupidHustle: stupidHustleDecision
        });
    },

    autoAdjust: async (req, res) => {
        const userId = req.user.id;
        const { viralRate, avgViews, trend } = req.body;

        if (viralRate === undefined) {
            return res.status(400).json({
                error: 'Performance data required: { viralRate, avgViews, trend }'
            });
        }

        const result = await explorationConfig.autoAdjustExploration(userId, {
            viralRate,
            avgViews: avgViews || 0,
            trend: trend || 'stable'
        });

        res.json({
            success: true,
            ...result
        });
    },

    reset: async (req, res) => {
        const userId = req.user.id;
        const config = await explorationConfig.resetToDefaults(userId);
        res.json({
            success: true,
            message: 'Exploration config reset to defaults',
            config
        });
    }
};

export default explorationController;
