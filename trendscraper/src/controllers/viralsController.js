/**
 * Virals Controller
 * Fetch and analyze viral content from all platforms
 * Discover → Clone → Create pipeline
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

import viralCloner from '../modules/viral_cloner.js';
import autoPoster from '../modules/auto_poster.js';

import env from '../config/env.js';

const VIDEOS_DIR = env.VIDEOS_DIR;

const viralsController = {
    getTikTok: async (req, res) => {
        const { region = 'US', limit = 20 } = req.query;
        const result = await viralCloner.fetchTikTokVirals({ region, limit: parseInt(limit) });
        res.json(result);
    },

    getTikTokSounds: async (req, res) => {
        const { region = 'US', limit = 20 } = req.query;
        const result = await viralCloner.fetchTikTokSounds({ region, limit: parseInt(limit) });
        res.json(result);
    },

    getYouTube: async (req, res) => {
        const { niche = '', limit = 20 } = req.query;
        const result = await viralCloner.fetchYouTubeVirals({ niche, maxResults: parseInt(limit) });
        res.json(result);
    },

    getInstagram: async (req, res) => {
        const userId = req.user?.id;
        const { hashtag = '', limit = 20 } = req.query;
        const result = await viralCloner.fetchInstagramVirals(userId, { hashtag, limit: parseInt(limit) });
        res.json(result);
    },

    getFacebook: async (req, res) => {
        const userId = req.user?.id;
        const { limit = 20 } = req.query;
        const result = await viralCloner.fetchFacebookVirals(userId, { limit: parseInt(limit) });
        res.json(result);
    },

    clone: async (req, res) => {
        const { viral, niche = 'general', style = 'educational' } = req.body;
        if (!viral) {
            return res.status(400).json({ error: "viral object is required" });
        }
        const result = await viralCloner.cloneViralContent(viral, { niche, style });
        res.json(result);
    },

    discover: async (req, res) => {
        const userId = req.user?.id;
        const {
            niche = 'general',
            platforms = ['tiktok'],
            limit = 10,
            cloneTop = 5
        } = req.body;

        console.log(`🔍 [User: ${userId}] Discovering virals for niche: ${niche}`);
        const result = await viralCloner.discoverAndClone(userId, {
            niche,
            platforms,
            limit,
            cloneTop
        });
        res.json(result);
    },

    discoverAndCreate: async (req, res) => {
        const userId = req.user?.id;
        const {
            niche = 'general',
            platforms = ['tiktok'],
            autoPost = false
        } = req.body;

        console.log(`🚀 [User: ${userId}] Discover → Clone → Create pipeline for: ${niche}`);

        const discovery = await viralCloner.discoverAndClone(userId, {
            niche,
            platforms,
            limit: 10,
            cloneTop: 3
        });

        if (!discovery.success || !discovery.concepts?.length) {
            return res.status(400).json({
                error: "No viral concepts discovered",
                discovery
            });
        }

        const bestConcept = discovery.concepts.sort((a, b) =>
            (b.viralPotential?.score || 0) - (a.viralPotential?.score || 0)
        )[0];

        const topic = bestConcept.newConcept.topic;

        console.log(`   🎯 Selected topic: ${topic}`);
        console.log(`   📊 Viral score: ${bestConcept.viralPotential?.score}/10`);

        const runId = uuidv4();
        console.log(`🎬 [${runId}] STARTING VIRAL-INSPIRED PRODUCTION: ${topic}`);

        const storyboard = await generateNicheStoryboard(niche, topic);
        const fullScript = storyboard.map(s => s.text).join(" ");
        const imagePrompts = storyboard.map(s => s.image_prompt);
        const sceneTypes = storyboard.map(s => s.scene_type || 'body');

        const visualPaths = await generateProImages(imagePrompts, {
            topic, sceneTypes, outputDir: VIDEOS_DIR
        });

        const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR);

        let energyLevel = 'medium';
        if (['finance', 'tech', 'money', 'news'].includes(niche)) energyLevel = 'high';
        if (['health', 'psychology', 'history'].includes(niche)) energyLevel = 'low';
        const musicTrack = await getMusicByEnergy(energyLevel, VIDEOS_DIR);

        let subtitles = await alignSubtitlesToAudio(audioBase64, fullScript);
        if (!subtitles) subtitles = generateEstimatedSubtitles(storyboard);

        const videoResult = await renderVideo({
            audioBase64, subtitles, visuals: visualPaths, storyboard,
            musicPath: musicTrack ? musicTrack.path : null,
            options: {
                subtitleStyle: (niche === 'finance') ? 'viral' : 'clean',
                addVignette: (niche === 'finance'),
                addColorGrade: true, addTransitions: true, musicVolume: 0.10
            }
        });

        const safeTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const filename = `${niche}_viral_${safeTopic}_${Date.now()}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);
        fs.copyFileSync(videoResult.filePath, destPath);
        videoResult.cleanup();

        console.log(`   ✅ Video created: ${filename}`);

        let postResults = null;
        if (autoPost) {
            console.log(`   📤 Auto-posting to all platforms...`);
            postResults = await autoPoster.postNow(destPath, topic, niche);
        }

        res.json({
            success: true,
            discovery: {
                viralsFound: discovery.discovered,
                conceptsGenerated: discovery.concepts.length,
                selectedConcept: bestConcept
            },
            video: {
                path: destPath,
                filename,
                topic
            },
            postResults,
            message: autoPost ? "Viral video created and posted!" : "Viral video created!"
        });
    },

    getTopics: async (req, res) => {
        const { niche = 'general', count = 5 } = req.query;

        const discovery = await viralCloner.discoverAndClone({
            niche,
            platforms: ['tiktok'],
            limit: 20,
            cloneTop: parseInt(count)
        });

        if (!discovery.success) {
            return res.status(400).json({ error: "Discovery failed" });
        }

        const topics = discovery.concepts.map(c => ({
            topic: c.newConcept.topic,
            hook: c.newConcept.hook,
            viralScore: c.viralPotential?.score || 0,
            reasoning: c.viralPotential?.reasoning,
            hashtags: c.seoOptimization?.hashtags
        }));

        res.json({
            success: true,
            niche,
            topics: topics.sort((a, b) => b.viralScore - a.viralScore),
            message: `${topics.length} viral-inspired topics ready to generate`
        });
    }
};

export default viralsController;
