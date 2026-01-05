/**
 * YouTube Controller
 * Handles YouTube API integration (official API - 6 uploads/day)
 */
import path from 'path';
import fs from 'fs';

import youtubeAPI from '../modules/uploaders/youtube_api_uploader.js';
import youtubeAnalytics from '../modules/analytics/youtube_analytics.js';
import trainingData from '../modules/analytics/training_data.js';
import { generateAllPlatformsContent } from '../modules/social_content.js';
import { MINIMAX_THRESHOLDS } from '../config/constants.js';

const youtubeController = {
    /**
     * GET /youtube-api/auth
     * Get YouTube API authorization URL
     */
    getAuthUrl: async (req, res) => {
        const userId = req.user.id;
        const authUrl = youtubeAPI.getAuthUrl(userId);

        // Start OAuth server to receive callback
        youtubeAPI.startOAuthServer()
            .then(result => console.log(`   ✅ [User: ${userId}] YouTube API authorized!`))
            .catch(err => console.log(`   ⚠️ [User: ${userId}] OAuth flow cancelled or timed out`));

        res.json({
            message: "Visit the URL below to authorize YouTube API access",
            authUrl: authUrl,
            instructions: [
                "1. Click or copy the authUrl to your browser",
                "2. Login with your YouTube account",
                "3. Grant permissions to upload videos",
                "4. You'll be redirected back automatically"
            ]
        });
    },

    /**
     * GET /youtube-api/status
     * Check YouTube API connection status
     */
    getStatus: async (req, res) => {
        const userId = req.user.id;
        const status = await youtubeAPI.checkYouTubeAPIStatus(userId);
        const quota = youtubeAPI.getQuotaStatus();

        res.json({
            connected: status.authorized,
            channelName: status.channel?.title,
            channelId: status.channel?.id,
            thumbnail: status.channel?.thumbnail,
            message: status.message,
            quota,
            ...status
        });
    },

    /**
     * GET /youtube-api/quota
     * Get quota info
     */
    getQuota: async (req, res) => {
        res.json(youtubeAPI.getQuotaStatus());
    },

    /**
     * POST /youtube-api/upload
     * Upload video via YouTube API
     */
    upload: async (req, res) => {
        const userId = req.user.id;
        const { videoPath, title, description, hashtags = [], tags = [], categoryId, trainingSampleId } = req.body;

        if (!videoPath) {
            return res.status(400).json({ error: "videoPath is required" });
        }

        console.log(`📤 [User: ${userId}] YouTube API upload: ${videoPath}`);
        const result = await youtubeAPI.uploadToYouTubeAPI(userId, videoPath, {
            title: title || "Short Video #Shorts",
            description: description || "",
            hashtags,
            tags,
            categoryId: categoryId || "22"
        });

        // TODO: Re-implement training sample linking with database + userId
        // This requires implementing a proper database method to update platformVariants

        res.json(result);
    },

    /**
     * POST /youtube-api/upload-smart
     * Upload with auto-generated SEO content
     */
    uploadSmart: async (req, res) => {
        const userId = req.user.id;
        const { videoPath, topic, niche = "general", trainingSampleId } = req.body;

        if (!videoPath || !topic) {
            return res.status(400).json({ error: "videoPath and topic are required" });
        }

        console.log(`📤 [User: ${userId}] Smart YouTube API upload: ${topic}`);
        const content = await generateAllPlatformsContent(topic, niche);
        const ytContent = content.youtube;

        const result = await youtubeAPI.uploadToYouTubeAPI(userId, videoPath, {
            title: ytContent.title,
            description: ytContent.fullCaption || ytContent.description,
            hashtags: ytContent.hashtags,
            tags: ytContent.hashtags.map(h => h.replace('#', '')),
            categoryId: niche === 'tech' ? '28' : niche === 'psychology' ? '27' : '22'
        });

        // TODO: Re-implement training sample linking with database + userId
        // This requires implementing a proper database method to update platformVariants

        res.json({
            ...result,
            seoContent: ytContent
        });
    },

    /**
     * POST /youtube-api/exchange-code
     * Manual code exchange (fallback if redirect doesn't work)
     */
    exchangeCode: async (req, res) => {
        const userId = req.user.id;
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: "Authorization code is required" });
        }
        const result = await youtubeAPI.exchangeCode(userId, code);
        res.json(result);
    },

    /**
     * POST /youtube-api/disconnect
     * Disconnect YouTube API
     */
    disconnect: async (req, res) => {
        const userId = req.user.id;
        const result = await youtubeAPI.disconnectYouTubeAPI(userId);
        res.json(result);
    },

    /**
     * POST /youtube-api/pull-analytics
     * Pull YouTube analytics for dashboard with MINIMAX scoring
     */
    pullAnalytics: async (req, res) => {
        const userId = req.user.id;
        console.log(`📊 [User: ${userId}] Pulling YouTube analytics...`);

        const status = await youtubeAPI.checkYouTubeAPIStatus(userId);
        if (!status.authorized) {
            return res.status(401).json({ error: "YouTube not connected", videos: [], totalVideos: 0 });
        }

        const data = await youtubeAnalytics.fetchAllVideoStats();
        const videos = data.videos || [];

        // Calculate performance metrics using MINIMAX scoring
        let viralCount = 0;
        let goodCount = 0;
        let averageScore = 0;
        let totalWatchTime = 0;
        let totalCompletionRate = 0;
        let videosWithAnalytics = 0;

        const analyzedVideos = videos.map(video => {
            const views = video.stats?.views || 0;
            const likes = video.stats?.likes || 0;
            const comments = video.stats?.comments || 0;

            // MINIMAX score calculation
            let score = 0;
            if (views >= MINIMAX_THRESHOLDS.VIRAL) { score = 2; viralCount++; }
            else if (views >= MINIMAX_THRESHOLDS.GOOD) { score = 1; goodCount++; }
            else if (views >= MINIMAX_THRESHOLDS.AVERAGE) { score = 0; }
            else if (views >= MINIMAX_THRESHOLDS.POOR) { score = -1; }
            else { score = -2; }

            // Engagement bonus
            const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
            if (engagementRate >= 10) score += 0.5;
            else if (engagementRate >= 5) score += 0.25;

            averageScore += score;

            if (video.analytics?.avgViewDuration) {
                totalWatchTime += video.analytics.avgViewDuration;
                videosWithAnalytics++;
            }
            if (video.analytics?.avgViewPercentage) {
                totalCompletionRate += video.analytics.avgViewPercentage;
            }

            return {
                ...video,
                analysis: {
                    score: Math.max(-2, Math.min(2, score)),
                    label: score >= 1.5 ? 'VIRAL' : score >= 0.5 ? 'GOOD' : score >= -0.5 ? 'AVERAGE' : score >= -1.5 ? 'POOR' : 'FLOP',
                    metrics: { views, likes, comments, engagementRate: engagementRate.toFixed(2) }
                }
            };
        });

        averageScore = videos.length > 0 ? averageScore / videos.length : 0;

        const avgWatchTimeSeconds = videosWithAnalytics > 0 ? Math.round(totalWatchTime / videosWithAnalytics) : 0;
        const avgWatchTimeFormatted = `${Math.floor(avgWatchTimeSeconds / 60)}:${String(avgWatchTimeSeconds % 60).padStart(2, '0')}`;
        const avgCompletionRate = videosWithAnalytics > 0 ? Math.round(totalCompletionRate / videosWithAnalytics) : 0;

        res.json({
            platform: 'youtube',
            strategy: 'minimax',
            totalVideos: videos.length,
            viralCount,
            goodCount,
            averageScore,
            videos: analyzedVideos,
            summary: {
                ...data.summary,
                avgWatchTime: avgWatchTimeFormatted,
                avgCompletionRate,
                fetchedAt: new Date().toISOString()
            },
            lastUpdated: new Date().toISOString()
        });
    }
};

export default youtubeController;
