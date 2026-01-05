/**
 * Facebook Smart Controller
 * Analytics-driven content generation for Facebook
 * Strategy: TIT-FOR-TAT - Consistency over virality
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

import smartFacebookGenerator from '../modules/analytics/smart_facebook_generator.js';
import facebookAnalytics from '../modules/analytics/facebook_analytics.js';
import facebookAPI from '../modules/uploaders/facebook_api_uploader.js';
import trainingData from '../modules/analytics/training_data.js';
import brandContext from '../modules/brand_context.js';

import env from '../config/env.js';

const VIDEOS_DIR = env.VIDEOS_DIR;

const facebookSmartController = {
    getTopic: async (req, res) => {
        const userId = req.user.id;
        const { niche = 'general', fresh = 'true' } = req.query;
        console.log(`🧠 Getting smart Facebook topic (TIT-FOR-TAT strategy)...`);

        let freshData = null;
        if (fresh === 'true') {
            try {
                freshData = await facebookAnalytics.fetchReelsStats(userId);
                console.log(`   🔄 Fetched fresh Facebook data`);
            } catch (err) {
                console.log(`   ⚠️ Could not fetch fresh data: ${err.message}`);
            }
        }

        const result = await smartFacebookGenerator.generateSmartFacebookTopic(userId, niche, true, freshData?.videos);

        res.json({
            success: true,
            platform: 'facebook',
            strategy: 'tit-for-tat',
            recommendedTopic: result.topic,
            niche: result.niche,
            patterns: result.patterns,
            viralIntelligence: result.viralIntelligence
        });
    },

    getPatterns: async (req, res) => {
        const userId = req.user.id;
        const patterns = await smartFacebookGenerator.getBestPatterns(userId);
        const recentTopics = await smartFacebookGenerator.getRecentTopics(userId, 20);

        res.json({
            success: true,
            platform: 'facebook',
            strategy: 'tit-for-tat',
            patterns,
            recentTopicsCount: recentTopics.length,
            recentTopics: recentTopics.slice(-10)
        });
    },

    createAndPost: async (req, res) => {
        const userId = req.user.id;
        let { niche = "general", autoPost = true, topic: providedTopic = null } = req.body;

        console.log(`🚀 FACEBOOK SMART VIDEO GENERATION (niche: ${niche})`);

        // Use provided topic or generate new one for Facebook
        let topic, topicResult;
        if (providedTopic) {
            console.log("   🎯 Using provided topic from frontend...");
            topic = providedTopic;
            topicResult = {
                topic: providedTopic,
                patterns: { hook: 'shareable-wisdom', emotion: 'curiosity' },
                source: 'frontend-provided',
                viralIntelligence: null
            };
        } else {
            topicResult = await smartFacebookGenerator.generateSmartFacebookTopic(userId, niche, true);
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

        let energyLevel = 'medium';
        if (['finance', 'tech', 'money'].includes(niche)) energyLevel = 'high';
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
        const filename = `fb_${niche}_${safeTopic}_${timestamp}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);
        fs.copyFileSync(result.filePath, destPath);

        const metadata = await generateAllPlatformsContent(topic, niche);
        const metaPath = path.join(VIDEOS_DIR, `fb_${niche}_${safeTopic}_${timestamp}.json`);

        const metadataBundle = {
            topic,
            niche,
            platform: 'facebook',
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
            console.log(`   📤 Uploading to Facebook...`);
            postResult = await facebookAPI.uploadToFacebookAPI(userId, destPath, {
                title: metadata.facebook.title,
                description: metadata.facebook.fullCaption || metadata.facebook.description
            });
        }

        res.json({
            success: true,
            platform: 'facebook',
            smartGeneration: {
                topic: topic,
                pattern: topicResult.patterns.hook,
                source: topicResult.source
            },
            video: {
                path: destPath,
                filename: filename
            },
            facebook: postResult,
            message: postResult?.success
                ? `Facebook video created and posted!`
                : "Facebook video created (not posted)"
        });
    }
};

export default facebookSmartController;
