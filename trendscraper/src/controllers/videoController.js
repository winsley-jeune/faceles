/**
 * Video Controller
 * Video listing, creation, and management
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { generateNicheStoryboard } from '../modules/storyboard.js';
import { generateProImages } from '../modules/visuals_pro.js';
import { generateSmartVoice } from '../modules/voice_pro.js';
import { getMusicByEnergy } from '../modules/audio_pro.js';
import { renderVideo } from '../modules/renderer.js';
import { generateEstimatedSubtitles, alignSubtitlesToAudio } from '../modules/subtitle_sync.js';
import { generateAllPlatformsContent } from '../modules/social_content.js';
import autoPoster from '../modules/auto_poster.js';
import { logger, getAudioDuration, calculateExpectedDuration, checkDurationAlignment } from '../utils/index.js';

import env from '../config/env.js';

const VIDEOS_DIR = env.VIDEOS_DIR;

const videoController = {
    list: async (req, res) => {
        const files = fs.readdirSync(VIDEOS_DIR);
        const videos = files
            .filter(f => f.endsWith('.mp4'))
            .map(f => {
                const stats = fs.statSync(path.join(VIDEOS_DIR, f));
                const metaPath = path.join(VIDEOS_DIR, f.replace('.mp4', '.json'));
                let metadata = null;
                if (fs.existsSync(metaPath)) {
                    try {
                        metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    } catch (e) {
                        logger.warn('Failed to parse video metadata', { path: metaPath, error: e.message });
                    }
                }
                return {
                    filename: f,
                    path: path.join(VIDEOS_DIR, f),
                    size: stats.size,
                    created: stats.birthtime,
                    metadata
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));

        res.json({
            success: true,
            count: videos.length,
            videos
        });
    },

    createFullVideo: async (req, res) => {
        const { topic, niche = 'general' } = req.body;

        if (!topic) {
            return res.status(400).json({ error: 'topic is required' });
        }

        const runId = uuidv4();
        logger.info(`[${runId}] Starting video production`, { topic, niche });

        try {
            // Step 1: Generate storyboard
            const storyboard = await generateNicheStoryboard(niche, topic);

            if (!storyboard || storyboard.length === 0) {
                return res.status(500).json({
                    error: 'Storyboard generation failed',
                    details: 'No scenes were generated'
                });
            }

            const fullScript = storyboard.map(s => s.text).join(" ");
            const imagePrompts = storyboard.map(s => s.image_prompt);
            const sceneTypes = storyboard.map(s => s.scene_type || 'body');

            // Step 2: Generate images
            const visualPaths = await generateProImages(imagePrompts, {
                topic, sceneTypes, outputDir: VIDEOS_DIR
            });

            // VALIDATION: Check image generation results
            if (!visualPaths || visualPaths.length === 0) {
                return res.status(500).json({
                    error: 'Image generation failed',
                    details: 'No images were generated'
                });
            }

            if (visualPaths.length !== storyboard.length) {
                logger.warn('Visual/storyboard mismatch', {
                    visuals: visualPaths.length,
                    scenes: storyboard.length
                });

                // If less than 50% generated, fail
                if (visualPaths.length < storyboard.length * 0.5) {
                    return res.status(500).json({
                        error: 'Image generation critically failed',
                        details: `Only ${visualPaths.length}/${storyboard.length} images generated`
                    });
                }
            }

            // Step 3: Generate audio
            const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR);

            if (!audioBase64) {
                return res.status(500).json({
                    error: 'Voice generation failed',
                    details: 'No audio was generated'
                });
            }

            // VALIDATION: Check audio duration alignment
            try {
                const audioDurationMs = await getAudioDuration(audioBase64, VIDEOS_DIR);
                const expectedDurationMs = calculateExpectedDuration(storyboard);
                const alignment = checkDurationAlignment(audioDurationMs, expectedDurationMs);

                if (!alignment.aligned) {
                    logger.warn('Audio/video duration mismatch', {
                        audioDuration: Math.round(audioDurationMs / 1000),
                        expectedDuration: Math.round(expectedDurationMs / 1000),
                        variance: alignment.variance
                    });
                }
            } catch (durationError) {
                logger.warn('Could not validate audio duration', { error: durationError.message });
            }

            // Step 4: Get background music
            let energyLevel = 'medium';
            if (['finance', 'tech', 'money'].includes(niche)) energyLevel = 'high';
            if (['health', 'psychology'].includes(niche)) energyLevel = 'low';
            const musicTrack = await getMusicByEnergy(energyLevel, VIDEOS_DIR);

            // Step 5: Generate subtitles
            let subtitles = await alignSubtitlesToAudio(audioBase64, fullScript);
            if (!subtitles) {
                logger.warn('Subtitle alignment failed, using estimated subtitles');
                subtitles = generateEstimatedSubtitles(storyboard);
            }

            // Step 6: Render video (use minimum of visuals/storyboard length)
            const effectiveStoryboard = storyboard.slice(0, visualPaths.length);

            const result = await renderVideo({
                audioBase64, subtitles, visuals: visualPaths, storyboard: effectiveStoryboard,
                musicPath: musicTrack ? musicTrack.path : null,
                options: {
                    subtitleStyle: 'viral',
                    addVignette: true,
                    addColorGrade: true,
                    addTransitions: true,
                    musicVolume: 0.10
                }
            });

            // Step 7: Save and finalize
            const safeTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
            const timestamp = Date.now();
            const filename = `${niche}_${safeTopic}_${timestamp}.mp4`;
            const destPath = path.join(VIDEOS_DIR, filename);
            fs.copyFileSync(result.filePath, destPath);

            const metadata = await generateAllPlatformsContent(topic, niche);
            const metaPath = path.join(VIDEOS_DIR, `${niche}_${safeTopic}_${timestamp}.json`);

            fs.writeFileSync(metaPath, JSON.stringify({
                topic,
                niche,
                createdAt: new Date().toISOString(),
                videoFile: filename,
                platforms: metadata
            }, null, 2));

            result.cleanup();

            logger.info(`[${runId}] Video created successfully`, { filename });

            res.json({
                success: true,
                video: {
                    path: destPath,
                    filename
                },
                metadata,
                message: "Video created successfully!"
            });

        } catch (error) {
            logger.error(`[${runId}] Video creation failed`, { error: error.message, stack: error.stack });
            res.status(500).json({
                error: 'Video creation failed',
                details: error.message
            });
        }
    },

    createAndPost: async (req, res) => {
        const { topic, niche = 'general', platforms = ['youtube'] } = req.body;

        if (!topic) {
            return res.status(400).json({ error: 'topic is required' });
        }

        const runId = uuidv4();
        logger.info(`[${runId}] Starting video creation and post`, { topic, niche, platforms });

        try {
            // Step 1: Generate storyboard
            const storyboard = await generateNicheStoryboard(niche, topic);

            if (!storyboard || storyboard.length === 0) {
                return res.status(500).json({
                    error: 'Storyboard generation failed',
                    details: 'No scenes were generated'
                });
            }

            const fullScript = storyboard.map(s => s.text).join(" ");
            const imagePrompts = storyboard.map(s => s.image_prompt);
            const sceneTypes = storyboard.map(s => s.scene_type || 'body');

            // Step 2: Generate images with validation
            const visualPaths = await generateProImages(imagePrompts, {
                topic, sceneTypes, outputDir: VIDEOS_DIR
            });

            if (!visualPaths || visualPaths.length === 0) {
                return res.status(500).json({
                    error: 'Image generation failed',
                    details: 'No images were generated'
                });
            }

            if (visualPaths.length < storyboard.length * 0.5) {
                return res.status(500).json({
                    error: 'Image generation critically failed',
                    details: `Only ${visualPaths.length}/${storyboard.length} images generated`
                });
            }

            // Step 3: Generate audio with validation
            const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR);

            if (!audioBase64) {
                return res.status(500).json({
                    error: 'Voice generation failed',
                    details: 'No audio was generated'
                });
            }

            // Step 4: Get background music
            let energyLevel = 'medium';
            if (['finance', 'tech', 'money'].includes(niche)) energyLevel = 'high';
            if (['health', 'psychology'].includes(niche)) energyLevel = 'low';
            const musicTrack = await getMusicByEnergy(energyLevel, VIDEOS_DIR);

            // Step 5: Generate subtitles with fallback
            let subtitles = await alignSubtitlesToAudio(audioBase64, fullScript);
            if (!subtitles) {
                logger.warn('Subtitle alignment failed, using estimated subtitles');
                subtitles = generateEstimatedSubtitles(storyboard);
            }

            // Step 6: Render video (use minimum of visuals/storyboard length)
            const effectiveStoryboard = storyboard.slice(0, visualPaths.length);

            const result = await renderVideo({
                audioBase64, subtitles, visuals: visualPaths, storyboard: effectiveStoryboard,
                musicPath: musicTrack ? musicTrack.path : null,
                options: {
                    subtitleStyle: 'viral',
                    addVignette: true,
                    addColorGrade: true,
                    addTransitions: true,
                    musicVolume: 0.10
                }
            });

            // Step 7: Save video
            const safeTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
            const timestamp = Date.now();
            const filename = `${niche}_${safeTopic}_${timestamp}.mp4`;
            const destPath = path.join(VIDEOS_DIR, filename);
            fs.copyFileSync(result.filePath, destPath);

            result.cleanup();

            // Step 8: Post to platforms
            logger.info(`[${runId}] Posting to platforms`, { platforms });
            const postResults = await autoPoster.postNow(req.user.id, destPath, topic, niche);

            logger.info(`[${runId}] Video created and posted`, { filename, postResults });

            res.json({
                success: true,
                video: {
                    path: destPath,
                    filename
                },
                postResults,
                message: "Video created and posted!"
            });

        } catch (error) {
            logger.error(`[${runId}] Video creation and post failed`, { error: error.message, stack: error.stack });
            res.status(500).json({
                error: 'Video creation failed',
                details: error.message
            });
        }
    }
};

export default videoController;
