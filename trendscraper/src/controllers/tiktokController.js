/**
 * TikTok Controller
 * TikTok Cloud API integration
 */
import tiktokAPI from '../modules/uploaders/tiktok_api_uploader.js';
import tiktokAnalytics from '../modules/analytics/tiktok_analytics.js';
import { generateAllPlatformsContent } from '../modules/social_content.js';

const tiktokController = {
    getAuthUrl: async (req, res) => {
        const userId = req.user.id;
        const authUrl = tiktokAPI.getAuthUrl(userId);

        // Start OAuth server to receive callback
        tiktokAPI.startOAuthServer()
            .then(result => console.log(`   ✅ [User: ${userId}] TikTok API authorized!`))
            .catch(err => console.log(`   ⚠️ [User: ${userId}] OAuth flow cancelled or timed out`));

        res.json({ authUrl });
    },

    getStatus: async (req, res) => {
        const userId = req.user.id;
        const status = await tiktokAPI.checkTikTokAPIStatus(userId);
        res.json({
            connected: status.authorized,
            username: status.creator?.username,
            ...status
        });
    },

    getCreatorInfo: async (req, res) => {
        const userId = req.user.id;
        const info = await tiktokAPI.getCreatorInfo(userId);
        res.json(info);
    },

    upload: async (req, res) => {
        const userId = req.user.id;
        const { videoPath, title, hashtags = [] } = req.body;
        if (!videoPath) {
            return res.status(400).json({ error: "videoPath is required" });
        }

        console.log(`📤 [User: ${userId}] TikTok upload: ${videoPath}`);
        const result = await tiktokAPI.uploadToTikTokAPI(userId, videoPath, {
            title: title || "Video",
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

        const content = await generateAllPlatformsContent(topic, niche);
        const ttContent = content.tiktok;

        const result = await tiktokAPI.uploadToTikTokAPI(userId, videoPath, {
            title: ttContent.title,
            hashtags: ttContent.hashtags
        });

        res.json({ ...result, seoContent: ttContent });
    },

    disconnect: async (req, res) => {
        const userId = req.user.id;
        const result = await tiktokAPI.disconnectTikTokAPI(userId);
        res.json(result);
    },

    pullAnalytics: async (req, res) => {
        const userId = req.user.id;
        console.log(`📊 [User: ${userId}] Pulling TikTok analytics...`);
        const data = await tiktokAnalytics.fetchVideoStats();

        res.json({
            platform: 'tiktok',
            ...data,
            lastUpdated: new Date().toISOString()
        });
    }
};

export default tiktokController;
