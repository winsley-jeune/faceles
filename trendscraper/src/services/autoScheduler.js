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
                        const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);
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
