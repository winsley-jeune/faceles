/**
 * Auto-Scheduler Service
 * Background process that checks every 10 minutes for scheduled posts
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

// Promotional content modules
import { shouldGeneratePromo, recordPromoPost, getPromoStats } from '../config/promo_config.js';
import { generatePromoTopic } from '../modules/analytics/promo_topic_generator.js';
import promoBrandContext from '../modules/promo_brand_context.js';

import env from '../config/env.js';
import { logger } from '../utils/index.js';
import jobRepository from '../database/repositories/jobRepository.js';
import { isDatabaseAvailable } from '../database/db.js';

const VIDEOS_DIR = env.VIDEOS_DIR;
const AUTO_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes

let autoSchedulerRunning = false;
let schedulerInterval = null;

/**
 * Generate video directly (fallback when database unavailable)
 * This is the original auto-scheduler logic extracted into a function
 */
const generateVideoDirectly = async (variation, niche, platforms, schedule) => {
    try {
        // Fetch fresh viral data for storyboard context
        const { videos } = await youtubeAnalytics.fetchAllVideoStats();
        const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(videos);
        const viralData = viralIntelligence.analyzeForOutliers(videos, emotionMap);

        // Generate full video
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
        const filename = `auto_${variation.tone}_${safeTopic}_${timestamp}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);
        fs.copyFileSync(result.filePath, destPath);

        const metadata = await generateAllPlatformsContent(variation.title, niche);

        variationEngine.updateVariationStatus(variation.id, 'generated', {
            videoPath: destPath,
            generatedAt: new Date().toISOString()
        });

        // Post to ALL selected platforms
        const postResults = {};

        for (const platform of platforms) {
            logger.info(`   📤 Auto-uploading to ${platform}...`);

            let postResult = null;
            try {
                if (platform === 'youtube') {
                    postResult = await youtubeAPI.uploadToYouTubeAPI(destPath, {
                        title: metadata.youtube.title,
                        description: metadata.youtube.description,
                        hashtags: metadata.youtube.hashtags,
                        tags: metadata.youtube.keywords || [],
                        categoryId: '22'
                    });
                } else if (platform === 'tiktok') {
                    postResult = await tiktokAPI.uploadToTikTokAPI(destPath, {
                        title: metadata.tiktok.title,
                        hashtags: metadata.tiktok.hashtags
                    });
                } else if (platform === 'facebook') {
                    postResult = await facebookAPI.uploadToFacebookAPI(destPath, {
                        title: metadata.facebook.title,
                        description: metadata.facebook.description
                    });
                }

                postResults[platform] = postResult;

                if (postResult?.success) {
                    logger.info(`   ✅ ${platform.toUpperCase()}: Posted successfully`);
                } else {
                    logger.error(`   ❌ ${platform.toUpperCase()}: ${postResult?.error || 'Upload failed'}`);
                }
            } catch (err) {
                logger.error(`   ❌ ${platform.toUpperCase()}: ${err.message}`);
                postResults[platform] = { success: false, error: err.message };
            }
        }

        // Check if any platform succeeded
        const anySuccess = Object.values(postResults).some(r => r?.success);
        if (anySuccess) {
            variationEngine.updateVariationStatus(variation.id, 'posted', {
                postedAt: new Date().toISOString(),
                platforms: platforms,
                postResults
            });
            const successPlatforms = Object.entries(postResults)
                .filter(([_, r]) => r?.success)
                .map(([p]) => p)
                .join(', ');
            logger.info(`   ✅ AUTO-POST SUCCESS: "${variation.title}" to ${successPlatforms}`);
        } else {
            logger.error(`   ❌ Auto-post failed on all platforms`);
        }

        result.cleanup();
    } catch (err) {
        logger.error(`   ❌ Direct generation failed: ${err.message}`);
        throw err;
    }
};

/**
 * Generate and post promotional video
 * @param {Object} schedule - Variation engine schedule
 */
const generateAndPostPromotionalVideo = async (schedule) => {
    try {
        logger.info('🎬 Generating promotional video...');

        // Get promotional brand context
        const promoBrand = promoBrandContext.getPromoBrandContext();
        const promoBrandSummary = promoBrandContext.generatePromoBrandSummary();
        const promoContext = promoBrandContext.generatePromoPromptContext();

        // Generate promotional topic
        const promoTopicData = await generatePromoTopic({ useAI: true, platform: 'youtube' });
        const { topic, type } = promoTopicData;

        logger.info(`   🎯 Topic: "${topic}"`);
        logger.info(`   📊 Type: ${type}`);

        // Fetch viral data for storyboard context (optional, can reuse analytics)
        let viralData = null;
        try {
            const { videos } = await youtubeAnalytics.fetchAllVideoStats();
            if (videos && videos.length > 0) {
                const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(videos);
                viralData = viralIntelligence.analyzeForOutliers(videos, emotionMap);
            }
        } catch (err) {
            logger.warn('   ⚠️ Could not fetch viral data, proceeding without it');
        }

        // Generate storyboard with promotional brand context override
        const brandContextOverride = {
            summary: promoBrandSummary,
            context: promoContext,
            ctaTemplates: promoBrandContext.getPromoCTATemplates('direct-sales'),
            generateBrandSummary: () => promoBrandSummary,
            generatePromptContext: () => promoContext,
            getCTATemplates: (goal) => promoBrandContext.getPromoCTATemplates(goal || 'direct-sales')
        };

        const storyboard = await generateNicheStoryboard(
            'saas',
            topic,
            viralData,
            'youtube',
            brandContextOverride
        );

        // Generate visuals
        const imagePrompts = storyboard.map(s => s.image_prompt);
        const sceneTypes = storyboard.map(s => s.scene_type || 'body');
        const visualPaths = await generateProImages(imagePrompts, {
            topic: topic,
            sceneTypes,
            outputDir: VIDEOS_DIR
        });

        // Generate voice
        const fullScript = storyboard.map(s => s.text).join(' ');
        const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR);

        // Get music (promotional content typically uses medium energy)
        const musicTrack = await getMusicByEnergy('medium', VIDEOS_DIR);

        // Generate subtitles
        let subtitles = await alignSubtitlesToAudio(audioBase64, fullScript);
        if (!subtitles) subtitles = generateEstimatedSubtitles(storyboard);

        // Render video
        const result = await renderVideo({
            audioBase64,
            subtitles,
            visuals: visualPaths,
            storyboard,
            musicPath: musicTrack ? musicTrack.path : null,
            options: {
                subtitleStyle: 'viral',
                addVignette: true,
                addColorGrade: true,
                addTransitions: true,
                musicVolume: 0.10
            }
        });

        // Save video
        const safeTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const timestamp = Date.now();
        const filename = `promo_${type}_${safeTopic}_${timestamp}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);
        fs.copyFileSync(result.filePath, destPath);

        logger.info(`   ✅ Video generated: ${filename}`);

        // Generate platform-specific metadata
        const metadata = await generateAllPlatformsContent(topic, 'saas');

        // Upload to platforms
        const platforms = schedule.platforms?.length > 0 ? schedule.platforms : ['youtube'];
        const postResults = {};

        for (const platform of platforms) {
            logger.info(`   📤 Uploading to ${platform}...`);

            let postResult = null;
            try {
                if (platform === 'youtube') {
                    postResult = await youtubeAPI.uploadToYouTubeAPI(destPath, {
                        title: metadata.youtube.title,
                        description: metadata.youtube.description,
                        hashtags: metadata.youtube.hashtags,
                        tags: metadata.youtube.keywords || [],
                        categoryId: '22'
                    });
                } else if (platform === 'tiktok') {
                    postResult = await tiktokAPI.uploadToTikTokAPI(destPath, {
                        title: metadata.tiktok.title,
                        hashtags: metadata.tiktok.hashtags
                    });
                } else if (platform === 'facebook') {
                    postResult = await facebookAPI.uploadToFacebookAPI(destPath, {
                        title: metadata.facebook.title,
                        description: metadata.facebook.description
                    });
                }

                postResults[platform] = postResult;

                if (postResult?.success) {
                    logger.info(`   ✅ ${platform.toUpperCase()}: Posted successfully`);
                } else {
                    logger.error(`   ❌ ${platform.toUpperCase()}: ${postResult?.error || 'Upload failed'}`);
                }
            } catch (err) {
                logger.error(`   ❌ ${platform.toUpperCase()}: ${err.message}`);
                postResults[platform] = { success: false, error: err.message };
            }
        }

        // Record promotional post
        const anySuccess = Object.values(postResults).some(r => r?.success);
        if (anySuccess) {
            recordPromoPost({
                topic,
                type,
                videoPath: destPath,
                platforms,
                postResults
            });

            const successPlatforms = Object.entries(postResults)
                .filter(([_, r]) => r?.success)
                .map(([p]) => p)
                .join(', ');

            logger.info(`   🎉 PROMOTIONAL POST SUCCESS: "${topic}" to ${successPlatforms}`);
        } else {
            logger.error(`   ❌ Promotional post failed on all platforms`);
        }

        // Cleanup
        result.cleanup();

    } catch (err) {
        logger.error(`❌ Promotional video generation failed: ${err.message}`);
        logger.error(err.stack);
    }
};

const runAutoScheduler = async () => {
    if (autoSchedulerRunning) {
        logger.info('⏳ Auto-scheduler already running, skipping...');
        return;
    }

    try {
        autoSchedulerRunning = true;

        // DATABASE-ONLY MODE: Get all users with auto-posting enabled
        if (!isDatabaseAvailable()) {
            logger.warn('⚠️ Database unavailable - auto-scheduler requires database');
            return;
        }

        logger.info('🔄 Auto-scheduler check...');

        // Get all users with posting schedules enabled
        const { query } = await import('../database/db.js');
        const usersResult = await query(
            `SELECT DISTINCT u.id, u.email, u.name, us.setting_value as schedule
             FROM users u
             JOIN user_settings us ON u.id = us.user_id
             WHERE us.setting_key = 'posting_schedule'
             AND us.setting_value->>'enabled' = 'true'`
        );

        if (usersResult.rows.length === 0) {
            return; // Silent return if no users have auto-posting enabled
        }

        logger.info(`   👥 Checking ${usersResult.rows.length} user(s) with auto-posting enabled`);

        // Process each user
        for (const userRow of usersResult.rows) {
            const userId = userRow.id;
            const userName = userRow.name || userRow.email;
            const schedule = userRow.schedule;

            logger.info(`   📋 Checking ${userName}...`);

            try {
                // Check if it's time to post for this user
                const shouldPost = await variationEngine.shouldPostNow(userId);

                if (!shouldPost) {
                    const nextPost = schedule.nextPost ? new Date(schedule.nextPost).toLocaleTimeString() : 'N/A';
                    logger.info(`      ⏰ Next post: ${nextPost} (${schedule.postsToday || 0}/${schedule.maxPostsPerDay} today)`);
                    continue;
                }

                logger.info(`      ✅ Time to post for ${userName}!`);

                // Check if queue is low and regenerate
                const queue = await variationEngine.loadVariationQueue(userId);
                const pendingCount = queue.variations.filter(v => v.status === 'pending').length;

                if (pendingCount < 3) {
                    logger.info(`      🔄 Queue low - generating new batch...`);
                    const { videos } = await youtubeAnalytics.fetchAllVideoStats(userId);
                    if (videos && videos.length > 0) {
                        const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(videos);
                        const viralData = viralIntelligence.analyzeForOutliers(videos, emotionMap);
                        await variationEngine.generateBatch(userId, viralData, schedule.niche || 'general');
                    }
                }

                // Get next variation
                const variation = await variationEngine.getNextPendingVariation(userId);
                if (!variation) {
                    logger.info(`      ⚠️ No pending variations in queue`);
                    continue;
                }

                logger.info(`      🎬 Auto-processing: "${variation.title}"`);
                logger.info(`         Tone: ${variation.tone}, Emotion: ${variation.emotion}`);

                // Mark as scheduled
                await variationEngine.updateVariationStatus(userId, variation.id, 'scheduled');

                const niche = schedule.niche || 'general';
                const platforms = schedule.platforms?.length > 0 ? schedule.platforms : ['youtube'];

                // Create a job in the queue for tracking
                const job = await jobRepository.createJob({
                    userId: userId, // Associate with user for proper tracking
                    jobType: 'auto_variation',
                    inputParams: {
                        niche,
                        topic: variation.title,
                        variationId: variation.id,
                        tone: variation.tone,
                        emotion: variation.emotion,
                        platforms,
                        autoPost: true
                    },
                    priority: 1 // Higher priority for scheduled variations
                });

                logger.info(`      ✅ Job created: ${job.id}`);
                logger.info(`      📊 Track progress at /jobs`);

                // Record the post
                await variationEngine.recordPost(userId);

            } catch (userError) {
                logger.error(`      ❌ Error processing ${userName}: ${userError.message}`);
            }
        }

    } catch (err) {
        logger.error('❌ Auto-scheduler error:', err.message);
    } finally {
        autoSchedulerRunning = false;
    }
};

const autoScheduler = {
    start: () => {
        if (schedulerInterval) {
            logger.info('🤖 Auto-scheduler already started');
            return;
        }

        schedulerInterval = setInterval(runAutoScheduler, AUTO_CHECK_INTERVAL);
        logger.info('🤖 Auto-scheduler initialized - checking every 10 minutes');

        // Run once after 30 seconds on startup
        setTimeout(() => {
            runAutoScheduler();
        }, 30000);
    },

    stop: () => {
        if (schedulerInterval) {
            clearInterval(schedulerInterval);
            schedulerInterval = null;
            logger.info('🛑 Auto-scheduler stopped');
        }
    },

    runNow: async () => {
        await runAutoScheduler();
    },

    isRunning: () => !!schedulerInterval
};

export default autoScheduler;
