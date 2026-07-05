/**
 * Social Controller (API-only, multi-tenant)
 * Auto-poster and social-connection management. Posting is via official APIs,
 * scoped to req.user.id. Connecting a platform is done via OAuth at the
 * /{platform}-api/auth endpoints (not a backend browser "login").
 */
import autoPoster from '../modules/auto_poster.js';

const OAUTH_HINT = {
    success: false,
    message: 'Platform connection is via OAuth. Start the flow at /{platform}-api/auth (e.g. /youtube-api/auth) while authenticated.'
};

const socialController = {
    // Browser login is gone — connecting is OAuth. Kept for route compatibility.
    login: async (req, res) => res.status(410).json(OAUTH_HINT),
    loginAll: async (req, res) => res.status(410).json(OAUTH_HINT),

    getSessions: async (req, res) => {
        const sessions = await autoPoster.checkConnections(req.user.id);
        res.json({ success: true, sessions });
    },

    addToQueue: async (req, res) => {
        const { videoPath, topic, niche = 'general' } = req.body;
        if (!videoPath || !topic) {
            return res.status(400).json({ error: 'videoPath and topic are required' });
        }
        const result = await autoPoster.addToQueue(req.user.id, videoPath, topic, niche);
        res.json({ success: true, queueItem: result });
    },

    getQueue: async (req, res) => {
        const queue = autoPoster.getQueue().filter((q) => q.userId === req.user.id);
        res.json({ success: true, queue });
    },

    getHistory: async (req, res) => {
        const history = autoPoster.getHistory().filter((h) => h.userId === req.user.id);
        res.json({ success: true, history });
    },

    postNow: async (req, res) => {
        const { videoPath, topic, niche = 'general' } = req.body;
        if (!videoPath || !topic) {
            return res.status(400).json({ error: 'videoPath and topic are required' });
        }
        const results = await autoPoster.postNow(req.user.id, videoPath, topic, niche);
        res.json({ success: true, results });
    },

    postToPlatform: async (req, res) => {
        const { platform } = req.params;
        const { videoPath, topic, niche = 'general' } = req.body;
        if (!videoPath || !topic) {
            return res.status(400).json({ error: 'videoPath and topic are required' });
        }
        const queueItem = await autoPoster.addToQueue(req.user.id, videoPath, topic, niche);
        const result = await autoPoster.postToPlatform(req.user.id, queueItem, platform);
        res.json(result);
    },

    processQueue: async (req, res) => {
        const result = await autoPoster.processNextInQueue(req.user.id);
        res.json({ success: true, result });
    },

    getSettings: async (req, res) => {
        res.json({ success: true, settings: autoPoster.getSettings() });
    },

    updateSettings: async (req, res) => {
        res.json({ success: true, settings: autoPoster.saveSettings(req.body) });
    },

    // Global browser-scheduler removed — per-user scheduling is services/autoScheduler.js.
    startScheduler: async (req, res) => res.status(410).json({
        success: false,
        message: 'The global auto-poster scheduler was removed. Per-user scheduling runs via the background auto-scheduler; configure posting via /batch or your posting schedule.'
    }),
    stopScheduler: async (req, res) => res.status(410).json({
        success: false,
        message: 'The global auto-poster scheduler was removed.'
    })
};

export default socialController;
