/**
 * PROMOTIONAL CONTENT CONTROLLER
 *
 * Handles API requests for promotional content generation and configuration
 */

import fs from 'fs';
import path from 'path';

import promoConfig from '../config/promo_config.js';
import promoTopicGenerator from '../modules/analytics/promo_topic_generator.js';
import promoBrandContext from '../modules/promo_brand_context.js';

// Import modules needed for manual generation
import { generateNicheStoryboard } from '../modules/storyboard.js';
import { generateProImages } from '../modules/visuals_pro.js';
import { generateSmartVoice } from '../modules/voice_pro.js';
import { getMusicByEnergy } from '../modules/audio_pro.js';
import { renderVideo } from '../modules/renderer.js';
import { generateEstimatedSubtitles, alignSubtitlesToAudio } from '../modules/subtitle_sync.js';
import { generateAllPlatformsContent } from '../modules/social_content.js';

import env from '../config/env.js';
import { logger } from '../utils/index.js';

const VIDEOS_DIR = env.VIDEOS_DIR;

/**
 * GET /promo/config
 * Get promotional content configuration
 */
export const getPromoConfig = async (req, res) => {
    try {
        const userId = req.user.id;
        const config = await promoConfig.loadPromoConfig(userId);
        const stats = await promoConfig.getPromoStats(userId);

        res.json({
            success: true,
            config,
            stats
        });
    } catch (error) {
        logger.error('Error getting promo config:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * PUT /promo/config
 * Update promotional content configuration
 */
export const updatePromoConfig = async (req, res) => {
    try {
        const userId = req.user.id;
        const updates = req.body;

        // Load current config
        const config = await promoConfig.loadPromoConfig(userId);

        // Update fields
        if (typeof updates.enabled !== 'undefined') config.enabled = updates.enabled;
        if (updates.mode) config.mode = updates.mode;
        if (updates.frequency) config.frequency = { ...config.frequency, ...updates.frequency };
        if (updates.platforms) config.platforms = updates.platforms;
        if (updates.contentMix) config.contentMix = { ...config.contentMix, ...updates.contentMix };

        // Save updated config
        const success = await promoConfig.savePromoConfig(userId, config);

        if (success) {
            logger.info('Promotional config updated');
            res.json({
                success: true,
                config,
                message: 'Configuration updated successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to save configuration'
            });
        }
    } catch (error) {
        logger.error('Error updating promo config:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * POST /promo/generate
 * Manually generate promotional video
 */
export const generatePromoVideo = async (req, res) => {
    try {
        const { type, platform = 'youtube' } = req.body;

        logger.info(`Manual promotional video generation requested (type: ${type || 'auto'}, platform: ${platform})`);

        // Get promotional brand context
        const promoBrandSummary = promoBrandContext.generatePromoBrandSummary();
        const promoContext = promoBrandContext.generatePromoPromptContext();

        // Generate promotional topic
        const promoTopicData = await promoTopicGenerator.generatePromoTopic({
            type,
            platform,
            useAI: true
        });

        const { topic, type: selectedType } = promoTopicData;

        logger.info(`Generated topic: "${topic}" (${selectedType})`);

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
            null,
            platform,
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

        // Get music
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
        const filename = `promo_${selectedType}_${safeTopic}_${timestamp}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);
        fs.copyFileSync(result.filePath, destPath);

        // Generate metadata
        const metadata = await generateAllPlatformsContent(topic, 'saas');

        // Record generation
        const userId = req.user.id;
        await promoConfig.recordPromoGeneration(userId, selectedType);

        // Cleanup temp files
        result.cleanup();

        logger.info(`Promotional video generated: ${filename}`);

        res.json({
            success: true,
            video: {
                path: destPath,
                filename,
                topic,
                type: selectedType,
                platform,
                metadata
            }
        });

    } catch (error) {
        logger.error('Error generating promotional video:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * GET /promo/history
 * Get promotional post history
 */
export const getPromoHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const history = await promoConfig.getPromoHistory(userId, limit);

        res.json({
            success: true,
            history,
            total: history.length
        });
    } catch (error) {
        logger.error('Error getting promo history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * POST /promo/test-topic
 * Generate sample promotional topic (no video generation)
 */
export const testPromoTopic = async (req, res) => {
    try {
        const { type, platform = 'youtube', useAI = true } = req.body;

        const topicData = await promoTopicGenerator.generatePromoTopic({
            type,
            platform,
            useAI
        });

        res.json({
            success: true,
            topic: topicData
        });
    } catch (error) {
        logger.error('Error testing promo topic:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * GET /promo/next-schedule
 * Get when next promotional post is scheduled
 */
export const getNextPromoSchedule = async (req, res) => {
    try {
        const userId = req.user.id;
        const schedule = await promoConfig.getNextPromoSchedule(userId);

        res.json({
            success: true,
            schedule
        });
    } catch (error) {
        logger.error('Error getting next promo schedule:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * GET /promo/stats
 * Get promotional content statistics
 */
export const getPromoStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const stats = await promoConfig.getPromoStats(userId);
        const topicCounts = promoTopicGenerator.getPromoTopicCounts();

        res.json({
            success: true,
            stats: {
                ...stats,
                availableTopics: topicCounts
            }
        });
    } catch (error) {
        logger.error('Error getting promo stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * POST /promo/enable
 * Enable promotional content
 */
export const enablePromo = async (req, res) => {
    try {
        const userId = req.user.id;
        const success = await promoConfig.enablePromo(userId);

        res.json({
            success,
            message: success ? 'Promotional content enabled' : 'Failed to enable promotional content'
        });
    } catch (error) {
        logger.error('Error enabling promo:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * POST /promo/disable
 * Disable promotional content
 */
export const disablePromo = async (req, res) => {
    try {
        const userId = req.user.id;
        const success = await promoConfig.disablePromo(userId);

        res.json({
            success,
            message: success ? 'Promotional content disabled' : 'Failed to disable promotional content'
        });
    } catch (error) {
        logger.error('Error disabling promo:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export default {
    getPromoConfig,
    updatePromoConfig,
    generatePromoVideo,
    getPromoHistory,
    testPromoTopic,
    getNextPromoSchedule,
    getPromoStats,
    enablePromo,
    disablePromo
};
