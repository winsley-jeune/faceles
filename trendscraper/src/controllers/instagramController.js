/**
 * Instagram Controller
 * Instagram Graph API integration for Reels
 * Strategy: NASH EQUILIBRIUM - Balance follower vs reach content
 */
import instagramAPI from '../modules/uploaders/instagram_api_uploader.js';
import instagramAnalytics from '../modules/analytics/instagram_analytics.js';
import { generateAllPlatformsContent } from '../modules/social_content.js';

const instagramController = {
    getStatus: async (req, res) => {
        const userId = req.user.id;
        const status = await instagramAPI.checkInstagramAPIStatus(userId);
        res.json({
            connected: status.authorized && status.connected,
            username: status.instagram?.username,
            accountId: status.instagram?.id,
            ...status
        });
    },

    getAccountId: async (req, res) => {
        const userId = req.user.id;
        try {
            const account = await instagramAPI.getInstagramAccountId(userId);
            res.json({ success: true, account });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    },

    getMedia: async (req, res) => {
        const userId = req.user.id;
        const { limit = 10 } = req.query;
        try {
            const media = await instagramAPI.getInstagramMedia(userId, parseInt(limit));
            res.json(media);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    upload: async (req, res) => {
        const userId = req.user.id;
        const { videoPath, caption, hashtags = [] } = req.body;
        if (!videoPath) {
            return res.status(400).json({ error: "videoPath is required" });
        }

        console.log(`📤 [User: ${userId}] Instagram upload: ${videoPath}`);
        const result = await instagramAPI.uploadToInstagramAPI(userId, videoPath, {
            caption: caption || "",
            hashtags
        });
        res.json(result);
    },

    uploadSmart: async (req, res) => {
        const userId = req.user.id;
        const { videoPath, topic, niche = "general" } = req.body;
        if (!videoPath || !topic) {
            return res.status(400).json({ error: "videoPath and topic are required" });
        }

        console.log(`📤 [User: ${userId}] Smart Instagram upload: ${topic}`);
        const content = await generateAllPlatformsContent(topic, niche);
        const igContent = content.instagram;

        const result = await instagramAPI.uploadToInstagramAPI(userId, videoPath, {
            caption: igContent.fullCaption || igContent.description,
            hashtags: igContent.hashtags
        });

        res.json({ ...result, seoContent: igContent });
    },

    refreshToken: async (req, res) => {
        const userId = req.user.id;
        try {
            const result = await instagramAPI.refreshToken(userId);
            res.json({ success: true, message: 'Token refreshed successfully' });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    },

    pullAnalytics: async (req, res) => {
        const userId = req.user.id;
        console.log(`📊 [User: ${userId}] Pulling Instagram analytics (NASH EQUILIBRIUM strategy)...`);
        const data = await instagramAnalytics.fetchReelsStats();

        const patterns = instagramAnalytics.loadWinningPatterns();
        const equilibrium = patterns.equilibrium || {};

        res.json({
            platform: 'instagram',
            strategy: 'nash-equilibrium',
            equilibrium,
            ...data,
            lastUpdated: new Date().toISOString()
        });
    }
};

export default instagramController;
