/**
 * Upload Controller
 * Unified upload interface for all platforms
 * Supports API-first with Puppeteer fallback
 */
import unifiedUploader from '../modules/unified_uploader.js';

const uploadController = {
    getStatus: async (req, res) => {
        const status = await unifiedUploader.getConnectionStatus();
        res.json({
            success: true,
            platforms: status,
            message: 'Use /upload/:platform to upload. API is preferred, Puppeteer is fallback.'
        });
    },

    uploadToPlatform: async (req, res) => {
        const { platform } = req.params;
        const { videoPath, title, description, caption, hashtags = [], usePuppeteer = false } = req.body;

        if (!videoPath) {
            return res.status(400).json({ error: 'videoPath is required' });
        }

        console.log(`📤 Unified upload to ${platform}: ${videoPath}`);

        const result = await unifiedUploader.upload(platform, videoPath, {
            title,
            description,
            caption,
            hashtags,
            usePuppeteer
        });

        res.json({
            success: result.success,
            platform,
            method: result.method,
            ...result
        });
    },

    uploadToAll: async (req, res) => {
        const { videoPath, title, description, caption, hashtags = [], platforms = ['youtube', 'tiktok', 'facebook', 'instagram'] } = req.body;

        if (!videoPath) {
            return res.status(400).json({ error: 'videoPath is required' });
        }

        console.log(`📤 Multi-platform upload: ${videoPath}`);

        const results = {};
        for (const platform of platforms) {
            try {
                results[platform] = await unifiedUploader.upload(platform, videoPath, {
                    title,
                    description,
                    caption,
                    hashtags
                });
            } catch (err) {
                results[platform] = { success: false, error: err.message };
            }
        }

        res.json({
            success: true,
            videoPath,
            results
        });
    }
};

export default uploadController;
