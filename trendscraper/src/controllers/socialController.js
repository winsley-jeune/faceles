/**
 * Social Controller
 * Auto-poster and social media management
 */
import autoPoster from '../modules/auto_poster.js';

const socialController = {
    login: async (req, res) => {
        const { platform } = req.params;
        console.log(`🔐 Logging in to ${platform}...`);

        const result = await autoPoster.loginToPlatform(platform);
        res.json(result);
    },

    loginAll: async (req, res) => {
        console.log('🔐 Logging in to all platforms...');

        const results = await autoPoster.loginToAllPlatforms();
        res.json({
            success: true,
            results
        });
    },

    getSessions: async (req, res) => {
        const sessions = await autoPoster.checkSessions();
        res.json({
            success: true,
            sessions
        });
    },

    addToQueue: async (req, res) => {
        const { videoPath, topic, niche = 'general', platforms } = req.body;

        if (!videoPath || !topic) {
            return res.status(400).json({ error: 'videoPath and topic are required' });
        }

        const result = await autoPoster.addToQueue({
            videoPath,
            topic,
            niche,
            platforms
        });

        res.json(result);
    },

    getQueue: async (req, res) => {
        const queue = await autoPoster.getQueue();
        res.json({
            success: true,
            queue
        });
    },

    getHistory: async (req, res) => {
        const history = await autoPoster.getHistory();
        res.json({
            success: true,
            history
        });
    },

    postNow: async (req, res) => {
        const { videoPath, topic, niche = 'general' } = req.body;

        if (!videoPath || !topic) {
            return res.status(400).json({ error: 'videoPath and topic are required' });
        }

        console.log(`📤 Posting now: ${topic}`);
        const results = await autoPoster.postNow(videoPath, topic, niche);

        res.json({
            success: true,
            results
        });
    },

    postToPlatform: async (req, res) => {
        const { platform } = req.params;
        const { videoPath, topic, niche = 'general' } = req.body;

        if (!videoPath || !topic) {
            return res.status(400).json({ error: 'videoPath and topic are required' });
        }

        console.log(`📤 Posting to ${platform}: ${topic}`);
        const result = await autoPoster.postToPlatform(platform, videoPath, topic, niche);

        res.json(result);
    },

    processQueue: async (req, res) => {
        console.log('⏳ Processing queue...');
        const result = await autoPoster.processNext();

        res.json(result);
    },

    getSettings: async (req, res) => {
        const settings = await autoPoster.getSettings();
        res.json({
            success: true,
            settings
        });
    },

    updateSettings: async (req, res) => {
        const settings = req.body;
        const result = await autoPoster.updateSettings(settings);

        res.json(result);
    },

    startScheduler: async (req, res) => {
        const result = await autoPoster.startScheduler();
        res.json(result);
    },

    stopScheduler: async (req, res) => {
        const result = await autoPoster.stopScheduler();
        res.json(result);
    }
};

export default socialController;
