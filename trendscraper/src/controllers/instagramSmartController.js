/**
 * Instagram Smart Controller
 * Analytics-driven content generation for Instagram
 * Strategy: NASH EQUILIBRIUM - Balance follower vs reach content
 */
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

import { generateNicheStoryboard } from '../modules/storyboard.js';
import { generateProImages } from '../modules/visuals_pro.js';
import { generateSmartVoice } from '../modules/voice_pro.js';
import { getMusicByEnergy } from '../modules/audio_pro.js';
import { renderVideo } from '../modules/renderer.js';
import { generateEstimatedSubtitles, alignSubtitlesToAudio } from '../modules/subtitle_sync.js';
import { generateAllPlatformsContent } from '../modules/social_content.js';

import smartInstagramGenerator from '../modules/analytics/smart_instagram_generator.js';
import instagramAnalytics from '../modules/analytics/instagram_analytics.js';
import instagramAPI from '../modules/uploaders/instagram_api_uploader.js';

import env from '../config/env.js';

const VIDEOS_DIR = env.VIDEOS_DIR;

const instagramSmartController = {
    getTopic: async (req, res) => {
        const userId = req.user.id;
        const { niche = 'general' } = req.query;
        console.log(`🧠 Getting smart Instagram topic (NASH EQUILIBRIUM strategy)...`);

        const result = await smartInstagramGenerator.generateSmartInstagramTopic(userId, niche, true);

        res.json({
            success: true,
            platform: 'instagram',
            strategy: 'nash-equilibrium',
            recommendedTopic: result.topic,
            niche: result.niche,
            patterns: result.patterns,
            viralIntelligence: result.viralIntelligence
        });
    },

    getPatterns: async (req, res) => {
        const userId = req.user.id;
        const patterns = await smartInstagramGenerator.getBestPatterns(userId);
        const recentTopics = await smartInstagramGenerator.getRecentTopics(userId, 20);

        res.json({
            success: true,
            platform: 'instagram',
            strategy: 'nash-equilibrium',
            patterns,
            recentTopicsCount: recentTopics.length,
            recentTopics: recentTopics.slice(-10)
        });
    },

    createAndPost: async (req, res) => {
        const userId = req.user.id;
        let { niche = "general", autoPost = true, topic: providedTopic = null } = req.body;

        console.log(`🚀 INSTAGRAM SMART VIDEO GENERATION (niche: ${niche})`);

        // Use provided topic or generate new one for Instagram
        let topic, topicResult;
        if (providedTopic) {
            console.log("   🎯 Using provided topic from frontend...");
            topic = providedTopic;
            topicResult = {
                topic: providedTopic,
                patterns: { hook: 'insider-tips', emotion: 'curiosity' },
                source: 'frontend-provided',
                viralIntelligence: null
            };
        } else {
            topicResult = await smartInstagramGenerator.generateSmartInstagramTopic(userId, niche, true);
            topic = topicResult.topic;
        }

        console.log(`   ✅ Topic: "${topic}"`);

        const runId = uuidv4();
        const viralData = topicResult.viralIntelligence || null;
        const storyboard = await generateNicheStoryboard(niche, topic, viralData);
        const fullScript = storyboard.map(s => s.text).join(" ");
        const imagePrompts = storyboard.map(s => s.image_prompt);
        const sceneTypes = storyboard.map(s => s.scene_type || 'body');

        const visualPaths = await generateProImages(imagePrompts, {
            topic, sceneTypes, outputDir: VIDEOS_DIR
        });

        const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR);

        let energyLevel = 'medium';
        if (['finance', 'tech'].includes(niche)) energyLevel = 'high';
        if (['health', 'psychology'].includes(niche)) energyLevel = 'low';
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

        const safeTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const timestamp = Date.now();
        const filename = `ig_${niche}_${safeTopic}_${timestamp}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);
        fs.copyFileSync(result.filePath, destPath);

        const metadata = await generateAllPlatformsContent(topic, niche);
        result.cleanup();

        let postResult = null;
        if (autoPost) {
            console.log(`   📤 Uploading to Instagram...`);
            postResult = await instagramAPI.uploadToInstagramAPI(userId, destPath, {
                caption: metadata.instagram.fullCaption
            });
        }

        res.json({
            success: true,
            platform: 'instagram',
            smartGeneration: {
                topic: topic,
                pattern: topicResult.patterns.hook,
                source: topicResult.source
            },
            video: { path: destPath, filename },
            instagram: postResult,
            message: postResult?.success
                ? `Instagram video created and posted!`
                : "Instagram video created (not posted)"
        });
    }
};

export default instagramSmartController;
