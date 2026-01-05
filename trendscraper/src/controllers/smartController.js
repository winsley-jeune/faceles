/**
 * Smart Controller
 * Handles analytics-driven video generation powered by Viral Intelligence
 *
 * Core Philosophy:
 * - Uses REAL performance data to find what works (outliers/winners)
 * - Extracts psychological patterns (hooks, emotions, structures)
 * - Balances EXPLOIT (use proven) vs EXPLORE (try new)
 * - Avoids duplicates via fingerprinting
 * - Triggers engagement: outrage, curiosity, shock, fight in comments
 */
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Import video production pipeline
import { generateNicheStoryboard } from '../modules/storyboard.js';
import { generateProImages } from '../modules/visuals_pro.js';
import { generateSmartVoice } from '../modules/voice_pro.js';
import { getMusicByEnergy } from '../modules/audio_pro.js';
import { renderVideo } from '../modules/renderer.js';
import { generateEstimatedSubtitles, alignSubtitlesToAudio } from '../modules/subtitle_sync.js';
import { generateAllPlatformsContent } from '../modules/social_content.js';

// Import viral intelligence modules
import smartTopicGenerator from '../modules/analytics/smart_topic_generator.js';
import youtubeAnalytics from '../modules/analytics/youtube_analytics.js';
import viralIntelligence from '../modules/analytics/viral_intelligence.js';
import explorationConfig from '../modules/analytics/exploration_config.js';
import trainingData from '../modules/analytics/training_data.js';
import brandContext from '../modules/brand_context.js';

// Import uploaders
import youtubeAPI from '../modules/uploaders/youtube_api_uploader.js';

// Import job repository for async job creation
import jobRepository from '../database/repositories/jobRepository.js';

import env from '../config/env.js';

const VIDEOS_DIR = env.VIDEOS_DIR;

/**
 * Determine energy level for background music based on niche and emotion
 * High energy = outrage, shock, urgency
 * Low energy = curiosity, mystery, suspense
 */
const getEnergyLevel = (niche, emotion) => {
    // Emotion-based override first
    if (['outrage', 'shock', 'fear', 'anger'].includes(emotion)) return 'high';
    if (['curiosity', 'mystery', 'suspense'].includes(emotion)) return 'low';

    // Niche-based fallback
    const highEnergyNiches = ['finance', 'tech', 'money', 'news', 'hustle', 'stupid_hustle'];
    const lowEnergyNiches = ['health', 'psychology', 'history', 'secrets'];

    if (highEnergyNiches.includes(niche)) return 'high';
    if (lowEnergyNiches.includes(niche)) return 'low';

    return 'medium';
};

const smartController = {
    /**
     * GET /smart/topic
     * Get smart topic recommendation based on viral intelligence
     *
     * This endpoint:
     * 1. Optionally fetches fresh YouTube data for up-to-date patterns
     * 2. Analyzes emotions/outliers to find what's working
     * 3. Uses exploration config to decide exploit vs explore
     * 4. Generates a unique topic that avoids duplicates
     */
    getTopic: async (req, res) => {
        const userId = req.user.id;
        const { niche = 'general', fresh = 'true' } = req.query;
        console.log(`🧠 Getting smart topic recommendation for niche: ${niche}`);

        // Fetch best patterns early (needed for avoid list)
        const bestPatterns = await smartTopicGenerator.getBestPatterns(userId);

        // Optionally fetch fresh YouTube data
        let freshVideos = null;
        if (fresh === 'true') {
            try {
                const { videos } = await youtubeAnalytics.fetchAllVideoStats(userId);
                freshVideos = videos;
                console.log(`   🔄 Fetched ${videos.length} fresh videos from YouTube`);
            } catch (err) {
                console.log(`   ⚠️ Could not fetch fresh data: ${err.message}`);
            }
        }

        // Generate topic powered by viral intelligence
        const result = await smartTopicGenerator.generateSmartTopic(userId, niche, true, freshVideos);

        // Use HYBRID viral analysis instead of simple average
        const topVideos = result.viralIntelligence?.topVideos || [];
        const viralAnalysis = smartTopicGenerator.analyzeViralPotential(topVideos);
        const { viralThreshold, median, top10Percentile, max, scoreMethod, reasoning } = viralAnalysis;

        // Get videos with score 9+ using hybrid scoring
        const highViralVideos = topVideos.filter(v => {
            const views = v.stats?.views || 0;
            const score = parseFloat(smartTopicGenerator.calculateViralScore(views, viralAnalysis));
            return score >= 9;
        });

        // Calculate viral score for display - ALWAYS show best video's actual score
        const topViralScore = topVideos.length > 0
            ? parseFloat(smartTopicGenerator.calculateViralScore(topVideos[0]?.stats?.views || 0, viralAnalysis))
            : 0;

        // Dynamic "why this works" based on actual data
        let whyThisWorks = 'Generated using AI analysis of viral content patterns';
        if (highViralVideos.length > 0) {
            whyThisWorks = `Inspired by ${highViralVideos.length} viral videos (${viralThreshold.toLocaleString()}+ views)`;
        } else if (topVideos.length > 0) {
            whyThisWorks = `Learning from your top ${topVideos.length} videos (best: ${max.toLocaleString()} views)`;
        }

        res.json({
            success: true,
            recommendedTopic: result.topic,
            niche: result.niche,
            whyThisWorks,
            // Hybrid viral analysis
            patterns: {
                source: result.source,
                viralScore: topViralScore,
                basedOnVideos: highViralVideos.length,
                viralThreshold,
                scoreMethod,
                reasoning
            },
            avoid: bestPatterns.avoid?.map(a => a.title) || [],
            usedFreshData: !!freshVideos,
            viralIntelligence: result.viralIntelligence ? {
                // Hybrid metrics
                median,
                top10Percentile,
                max,
                viralThreshold,
                scoreMethod,
                reasoning,
                // Legacy for backwards compatibility
                avgViews: result.viralIntelligence.avgViews,
                outlierCount: result.viralIntelligence.outlierCount,
                viralScore: topViralScore,
                highViralCount: highViralVideos.length,
                topVideos: topVideos.slice(0, 5).map(v => ({
                    title: v.title,
                    views: v.stats?.views || 0,
                    score: parseFloat(smartTopicGenerator.calculateViralScore(v.stats?.views || 0, viralAnalysis))
                }))
            } : null
        });
    },

    /**
     * GET /smart/patterns
     * Get pattern analysis from analytics - shows what's working
     */
    getPatterns: async (req, res) => {
        const userId = req.user.id;
        const patterns = await smartTopicGenerator.getBestPatterns(userId);
        const recentTopics = await smartTopicGenerator.getRecentTopics(userId, 20);

        // Get exploration state
        const explorationState = await explorationConfig.loadConfig(userId);

        res.json({
            success: true,
            patterns,
            recentTopicsCount: recentTopics.length,
            recentTopics: recentTopics.slice(-10),
            exploration: {
                probability: explorationState.exploreProbability,
                stupidHustleEnabled: explorationState.stupidHustle?.enabled || false
            },
            hookPatterns: Object.keys(smartTopicGenerator.HOOK_PATTERNS)
        });
    },

    /**
     * POST /smart/create-and-post
     * Main endpoint: Create video using viral intelligence + post to YouTube
     *
     * Flow:
     * 1. Auto-select best niche if "auto"
     * 2. Generate smart topic (avoids duplicates, uses viral patterns)
     * 3. Create storyboard powered by viral intelligence
     * 4. Generate visuals, voice, music, subtitles
     * 5. Render video
     * 6. Post to YouTube (if autoPost=true)
     * 7. Log training data for ML feedback loop
     */
    createAndPost: async (req, res) => {
        const userId = req.user.id;
        let { niche = "auto", autoPost = true, topic: providedTopic = null } = req.body;

        // AUTO-SELECT BEST NICHE based on YouTube performance data
        if (niche === "auto" || !niche) {
            console.log("🎯 Auto-selecting best niche from YouTube analytics...");
            const bestNicheData = await youtubeAnalytics.getBestNiche(userId);
            niche = bestNicheData.niche;
            console.log(`   ✅ Selected: "${niche}" (${bestNicheData.avgViews || 'N/A'} avg views)`);
        }

        console.log(`🚀 SMART VIDEO GENERATION STARTED (niche: ${niche})`);

        // 1. USE PROVIDED TOPIC or generate new one from viral intelligence
        let topic, topicResult;
        if (providedTopic) {
            console.log("   🎯 Using provided topic from frontend...");
            topic = providedTopic;
            // Get patterns for the provided topic (for metadata purposes)
            const bestPatterns = await smartTopicGenerator.getBestPatterns(userId);
            topicResult = {
                topic: providedTopic,
                patterns: bestPatterns.hooks && bestPatterns.hooks[0]
                    ? { hook: bestPatterns.hooks[0].name, emotion: 'curiosity', structure: 'story' }
                    : { hook: 'general', emotion: 'curiosity', structure: 'story' },
                source: 'frontend-provided',
                viralIntelligence: null
            };
        } else {
            console.log("   🧠 Generating smart topic from viral intelligence...");
            topicResult = await smartTopicGenerator.generateSmartTopic(userId, niche, true);
            topic = topicResult.topic;
        }

        console.log(`   ✅ Topic: "${topic}"`);
        console.log(`   📊 Pattern: ${topicResult.patterns.hook} + ${topicResult.patterns.emotion}`);
        if (topicResult.viralIntelligence) {
            console.log(`   🧠 Based on ${topicResult.viralIntelligence.outlierCount} outliers, ${topicResult.viralIntelligence.avgViews} avg views`);
        }

        // 2. CREATE VIDEO with viral intelligence data
        const runId = uuidv4();
        console.log(`🎬 [${runId}] STARTING PRODUCTION: ${topic}`);

        // Pass viral intelligence to storyboard for better hooks/CTAs
        const viralData = topicResult.viralIntelligence || null;
        const storyboard = await generateNicheStoryboard(niche, topic, viralData);
        const fullScript = storyboard.map(s => s.text).join(" ");
        const imagePrompts = storyboard.map(s => s.image_prompt);
        const sceneTypes = storyboard.map(s => s.scene_type || 'body');

        const visualPaths = await generateProImages(imagePrompts, {
            topic, sceneTypes, outputDir: VIDEOS_DIR
        });

        const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR);

        // Energy level based on emotion + niche
        const energyLevel = getEnergyLevel(niche, topicResult.patterns.emotion);
        const musicTrack = await getMusicByEnergy(energyLevel, VIDEOS_DIR);

        let subtitles = await alignSubtitlesToAudio(audioBase64, fullScript);
        if (!subtitles) subtitles = generateEstimatedSubtitles(storyboard);

        // Subtitle style based on hook pattern
        const isViralStyle = ['stupid-hustle', 'rule-breaking', 'shocking-truth'].includes(topicResult.patterns.hook);

        const result = await renderVideo({
            audioBase64, subtitles, visuals: visualPaths, storyboard,
            musicPath: musicTrack ? musicTrack.path : null,
            options: {
                subtitleStyle: isViralStyle ? 'viral' : 'clean',
                addVignette: isViralStyle,
                addColorGrade: true,
                addTransitions: true,
                musicVolume: 0.10
            }
        });

        // 3. SAVE VIDEO
        const safeTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const timestamp = Date.now();
        const filename = `${niche}_${safeTopic}_${timestamp}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);
        fs.copyFileSync(result.filePath, destPath);

        // 4. GENERATE PLATFORM METADATA
        const metadata = await generateAllPlatformsContent(topic, niche);
        const metaPath = path.join(VIDEOS_DIR, `${niche}_${safeTopic}_${timestamp}.json`);

        const metadataBundle = {
            topic,
            niche,
            smartGeneration: {
                pattern: topicResult.patterns,
                source: topicResult.source,
                analytics: topicResult.analytics,
                viralIntelligence: topicResult.viralIntelligence
            },
            createdAt: new Date().toISOString(),
            videoFile: filename,
            platforms: metadata
        };

        // 5. LOG TRAINING DATA (ML feedback loop)
        const brandCtx = await brandContext.loadBrandContext(userId);
        const trainingSample = await trainingData.createTrainingSample(userId, {
            topic, niche, storyboard,
            visualTheme: 'auto',
            voicePreset: 'smart',
            hasBGM: !!musicTrack,
            bgmTrack: musicTrack?.track || '',
            bgmMood: energyLevel,
            contentGoal: brandCtx?.contentGoals?.primary || 'brand-awareness',
            targetAudience: brandCtx?.audience?.primary || '',
            generatedBy: 'smart-topic-generator',
            hookPattern: topicResult.patterns.hook,
            emotion: topicResult.patterns.emotion,
            youtube: metadata.youtube,
            tiktok: metadata.tiktok,
            facebook: metadata.facebook,
            instagram: metadata.instagram,
        });

        metadataBundle.trainingSampleId = trainingSample.id;
        fs.writeFileSync(metaPath, JSON.stringify(metadataBundle, null, 2));
        result.cleanup();

        console.log(`   ✅ Video created: ${filename}`);

        // 6. POST TO YOUTUBE
        let postResult = null;
        if (autoPost) {
            console.log(`   📤 Uploading to YouTube...`);
            postResult = await youtubeAPI.uploadToYouTubeAPI(userId, destPath, {
                title: metadata.youtube.title,
                description: metadata.youtube.description,
                hashtags: metadata.youtube.hashtags,
                tags: metadata.youtube.keywords || [],
                categoryId: '22'
            });

            // Link videoId to training sample + topic tracking
            if (postResult.success && postResult.videoId) {
                await trainingData.updatePerformance(userId, trainingSample.id, 'youtube', {
                    videoId: postResult.videoId
                });

                // Link to generated topics for performance tracking
                await smartTopicGenerator.linkTopicToVideo(userId, topic, postResult.videoId);
            }
        }

        res.json({
            success: true,
            smartGeneration: {
                topic: topic,
                pattern: topicResult.patterns.hook,
                emotion: topicResult.patterns.emotion,
                structure: topicResult.patterns.structure,
                source: topicResult.source,
                whyThisWorks: `Uses "${topicResult.patterns.hook}" pattern with "${topicResult.patterns.emotion}" emotion`
            },
            video: {
                path: destPath,
                filename: filename
            },
            viralIntelligence: topicResult.viralIntelligence ? {
                avgViews: topicResult.viralIntelligence.avgViews,
                outlierCount: topicResult.viralIntelligence.outlierCount,
                recommendation: topicResult.viralIntelligence.recommendation?.reason
            } : null,
            youtube: postResult,
            message: postResult?.success
                ? `Smart video created and posted! ${postResult.videoUrl}`
                : "Smart video created (not posted)"
        });
    },

    /**
     * POST /smart/check-duplicate
     * Check if topic would be duplicate before generating
     */
    checkDuplicate: async (req, res) => {
        const userId = req.user.id;
        const { topic } = req.body;
        if (!topic) {
            return res.status(400).json({ error: "Topic required" });
        }

        const result = await smartTopicGenerator.isTopicDuplicate(userId, topic);
        res.json({
            topic,
            ...result
        });
    },

    /**
     * POST /smart/create-job
     * Create a background job for video generation (async, non-blocking)
     *
     * This is the new job-based approach:
     * - Returns immediately with job ID
     * - Video generation happens in background
     * - Client polls /jobs/:id for progress
     * - User can close browser and check back later
     */
    createJob: async (req, res) => {
        const { niche = "general", topic = null, platforms = ['youtube'], autoPost = true } = req.body;
        const userId = req.user?.id || null;

        console.log(`🚀 Creating background video generation job (niche: ${niche}, platforms: ${platforms.join(', ')}, user: ${userId || 'anonymous'})`);

        try {
            // Create job in database
            const job = await jobRepository.createJob({
                userId,
                jobType: 'smart_video',
                inputParams: {
                    niche,
                    topic,
                    platforms: Array.isArray(platforms) ? platforms : ['youtube'],
                    autoPost
                },
                priority: 0
            });

            console.log(`   ✅ Job ${job.id} created and queued`);

            res.json({
                success: true,
                jobId: job.id,
                status: 'queued',
                message: 'Video generation job created. Poll GET /jobs/:id for progress.',
                pollUrl: `/jobs/${job.id}`
            });
        } catch (error) {
            console.error('Error creating job:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create video generation job',
                details: error.message
            });
        }
    }
};

export default smartController;
