/**
 * Facebook Controller
 * Facebook Graph API integration for Reels
 * Strategy: TIT-FOR-TAT - Consistency builds trust
 */
import facebookAPI from '../modules/uploaders/facebook_api_uploader.js';
import facebookAnalytics from '../modules/analytics/facebook_analytics.js';
import { generateAllPlatformsContent } from '../modules/social_content.js';

const facebookController = {
    getAuthUrl: async (req, res) => {
        const userId = req.user.id;
        const authUrl = facebookAPI.getAuthUrl(userId);

        // Start OAuth server to receive callback
        facebookAPI.startOAuthServer()
            .then(result => console.log(`   ✅ [User: ${userId}] Facebook API authorized!`))
            .catch(err => console.log(`   ⚠️ [User: ${userId}] OAuth flow cancelled or timed out`));

        res.json({ authUrl });
    },

    getStatus: async (req, res) => {
        const userId = req.user.id;
        const status = await facebookAPI.checkFacebookAPIStatus(userId);
        res.json({
            connected: status.authorized,
            pageName: status.page?.name,
            pageId: status.page?.id,
            ...status
        });
    },

    getPages: async (req, res) => {
        const userId = req.user.id;
        const pages = await facebookAPI.getPages(userId);
        res.json(pages);
    },

    switchPage: async (req, res) => {
        const userId = req.user.id;
        const { pageId } = req.body;
        if (!pageId) {
            return res.status(400).json({ error: "pageId is required" });
        }
        const result = await facebookAPI.switchPage(userId, pageId);
        res.json(result);
    },

    upload: async (req, res) => {
        const userId = req.user.id;
        const { videoPath, title, description, hashtags = [] } = req.body;
        if (!videoPath) {
            return res.status(400).json({ error: "videoPath is required" });
        }

        console.log(`📤 [User: ${userId}] Facebook upload: ${videoPath}`);
        const result = await facebookAPI.uploadToFacebookAPI(userId, videoPath, {
            title: title || "Reel",
            description: description || "",
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

        console.log(`📤 [User: ${userId}] Smart Facebook upload: ${topic}`);
        const content = await generateAllPlatformsContent(topic, niche);
        const fbContent = content.facebook;

        const result = await facebookAPI.uploadToFacebookAPI(userId, videoPath, {
            title: fbContent.title,
            description: fbContent.fullCaption || fbContent.description,
            hashtags: fbContent.hashtags
        });

        res.json({ ...result, seoContent: fbContent });
    },

    disconnect: async (req, res) => {
        const userId = req.user.id;
        const result = await facebookAPI.disconnectFacebookAPI(userId);
        res.json(result);
    },

    pullAnalytics: async (req, res) => {
        const userId = req.user.id;
        console.log(`📊 [User: ${userId}] Pulling Facebook analytics (TIT-FOR-TAT strategy)...`);
        const data = await facebookAnalytics.fetchReelsStats();

        // Calculate TIT-FOR-TAT metrics
        const patterns = facebookAnalytics.loadWinningPatterns();
        const trustScore = patterns.trustScore || 0;

        res.json({
            platform: 'facebook',
            strategy: 'tit-for-tat',
            trustScore,
            ...data,
            lastUpdated: new Date().toISOString()
        });
    }
};

export default facebookController;
