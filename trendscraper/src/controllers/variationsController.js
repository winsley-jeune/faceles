/**
 * Variations Controller
 * Variation engine for generating content variations from winners
 * Uses tone distribution: 40% edgy, 30% controversial, 30% safe
 */
import fs from 'fs';
import path from 'path';

import { generateNicheStoryboard } from '../modules/storyboard.js';
import { generateProImages } from '../modules/visuals_pro.js';
import { generateSmartVoice } from '../modules/voice_pro.js';
import { getMusicByEnergy } from '../modules/audio_pro.js';
import { renderVideo } from '../modules/renderer.js';
import { generateEstimatedSubtitles, alignSubtitlesToAudio } from '../modules/subtitle_sync.js';
import { generateAllPlatformsContent } from '../modules/social_content.js';

import variationEngine from '../modules/analytics/variation_engine.js';
import viralIntelligence from '../modules/analytics/viral_intelligence.js';
import youtubeAnalytics from '../modules/analytics/youtube_analytics.js';
import youtubeAPI from '../modules/uploaders/youtube_api_uploader.js';
import facebookAPI from '../modules/uploaders/facebook_api_uploader.js';

import env from '../config/env.js';

const VIDEOS_DIR = env.VIDEOS_DIR;

const variationsController = {
    generate: async (req, res) => {
        const userId = req.user.id;
        const { niche = 'general' } = req.body;
        console.log(`🔄 Generating variation batch for niche: ${niche}`);

        const { videos } = await youtubeAnalytics.fetchAllVideoStats(userId);
        const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);
        const viralData = viralIntelligence.analyzeForOutliers(videos, emotionMap);

        if (!viralData.topVideos || viralData.topVideos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No video data available. Upload some videos first.'
            });
        }

        const batch = await variationEngine.generateBatch(userId, viralData, niche);
        const queue = await variationEngine.loadVariationQueue(userId);

        res.json({
            success: true,
            message: `Generated ${batch.totalGenerated} topics`,
            variations: batch.variations,
            explorations: batch.explorations,
            sourceVideo: viralData.topVideos[0]?.title,
            queueSize: queue.variations.length
        });
    },

    getQueue: async (req, res) => {
        const userId = req.user.id;
        const queue = await variationEngine.loadVariationQueue(userId);
        const pending = queue.variations.filter(v => v.status === 'pending');
        const completed = queue.variations.filter(v => v.status === 'completed');

        res.json({
            success: true,
            total: queue.variations.length,
            pending: pending.length,
            completed: completed.length,
            stats: queue.stats,
            lastGenerated: queue.lastGenerated,
            variations: queue.variations.slice(-20)
        });
    },

    getNext: async (req, res) => {
        const userId = req.user.id;
        const next = await variationEngine.getNextPendingVariation(userId);

        if (!next) {
            return res.json({
                success: false,
                message: 'No pending variations. Generate more with POST /variations/generate'
            });
        }

        res.json({
            success: true,
            variation: next
        });
    },

    process: async (req, res) => {
        const userId = req.user.id;
        const { autoPost = true, platform = 'youtube' } = req.body;

        const variation = await variationEngine.getNextPendingVariation(userId);

        if (!variation) {
            return res.json({
                success: false,
                message: 'No pending variations. Generate more with POST /variations/generate'
            });
        }

        console.log(`🎬 Processing variation: "${variation.title}"`);

        await variationEngine.updateVariationStatus(userId, variation.id, 'in_progress');

        const niche = variation.niche || 'general';

        const storyboard = await generateNicheStoryboard(niche, variation.title);
        const fullScript = storyboard.map(s => s.text).join(" ");
        const imagePrompts = storyboard.map(s => s.image_prompt);
        const sceneTypes = storyboard.map(s => s.scene_type || 'body');

        const visualPaths = await generateProImages(imagePrompts, {
            topic: variation.title,
            sceneTypes,
            outputDir: VIDEOS_DIR
        });

        const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR);

        let energyLevel = 'medium';
        if (variation.tone === 'controversial') energyLevel = 'high';
        if (variation.tone === 'safe') energyLevel = 'low';

        const musicTrack = await getMusicByEnergy(energyLevel, VIDEOS_DIR);

        let subtitles = await alignSubtitlesToAudio(audioBase64, fullScript);
        if (!subtitles) subtitles = generateEstimatedSubtitles(storyboard);

        const result = await renderVideo({
            audioBase64,
            subtitles,
            visuals: visualPaths,
            storyboard,
            musicPath: musicTrack ? musicTrack.path : null,
            options: {
                subtitleStyle: variation.tone === 'controversial' ? 'viral' : 'clean',
                addVignette: variation.tone === 'controversial',
                addColorGrade: true,
                addTransitions: true,
                musicVolume: 0.10
            }
        });

        const safeTopic = variation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const timestamp = Date.now();
        const filename = `var_${variation.tone}_${safeTopic}_${timestamp}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);
        fs.copyFileSync(result.filePath, destPath);

        const metadata = await generateAllPlatformsContent(variation.title, niche);

        await variationEngine.updateVariationStatus(userId, variation.id, 'generated', {
            videoPath: destPath,
            generatedAt: new Date().toISOString()
        });

        result.cleanup();

        let postResult = null;
        if (autoPost) {
            console.log(`   📤 Auto-posting to ${platform}...`);
            if (platform === 'youtube') {
                postResult = await youtubeAPI.uploadToYouTubeAPI(userId, destPath, {
                    title: metadata.youtube.title,
                    description: metadata.youtube.description,
                    tags: metadata.youtube.hashtags
                });
            } else if (platform === 'facebook') {
                postResult = await facebookAPI.uploadToFacebookAPI(userId, destPath, {
                    description: metadata.facebook.description
                });
            }

            if (postResult?.success) {
                await variationEngine.updateVariationStatus(userId, variation.id, 'posted', {
                    postedAt: new Date().toISOString(),
                    platform,
                    videoId: postResult.videoId
                });
                await variationEngine.recordPost(userId);
            }
        }

        res.json({
            success: true,
            variation,
            videoPath: destPath,
            filename,
            posted: autoPost && postResult?.success,
            postResult
        });
    },

    getSchedule: async (req, res) => {
        const userId = req.user.id;
        const schedule = await variationEngine.loadSchedule(userId);
        res.json({ success: true, schedule });
    },

    updateSchedule: async (req, res) => {
        const userId = req.user.id;
        const { enabled, intervalHours, maxPostsPerDay, platforms, niche } = req.body;
        const schedule = await variationEngine.loadSchedule(userId);

        if (enabled !== undefined) schedule.enabled = enabled;
        if (intervalHours) schedule.intervalHours = intervalHours;
        if (maxPostsPerDay) schedule.maxPostsPerDay = maxPostsPerDay;
        if (platforms) schedule.platforms = platforms;
        if (niche) schedule.niche = niche;

        await variationEngine.saveSchedule(userId, schedule);

        res.json({
            success: true,
            message: schedule.enabled ? 'Schedule enabled' : 'Schedule disabled',
            schedule
        });
    },

    shouldPost: async (req, res) => {
        const userId = req.user.id;
        const shouldPost = await variationEngine.shouldPostNow(userId);
        const schedule = await variationEngine.loadSchedule(userId);

        res.json({
            success: true,
            shouldPost,
            schedule
        });
    }
};

export default variationsController;
