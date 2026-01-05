/**
 * TikTok Smart Controller
 * Analytics-driven content generation for TikTok
 * Strategy: VIRAL VELOCITY - Maximize early engagement for algorithm boost
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

import smartTiktokGenerator from '../modules/analytics/smart_tiktok_generator.js';
import tiktokAnalytics from '../modules/analytics/tiktok_analytics.js';
import tiktokAPI from '../modules/uploaders/tiktok_api_uploader.js';

import env from '../config/env.js';

const VIDEOS_DIR = env.VIDEOS_DIR;

const tiktokSmartController = {
    getTopic: async (req, res) => {
        const userId = req.user.id;
        const { niche = 'general' } = req.query;
        console.log(`🧠 Getting smart TikTok topic (VIRAL VELOCITY strategy)...`);

        const result = await smartTiktokGenerator.generateSmartTikTokTopic(userId, niche, true);

        res.json({
            success: true,
            platform: 'tiktok',
            strategy: 'viral-velocity',
            recommendedTopic: result.topic,
            niche: result.niche,
            patterns: result.patterns,
            viralIntelligence: result.viralIntelligence
        });
    },

    getPatterns: async (req, res) => {
        const userId = req.user.id;
        const patterns = await smartTiktokGenerator.getBestPatterns(userId);
        const recentTopics = await smartTiktokGenerator.getRecentTopics(userId, 20);

        res.json({
            success: true,
            platform: 'tiktok',
            strategy: 'viral-velocity',
            patterns,
            recentTopicsCount: recentTopics.length,
            recentTopics: recentTopics.slice(-10)
        });
    },

    createAndPost: async (req, res) => {
        const userId = req.user.id;
        let { niche = "general", autoPost = true, topic: providedTopic = null } = req.body;

        console.log(`🚀 TIKTOK SMART VIDEO GENERATION (niche: ${niche})`);

        // Use provided topic or generate new one for TikTok
        let topic, topicResult;
        if (providedTopic) {
            console.log("   🎯 Using provided topic from frontend...");
            topic = providedTopic;
            topicResult = {
                topic: providedTopic,
                patterns: { hook: 'shock-opener', emotion: 'shock' },
                source: 'frontend-provided',
                viralIntelligence: null
            };
        } else {
            topicResult = await smartTiktokGenerator.generateSmartTikTokTopic(userId, niche, true);
            topic = topicResult.topic;
        }

        console.log(`   ✅ Topic: "${topic}"`);
        console.log(`   📊 Pattern: ${topicResult.patterns.hook}`);

        const runId = uuidv4();
        console.log(`🎬 [${runId}] STARTING PRODUCTION: ${topic}`);

        const viralData = topicResult.viralIntelligence || null;
        const storyboard = await generateNicheStoryboard(niche, topic, viralData);
        const fullScript = storyboard.map(s => s.text).join(" ");
        const imagePrompts = storyboard.map(s => s.image_prompt);
        const sceneTypes = storyboard.map(s => s.scene_type || 'body');

        const visualPaths = await generateProImages(imagePrompts, {
            topic, sceneTypes, outputDir: VIDEOS_DIR
        });

        const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR);

        // TikTok prefers high energy content
        let energyLevel = 'high';
        if (['health', 'psychology', 'motivation'].includes(niche)) energyLevel = 'medium';
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
                musicVolume: 0.12 // Slightly higher for TikTok
            }
        });

        const safeTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const timestamp = Date.now();
        const filename = `tt_${niche}_${safeTopic}_${timestamp}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);
        fs.copyFileSync(result.filePath, destPath);

        const metadata = await generateAllPlatformsContent(topic, niche);
        const metaPath = path.join(VIDEOS_DIR, `tt_${niche}_${safeTopic}_${timestamp}.json`);

        const metadataBundle = {
            topic,
            niche,
            platform: 'tiktok',
            smartGeneration: {
                pattern: topicResult.patterns,
                source: topicResult.source
            },
            createdAt: new Date().toISOString(),
            videoFile: filename,
            platforms: metadata
        };

        fs.writeFileSync(metaPath, JSON.stringify(metadataBundle, null, 2));
        result.cleanup();

        console.log(`   ✅ Video created: ${filename}`);

        let postResult = null;
        if (autoPost) {
            console.log(`   📤 Uploading to TikTok...`);
            postResult = await tiktokAPI.uploadToTikTokAPI(userId, destPath, {
                title: metadata.tiktok.title,
                hashtags: metadata.tiktok.hashtags
            });
        }

        res.json({
            success: true,
            platform: 'tiktok',
            smartGeneration: {
                topic: topic,
                pattern: topicResult.patterns.hook,
                source: topicResult.source
            },
            video: {
                path: destPath,
                filename: filename
            },
            tiktok: postResult,
            message: postResult?.success
                ? `TikTok video created and posted!`
                : "TikTok video created (not posted)"
        });
    }
};

export default tiktokSmartController;
