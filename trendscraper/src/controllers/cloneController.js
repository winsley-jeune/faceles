/**
 * Clone Controller
 * Viral content cloning from competitor platforms
 * Creates unique versions of viral content using AI transformation
 */
import fs from 'fs';
import path from 'path';

import { generateNicheStoryboard } from '../modules/storyboard.js';
import { generateProImages } from '../modules/visuals_pro.js';
import { generateSmartVoice } from '../modules/voice_pro.js';
import { getMusicByEnergy } from '../modules/audio_pro.js';
import { renderVideo } from '../modules/renderer.js';
import { generateEstimatedSubtitles, alignSubtitlesToAudio } from '../modules/subtitle_sync.js';

import viralCloner from '../modules/viral_cloner.js';

import env from '../config/env.js';

const VIDEOS_DIR = env.VIDEOS_DIR;

const cloneController = {
    getTikTokVirals: async (req, res) => {
        const { region = 'US', limit = 20 } = req.query;
        const result = await viralCloner.fetchTikTokVirals({ region, limit: parseInt(limit) });
        res.json(result);
    },

    getTikTokSounds: async (req, res) => {
        const { region = 'US', limit = 20 } = req.query;
        const result = await viralCloner.fetchTikTokSounds({ region, limit: parseInt(limit) });
        res.json(result);
    },

    getYouTubeVirals: async (req, res) => {
        const { niche = '', limit = 20 } = req.query;
        const result = await viralCloner.fetchYouTubeVirals({ niche, maxResults: parseInt(limit) });
        res.json(result);
    },

    generate: async (req, res) => {
        const { viralPost, niche = 'general', style = 'educational' } = req.body;

        if (!viralPost) {
            return res.status(400).json({ error: 'viralPost object is required' });
        }

        const result = await viralCloner.cloneViralContent(viralPost, { niche, style });
        res.json(result);
    },

    discover: async (req, res) => {
        const userId = req.user?.id;
        const { niche = 'general', platforms = ['tiktok', 'youtube'], limit = 10, cloneTop = 5 } = req.body;

        console.log(`🔍 [User: ${userId}] Discovering viral content for niche: ${niche}`);
        const result = await viralCloner.discoverAndClone(userId, { niche, platforms, limit, cloneTop });

        res.json(result);
    },

    createVideo: async (req, res) => {
        const userId = req.user?.id;
        const { niche = 'general', platforms = ['tiktok'], autoPost = false } = req.body;

        console.log(`🚀 [User: ${userId}] Clone-to-Video pipeline starting...`);

        const discovery = await viralCloner.discoverAndClone(userId, { niche, platforms, limit: 10, cloneTop: 3 });

        if (!discovery.success || !discovery.concepts || discovery.concepts.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No viral content found to clone'
            });
        }

        const bestConcept = discovery.concepts.sort((a, b) =>
            (b.viralPotential?.score || 0) - (a.viralPotential?.score || 0)
        )[0];

        const topic = bestConcept.newConcept.topic;
        console.log(`   📝 Selected concept: "${topic}"`);

        const storyboard = await generateNicheStoryboard(niche, topic);
        const fullScript = storyboard.map(s => s.text).join(" ");
        const imagePrompts = storyboard.map(s => s.image_prompt);
        const sceneTypes = storyboard.map(s => s.scene_type || 'body');

        const visualPaths = await generateProImages(imagePrompts, {
            topic,
            sceneTypes,
            outputDir: VIDEOS_DIR
        });

        const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR);
        const musicTrack = await getMusicByEnergy('medium', VIDEOS_DIR);

        let subtitles = await alignSubtitlesToAudio(audioBase64, fullScript);
        if (!subtitles) subtitles = generateEstimatedSubtitles(storyboard);

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

        const safeTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const timestamp = Date.now();
        const filename = `cloned_${safeTopic}_${timestamp}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);
        fs.copyFileSync(result.filePath, destPath);

        result.cleanup();

        const metadata = bestConcept.seoOptimization;

        res.json({
            success: true,
            clonedFrom: {
                platform: discovery.topVirals[0]?.platform,
                originalHook: discovery.topVirals[0]?.hook,
                originalViews: discovery.topVirals[0]?.views
            },
            newConcept: bestConcept.newConcept,
            videoPath: destPath,
            filename,
            metadata
        });
    }
};

export default cloneController;
