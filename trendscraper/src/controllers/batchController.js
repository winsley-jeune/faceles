/**
 * Batch Controller
 * Auto-scaling variation engine with winner cloning
 * Generates batches: 10 variations from winner + 5 explorations
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
import tiktokAPI from '../modules/uploaders/tiktok_api_uploader.js';
import facebookAPI from '../modules/uploaders/facebook_api_uploader.js';
import instagramAPI from '../modules/uploaders/instagram_api_uploader.js';

import env from '../config/env.js';

const VIDEOS_DIR = env.VIDEOS_DIR;
const PORT = env.PORT;

const batchController = {
    generate: async (req, res) => {
        const userId = req.user.id;
        const { niche = 'general' } = req.body;
        console.log(`🚀 BATCH GENERATION REQUEST for niche: ${niche}`);

        const { videos } = await youtubeAnalytics.fetchAllVideoStats(userId);
        if (!videos || videos.length === 0) {
            return res.status(400).json({ error: 'No YouTube videos found for analysis' });
        }

        const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);
        const viralData = viralIntelligence.analyzeForOutliers(videos, emotionMap);

        const batch = await variationEngine.generateBatch(userId, viralData, niche);

        res.json({
            success: true,
            batch,
            queue: await variationEngine.loadVariationQueue(userId),
            schedule: await variationEngine.loadSchedule(userId)
        });
    },

    getQueue: async (req, res) => {
        const userId = req.user.id;
        const queue = await variationEngine.loadVariationQueue(userId);
        const schedule = await variationEngine.loadSchedule(userId);

        const pending = queue.variations.filter(v => v.status === 'pending').length;
        const scheduled = queue.variations.filter(v => v.status === 'scheduled').length;
        const posted = queue.variations.filter(v => v.status === 'posted').length;

        const toneDistribution = {
            safe: queue.variations.filter(v => v.tone === 'safe').length,
            edgy: queue.variations.filter(v => v.tone === 'edgy').length,
            controversial: queue.variations.filter(v => v.tone === 'controversial').length
        };

        res.json({
            queue,
            schedule,
            stats: { pending, scheduled, posted, total: queue.variations.length },
            toneDistribution,
            nextVariation: await variationEngine.getNextPendingVariation(userId)
        });
    },

    updateSchedule: async (req, res) => {
        const userId = req.user.id;
        const { enabled, intervalHours, maxPostsPerDay, platforms, niche } = req.body;
        const schedule = await variationEngine.loadSchedule(userId);

        if (enabled !== undefined) schedule.enabled = enabled;
        if (intervalHours !== undefined) schedule.intervalHours = intervalHours;
        if (maxPostsPerDay !== undefined) schedule.maxPostsPerDay = maxPostsPerDay;
        if (platforms !== undefined) schedule.platforms = platforms;
        if (niche !== undefined) schedule.niche = niche;

        await variationEngine.saveSchedule(userId, schedule);

        res.json({
            success: true,
            schedule,
            message: schedule.enabled
                ? `Auto-posting enabled: Every ${schedule.intervalHours} hours, max ${schedule.maxPostsPerDay}/day`
                : 'Auto-posting disabled'
        });
    },

    process: async (req, res) => {
        const userId = req.user.id;
        const { autoPost = true, platform = 'youtube' } = req.body;

        const schedule = await variationEngine.loadSchedule(userId);
        if (schedule.enabled && !await variationEngine.shouldPostNow(userId)) {
            return res.json({
                success: false,
                message: 'Not time to post yet',
                schedule,
                nextPost: schedule.nextPost
            });
        }

        const variation = await variationEngine.getNextPendingVariation(userId);
        if (!variation) {
            return res.json({
                success: false,
                message: 'No pending variations in queue. Generate a new batch first.',
                queue: await variationEngine.loadVariationQueue(userId)
            });
        }

        console.log(`🎬 Processing variation: "${variation.title}"`);
        console.log(`   Tone: ${variation.tone}, Hook: ${variation.hookType}, Emotion: ${variation.emotion}`);

        await variationEngine.updateVariationStatus(userId, variation.id, 'scheduled');

        const niche = schedule.niche || 'general';

        const { videos } = await youtubeAnalytics.fetchAllVideoStats(userId);
        const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);
        const viralData = viralIntelligence.analyzeForOutliers(videos, emotionMap);

        const storyboard = await generateNicheStoryboard(niche, variation.title, viralData);
        const imagePrompts = storyboard.map(s => s.image_prompt);
        const sceneTypes = storyboard.map(s => s.scene_type || 'body');

        const visualPaths = await generateProImages(imagePrompts, {
            topic: variation.title,
            sceneTypes,
            outputDir: VIDEOS_DIR
        });

        const fullScript = storyboard.map(s => s.text).join(' ');
        const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR);

        let energyLevel = 'medium';
        if (variation.emotion === 'shock' || variation.emotion === 'outrage') energyLevel = 'high';
        if (variation.emotion === 'curiosity' || variation.emotion === 'fear') energyLevel = 'low';
        const musicTrack = await getMusicByEnergy(energyLevel, VIDEOS_DIR);

        let subtitles = await alignSubtitlesToAudio(audioBase64, fullScript);
        if (!subtitles) subtitles = generateEstimatedSubtitles(storyboard);

        const result = await renderVideo({
            audioBase64, subtitles, visuals: visualPaths, storyboard,
            musicPath: musicTrack ? musicTrack.path : null,
            options: {
                subtitleStyle: 'viral',
                addVignette: true,
                addColorGrade: true,
                addTransitions: true,
                musicVolume: 0.10
            }
        });

        const safeTopic = variation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const timestamp = Date.now();
        const filename = `batch_${variation.tone}_${safeTopic}_${timestamp}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);
        fs.copyFileSync(result.filePath, destPath);

        const metadata = await generateAllPlatformsContent(variation.title, niche);

        await variationEngine.updateVariationStatus(userId, variation.id, 'generated', {
            videoPath: destPath,
            generatedAt: new Date().toISOString()
        });

        let postResult = null;

        if (autoPost) {
            console.log(`   📤 Uploading to ${platform}...`);

            if (platform === 'youtube') {
                postResult = await youtubeAPI.uploadToYouTubeAPI(userId, destPath, {
                    title: metadata.youtube.title,
                    description: metadata.youtube.description,
                    hashtags: metadata.youtube.hashtags,
                    tags: metadata.youtube.keywords || [],
                    categoryId: '22'
                });
            } else if (platform === 'tiktok') {
                postResult = await tiktokAPI.uploadToTikTokAPI(userId, destPath, {
                    title: metadata.tiktok.title,
                    hashtags: metadata.tiktok.hashtags
                });
            } else if (platform === 'facebook') {
                postResult = await facebookAPI.uploadToFacebookAPI(userId, destPath, {
                    title: metadata.facebook.title,
                    description: metadata.facebook.description
                });
            } else if (platform === 'instagram') {
                postResult = await instagramAPI.uploadToInstagramAPI(userId, destPath, {
                    caption: metadata.instagram.caption
                });
            }

            if (postResult?.success) {
                await variationEngine.updateVariationStatus(userId, variation.id, 'posted', {
                    postedAt: new Date().toISOString(),
                    platform,
                    postResult
                });
                await variationEngine.recordPost(userId);
                console.log(`   ✅ Posted successfully!`);
            }
        }

        result.cleanup();

        res.json({
            success: true,
            variation,
            videoPath: destPath,
            metadata,
            posted: postResult?.success || false,
            postResult,
            queue: await variationEngine.loadVariationQueue(userId),
            schedule: await variationEngine.loadSchedule(userId)
        });
    },

    autoRun: async (req, res) => {
        const userId = req.user.id;
        const schedule = await variationEngine.loadSchedule(userId);

        if (!schedule.enabled) {
            return res.json({ success: false, message: 'Auto-posting is disabled' });
        }

        if (!await variationEngine.shouldPostNow(userId)) {
            return res.json({
                success: false,
                message: 'Not time to post yet',
                nextPost: schedule.nextPost,
                postsToday: schedule.postsToday,
                maxPostsPerDay: schedule.maxPostsPerDay
            });
        }

        const queue = await variationEngine.loadVariationQueue(userId);
        const pendingCount = queue.variations.filter(v => v.status === 'pending').length;

        if (pendingCount < 3) {
            console.log('🔄 Queue low - generating new batch...');
            const { videos } = await youtubeAnalytics.fetchAllVideoStats(userId);
            const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);
            const viralData = viralIntelligence.analyzeForOutliers(videos, emotionMap);
            await variationEngine.generateBatch(userId, viralData, schedule.niche || 'general');
        }

        const response = await fetch(`http://localhost:${PORT}/batch/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.authorization || ''  // forward token: /batch/process is default-deny protected
            },
            body: JSON.stringify({
                autoPost: true,
                platform: schedule.platforms?.[0] || 'youtube'
            })
        });

        const result = await response.json();
        res.json(result);
    },

    clearQueue: (req, res) => {
        const queue = {
            variations: [],
            explorations: [],
            lastGenerated: null,
            stats: { totalGenerated: 0, totalPosted: 0, totalViews: 0 }
        };
        fs.writeFileSync(path.join(env.DATA_DIR, 'variation_queue.json'), JSON.stringify(queue, null, 2));
        res.json({ success: true, message: 'Queue cleared' });
    },

    getAnalytics: async (req, res) => {
        const userId = req.user.id;
        const queue = await variationEngine.loadVariationQueue(userId);
        const schedule = await variationEngine.loadSchedule(userId);

        // Calculate performance by tone
        const postedVariations = queue.variations.filter(v => v.status === 'posted');

        const tonePerformance = {
            safe: { count: 0, avgViews: 0, totalViews: 0 },
            edgy: { count: 0, avgViews: 0, totalViews: 0 },
            controversial: { count: 0, avgViews: 0, totalViews: 0 }
        };

        postedVariations.forEach(v => {
            if (v.performance?.views && tonePerformance[v.tone]) {
                tonePerformance[v.tone].count++;
                tonePerformance[v.tone].totalViews += v.performance.views;
            }
        });

        Object.keys(tonePerformance).forEach(tone => {
            if (tonePerformance[tone].count > 0) {
                tonePerformance[tone].avgViews = Math.round(
                    tonePerformance[tone].totalViews / tonePerformance[tone].count
                );
            }
        });

        res.json({
            queue: {
                total: queue.variations.length,
                pending: queue.variations.filter(v => v.status === 'pending').length,
                posted: postedVariations.length
            },
            schedule: {
                enabled: schedule.enabled,
                intervalHours: schedule.intervalHours,
                postsToday: schedule.postsToday,
                maxPostsPerDay: schedule.maxPostsPerDay,
                lastPost: schedule.lastPost,
                nextPost: schedule.nextPost
            },
            tonePerformance,
            stats: queue.stats
        });
    }
};

export default batchController;
