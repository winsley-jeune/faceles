import 'dotenv/config';
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { dirname } from "path";

// --- MODULES ---
import { generateNicheStoryboard } from "./modules/storyboard.js";
import { generateProImages } from "./modules/visuals_pro.js";
import { generateSmartVoice } from "./modules/voice_pro.js";
import { getMusicByEnergy } from "./modules/audio_pro.js";
import { renderVideo } from "./modules/renderer.js";
import { generateEstimatedSubtitles, alignSubtitlesToAudio } from "./modules/subtitle_sync.js";
import autoPoster from "./modules/auto_poster.js";
import { generateAllPlatformsContent } from "./modules/social_content.js";
import youtubeAPI from "./modules/uploaders/youtube_api_uploader.js";
import facebookAPI from "./modules/uploaders/facebook_api_uploader.js";
import instagramAPI from "./modules/uploaders/instagram_api_uploader.js";
import tiktokAPI from "./modules/uploaders/tiktok_api_uploader.js";
import youtubeAnalytics from "./modules/analytics/youtube_analytics.js";
import geminiAnalyst from "./modules/analytics/gemini_analyst.js";
import contentConfig from "./modules/analytics/content_config.js";
import trainingData from "./modules/analytics/training_data.js";
import crossPlatform from "./modules/analytics/cross_platform.js";
import viralCloner from "./modules/viral_cloner.js";
import auth from "./modules/auth/auth.js";
import brandContext from "./modules/brand_context.js";
import smartTopicGenerator from "./modules/analytics/smart_topic_generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Enable CORS for dashboard
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5175'],
    credentials: true
}));

app.use(express.json({ limit: "50mb" }));

const VIDEOS_DIR = "/app/videos";
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });

// ------------------------------------------------------------------
//  AUTH MIDDLEWARE
// ------------------------------------------------------------------
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const userId = auth.verifyToken(token);

    if (!userId) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.userId = userId;
    req.user = auth.getUserById(userId);
    next();
};

// ------------------------------------------------------------------
//  AUTH ROUTES - Login with Google, Facebook, TikTok
// ------------------------------------------------------------------

// Get Google auth URL
app.get("/auth/google", (req, res) => {
    try {
        const authUrl = auth.getGoogleAuthUrl();
        res.json({ authUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Handle Google OAuth callback
app.post("/auth/google/callback", async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Authorization code required' });
        }
        const result = await auth.handleGoogleCallback(code);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Facebook auth URL
app.get("/auth/facebook", (req, res) => {
    try {
        const authUrl = auth.getFacebookAuthUrl();
        res.json({ authUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Handle Facebook OAuth callback
app.post("/auth/facebook/callback", async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Authorization code required' });
        }
        const result = await auth.handleFacebookCallback(code);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get TikTok auth URL
app.get("/auth/tiktok", (req, res) => {
    try {
        const authUrl = auth.getTikTokAuthUrl();
        res.json({ authUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Handle TikTok OAuth callback
app.post("/auth/tiktok/callback", async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Authorization code required' });
        }
        const result = await auth.handleTikTokCallback(code);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get current user
app.get("/auth/me", authMiddleware, (req, res) => {
    if (!req.user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar,
    });
});

// Logout (client-side handles token removal, this is optional)
app.post("/auth/logout", (req, res) => {
    res.json({ success: true });
});

// ------------------------------------------------------------------
//  ROUTE: /videos/list - List all videos with metadata
// ------------------------------------------------------------------
app.get("/videos/list", async (req, res) => {
    try {
        const files = fs.readdirSync(VIDEOS_DIR);
        const videos = [];

        // Get posting history to check which videos have been posted
        const history = autoPoster.getHistory();
        const postedVideos = new Map();

        // Build map of posted videos and their platforms
        history.forEach(item => {
            if (!postedVideos.has(item.videoPath)) {
                postedVideos.set(item.videoPath, {
                    youtube: false,
                    tiktok: false,
                    facebook: false,
                    instagram: false
                });
            }
            const platforms = postedVideos.get(item.videoPath);
            if (item.results) {
                if (item.results.youtube?.success) platforms.youtube = true;
                if (item.results.tiktok?.success) platforms.tiktok = true;
                if (item.results.facebook?.success) platforms.facebook = true;
                if (item.results.instagram?.success) platforms.instagram = true;
            }
        });

        for (const file of files) {
            if (!file.endsWith('.mp4')) continue;

            const videoPath = path.join(VIDEOS_DIR, file);
            const stats = fs.statSync(videoPath);

            // Try to load metadata JSON
            const metaFile = file.replace('.mp4', '.json');
            const metaPath = path.join(VIDEOS_DIR, metaFile);
            let metadata = null;

            if (fs.existsSync(metaPath)) {
                try {
                    metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                } catch (e) {
                    // Metadata file exists but couldn't be parsed
                }
            }

            // Check posting status
            const posted = postedVideos.get(videoPath) || {
                youtube: false,
                tiktok: false,
                facebook: false,
                instagram: false
            };

            const allPosted = posted.youtube && posted.tiktok && posted.facebook;

            videos.push({
                filename: file,
                path: videoPath,
                size: stats.size,
                createdAt: stats.birthtime,
                topic: metadata?.topic || file.replace('.mp4', '').replace(/_/g, ' '),
                niche: metadata?.niche || 'general',
                metadata: metadata?.platforms || null,
                posted,
                allPosted
            });
        }

        // Sort by creation date (newest first)
        videos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            videos,
            total: videos.length,
            unposted: videos.filter(v => !v.allPosted).length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
//  ROUTE: /create-full-video
// ------------------------------------------------------------------
app.post("/create-full-video", async (req, res) => {
    const { topic, niche = "general" } = req.body;

    if (!topic) return res.status(400).json({ error: "Topic is required" });

    const runId = uuidv4();
    console.log(`🎬 [${runId}] STARTING PRODUCTION: ${topic} (${niche})`);

    try {
        // 1. SCRIPTING
        console.log("   🧠 Generating smart educational script...");
        // Use niche storyboard if niche is provided, otherwise general
        const storyboard = await generateNicheStoryboard(niche, topic);

        const fullScript = storyboard.map(s => s.text).join(" ");
        const imagePrompts = storyboard.map(s => s.image_prompt);
        const sceneTypes = storyboard.map(s => s.scene_type || 'body');

        // 2. VISUALS
        console.log("   🎨 Generating consistent visuals...");
        const visualPaths = await generateProImages(imagePrompts, {
            topic: topic,
            sceneTypes: sceneTypes,
            outputDir: VIDEOS_DIR
        });

        // 3. VOICE
        console.log("   🎙️ Generating pro voiceover...");
        const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR);

        // 4. MUSIC (Smart Selection)
        console.log("   🎵 Selecting background music...");
        // Determine energy based on niche
        let energyLevel = 'medium';
        if (['finance', 'tech', 'money', 'news'].includes(niche)) energyLevel = 'high';
        if (['health', 'psychology', 'history'].includes(niche)) energyLevel = 'low';

        const musicTrack = await getMusicByEnergy(energyLevel, VIDEOS_DIR);

        // 5. SUBTITLES (With Alignment Check)
        console.log("   📝 Generating subtitles...");
        // FIX: Try to sync with actual audio first!
        let subtitles = await alignSubtitlesToAudio(audioBase64, fullScript);

        if (!subtitles) {
            console.log("   ⚠️ Alignment failed/skipped. Using estimation.");
            subtitles = generateEstimatedSubtitles(storyboard);
        } else {
            console.log("   ✅ Subtitles synced via SpeechAlign.");
        }

        // 6. RENDER
        console.log("   ⚡ Rendering final video...");
        const result = await renderVideo({
            audioBase64: audioBase64,
            subtitles: subtitles,
            visuals: visualPaths,
            storyboard: storyboard,
            musicPath: musicTrack ? musicTrack.path : null,
            options: {
                // For Education: Clean style. For Finance: Viral style.
                subtitleStyle: (niche === 'finance') ? 'viral' : 'clean',
                addVignette: (niche === 'finance'),
                addColorGrade: true,
                addTransitions: true,
                musicVolume: 0.10
            }
        });

        // 7. GENERATE SEO METADATA
        console.log("   📝 Generating SEO metadata for all platforms...");
        const metadata = await generateAllPlatformsContent(topic, niche);

        // 8. SAVE VIDEO + METADATA
        const safeTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const timestamp = Date.now();
        const filenameVideo = `${niche}_${safeTopic}_${timestamp}.mp4`;
        const filenameMeta = `${niche}_${safeTopic}_${timestamp}.json`;

        const destPath = path.join(VIDEOS_DIR, filenameVideo);
        const metaPath = path.join(VIDEOS_DIR, filenameMeta);

        fs.copyFileSync(result.filePath, destPath);

        // Save metadata JSON alongside video
        const metadataBundle = {
            topic,
            niche,
            createdAt: new Date().toISOString(),
            videoFile: filenameVideo,
            platforms: metadata
        };
        fs.writeFileSync(metaPath, JSON.stringify(metadataBundle, null, 2));

        // 9. LOG TO TRAINING DATA (for future ML training)
        console.log("   📊 Logging to training dataset...");
        const trainingSample = trainingData.createTrainingSample({
            topic,
            niche,
            storyboard,
            visualTheme: 'auto', // Will be detected
            voicePreset: 'smart', // Smart selection was used
            hasBGM: !!musicTrack,
            bgmTrack: musicTrack?.track || '',
            bgmMood: energyLevel,
            contentGoal: brandContext.loadBrandContext()?.contentGoals?.primary || 'brand-awareness',
            targetAudience: brandContext.loadBrandContext()?.audience?.primary || '',
            generatedBy: 'gemini-2.0-flash',
            youtube: metadata.youtube,
            tiktok: metadata.tiktok,
            facebook: metadata.facebook,
            instagram: metadata.instagram,
        });

        // Store training sample ID in metadata for later performance linking
        metadataBundle.trainingSampleId = trainingSample.id;
        fs.writeFileSync(metaPath, JSON.stringify(metadataBundle, null, 2));

        result.cleanup();

        console.log(`   ✅ DONE! Video: ${filenameVideo}`);
        console.log(`   ✅ DONE! Metadata: ${filenameMeta}`);
        console.log(`   ✅ Training sample: ${trainingSample.id}`);

        res.json({
            success: true,
            video_path: destPath,
            filename: filenameVideo,
            metadata_path: metaPath,
            metadata: metadataBundle,
            message: "Video & SEO metadata created successfully!"
        });

    } catch (err) {
        console.error("❌ Production Failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
//  AUTO-POSTER ROUTES
// ------------------------------------------------------------------

// Login to a platform (opens browser for manual login)
app.post("/social/login/:platform", async (req, res) => {
    const { platform } = req.params;
    try {
        console.log(`🔐 Starting ${platform} login...`);
        const result = await autoPoster.loginToPlatform(platform);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login to all platforms
app.post("/social/login-all", async (req, res) => {
    try {
        const results = await autoPoster.loginToAllPlatforms();
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check session status for all platforms
app.get("/social/sessions", async (req, res) => {
    try {
        const results = await autoPoster.checkAllSessions();
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add video to posting queue
app.post("/social/queue", async (req, res) => {
    const { videoPath, topic, niche } = req.body;
    if (!videoPath || !topic) {
        return res.status(400).json({ error: "videoPath and topic are required" });
    }
    try {
        const queueItem = await autoPoster.addToQueue(videoPath, topic, niche || 'general');
        res.json(queueItem);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get posting queue
app.get("/social/queue", (req, res) => {
    res.json(autoPoster.getQueue());
});

// Get posting history
app.get("/social/history", (req, res) => {
    res.json(autoPoster.getHistory());
});

// Post immediately to all platforms
app.post("/social/post-now", async (req, res) => {
    const { videoPath, topic, niche } = req.body;
    if (!videoPath || !topic) {
        return res.status(400).json({ error: "videoPath and topic are required" });
    }
    try {
        const results = await autoPoster.postNow(videoPath, topic, niche || 'general');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Post to specific platform
app.post("/social/post/:platform", async (req, res) => {
    const { platform } = req.params;
    const { videoPath, topic, niche } = req.body;
    if (!videoPath || !topic) {
        return res.status(400).json({ error: "videoPath and topic are required" });
    }
    try {
        const queueItem = await autoPoster.addToQueue(videoPath, topic, niche || 'general');
        const result = await autoPoster.postToPlatform(queueItem, platform);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Process next item in queue
app.post("/social/process-queue", async (req, res) => {
    try {
        const result = await autoPoster.processNextInQueue();
        res.json(result || { message: "No pending items in queue" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get/Update settings
app.get("/social/settings", (req, res) => {
    res.json(autoPoster.getSettings());
});

app.post("/social/settings", (req, res) => {
    try {
        autoPoster.saveSettings(req.body);
        res.json({ success: true, message: "Settings saved" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start/Stop scheduler
app.post("/social/scheduler/start", (req, res) => {
    try {
        autoPoster.startScheduler();
        res.json({ success: true, message: "Scheduler started" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/social/scheduler/stop", (req, res) => {
    try {
        autoPoster.stopScheduler();
        res.json({ success: true, message: "Scheduler stopped" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
//  CREATE VIDEO + AUTO-POST (Combined endpoint)
// ------------------------------------------------------------------
app.post("/create-and-post", async (req, res) => {
    const { topic, niche = "general", autoPost = true } = req.body;

    if (!topic) return res.status(400).json({ error: "Topic is required" });

    try {
        // First, create the video (reuse existing logic)
        const runId = uuidv4();
        console.log(`🎬 [${runId}] STARTING PRODUCTION + AUTO-POST: ${topic}`);

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

        const result = await renderVideo({
            audioBase64, subtitles, visuals: visualPaths, storyboard,
            musicPath: musicTrack ? musicTrack.path : null,
            options: {
                subtitleStyle: (niche === 'finance') ? 'viral' : 'clean',
                addVignette: (niche === 'finance'),
                addColorGrade: true, addTransitions: true, musicVolume: 0.10
            }
        });

        const safeTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const filename = `${niche}_${safeTopic}_${Date.now()}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);
        fs.copyFileSync(result.filePath, destPath);
        result.cleanup();

        console.log(`   ✅ Video created: ${filename}`);

        // Auto-post if enabled
        let postResults = null;
        if (autoPost) {
            console.log(`   📤 Auto-posting to all platforms...`);
            postResults = await autoPoster.postNow(destPath, topic, niche);
        } else {
            // Just add to queue
            await autoPoster.addToQueue(destPath, topic, niche);
            console.log(`   📋 Added to posting queue`);
        }

        res.json({
            success: true,
            video_path: destPath,
            filename,
            postResults,
            message: autoPost ? "Video created and posted!" : "Video created and queued!"
        });

    } catch (err) {
        console.error("❌ Production Failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
//  SMART VIDEO GENERATION (Analytics-Driven, No Duplicates)
// ------------------------------------------------------------------

// Get smart topic recommendation based on analytics
app.get("/smart/topic", async (req, res) => {
    try {
        const { niche = 'general' } = req.query;
        console.log(`🧠 Getting smart topic recommendation for niche: ${niche}`);

        const recommendation = await smartTopicGenerator.getTopicRecommendation(niche);

        res.json({
            success: true,
            ...recommendation
        });
    } catch (err) {
        console.error("❌ Smart topic generation failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get pattern analysis from analytics
app.get("/smart/patterns", (req, res) => {
    try {
        const patterns = smartTopicGenerator.getBestPatterns();
        const recentTopics = smartTopicGenerator.getRecentTopics(20);

        res.json({
            success: true,
            patterns,
            recentTopicsCount: recentTopics.length,
            recentTopics: recentTopics.slice(-10)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MAIN: Create video using smart topic generation + post to YouTube
app.post("/smart/create-and-post", async (req, res) => {
    const { niche = "general", autoPost = true } = req.body;

    try {
        console.log(`🚀 SMART VIDEO GENERATION STARTED (niche: ${niche})`);

        // 1. GENERATE SMART TOPIC (Based on analytics, avoiding duplicates)
        console.log("   🧠 Generating smart topic from analytics...");
        const topicResult = await smartTopicGenerator.generateSmartTopic(niche, true);
        const topic = topicResult.topic;

        console.log(`   ✅ Topic: "${topic}"`);
        console.log(`   📊 Using pattern: ${topicResult.patterns.hook} (${topicResult.analytics.topHook?.avgViews || 'N/A'} avg views)`);

        // 2. CREATE VIDEO (Reuse existing logic)
        const runId = uuidv4();
        console.log(`🎬 [${runId}] STARTING PRODUCTION: ${topic}`);

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

        const result = await renderVideo({
            audioBase64, subtitles, visuals: visualPaths, storyboard,
            musicPath: musicTrack ? musicTrack.path : null,
            options: {
                subtitleStyle: (niche === 'finance') ? 'viral' : 'clean',
                addVignette: (niche === 'finance'),
                addColorGrade: true, addTransitions: true, musicVolume: 0.10
            }
        });

        // 3. SAVE VIDEO
        const safeTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const timestamp = Date.now();
        const filename = `${niche}_${safeTopic}_${timestamp}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);
        fs.copyFileSync(result.filePath, destPath);

        // 4. GENERATE METADATA
        const metadata = await generateAllPlatformsContent(topic, niche);
        const metaPath = path.join(VIDEOS_DIR, `${niche}_${safeTopic}_${timestamp}.json`);

        const metadataBundle = {
            topic,
            niche,
            smartGeneration: {
                pattern: topicResult.patterns,
                source: topicResult.source,
                analytics: topicResult.analytics
            },
            createdAt: new Date().toISOString(),
            videoFile: filename,
            platforms: metadata
        };

        // 5. LOG TRAINING DATA
        const trainingSample = trainingData.createTrainingSample({
            topic, niche, storyboard,
            visualTheme: 'auto',
            voicePreset: 'smart',
            hasBGM: !!musicTrack,
            bgmTrack: musicTrack?.track || '',
            bgmMood: energyLevel,
            contentGoal: brandContext.loadBrandContext()?.contentGoals?.primary || 'brand-awareness',
            targetAudience: brandContext.loadBrandContext()?.audience?.primary || '',
            generatedBy: 'smart-topic-generator',
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
            postResult = await youtubeAPI.uploadToYouTubeAPI(destPath, {
                title: metadata.youtube.title,
                description: metadata.youtube.description,
                hashtags: metadata.youtube.hashtags,
                tags: metadata.youtube.keywords || [],
                categoryId: '22'
            });

            // Link videoId to training sample
            if (postResult.success && postResult.videoId) {
                trainingData.updatePerformance(trainingSample.id, {
                    youtube: { videoId: postResult.videoId }
                });

                // Update generated topics with videoId
                const topics = smartTopicGenerator.loadGeneratedTopics();
                const lastTopic = topics.topics[topics.topics.length - 1];
                if (lastTopic) {
                    lastTopic.videoId = postResult.videoId;
                    fs.writeFileSync('/app/data/generated_topics.json', JSON.stringify(topics, null, 2));
                }
            }
        }

        res.json({
            success: true,
            smartGeneration: {
                topic: topic,
                pattern: topicResult.patterns.hook,
                structure: topicResult.patterns.structure,
                source: topicResult.source,
                whyThisWorks: `Uses "${topicResult.patterns.hook}" pattern with ${topicResult.analytics.topHook?.avgViews || 'N/A'} avg views`
            },
            video: {
                path: destPath,
                filename: filename
            },
            youtube: postResult,
            message: postResult?.success
                ? `Smart video created and posted! ${postResult.videoUrl}`
                : "Smart video created (not posted)"
        });

    } catch (err) {
        console.error("❌ Smart production failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// Check if topic would be duplicate
app.post("/smart/check-duplicate", (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic) return res.status(400).json({ error: "Topic required" });

        const result = smartTopicGenerator.isTopicDuplicate(topic);
        res.json({
            topic,
            ...result
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
//  YOUTUBE API ROUTES (Official API - 6 uploads/day)
// ------------------------------------------------------------------

// Get YouTube API authorization URL
app.get("/youtube-api/auth", async (req, res) => {
    try {
        const authUrl = youtubeAPI.getAuthUrl();

        // Start OAuth server to receive callback
        youtubeAPI.startOAuthServer()
            .then(result => console.log('   ✅ YouTube API authorized!'))
            .catch(err => console.log('   ⚠️ OAuth flow cancelled or timed out'));

        res.json({
            message: "Visit the URL below to authorize YouTube API access",
            authUrl: authUrl,
            instructions: [
                "1. Click or copy the authUrl to your browser",
                "2. Login with your YouTube account",
                "3. Grant permissions to upload videos",
                "4. You'll be redirected back automatically"
            ]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check YouTube API status
app.get("/youtube-api/status", async (req, res) => {
    try {
        const status = await youtubeAPI.checkYouTubeAPIStatus();
        const quota = youtubeAPI.getQuotaStatus();
        // Standardize response for dashboard
        res.json({
            connected: status.authorized,
            channelName: status.channel?.title,
            channelId: status.channel?.id,
            thumbnail: status.channel?.thumbnail,
            message: status.message,
            quota,
            // Keep original fields for backwards compatibility
            ...status
        });
    } catch (err) {
        res.status(500).json({ connected: false, error: err.message });
    }
});

// Get quota info
app.get("/youtube-api/quota", (req, res) => {
    res.json(youtubeAPI.getQuotaStatus());
});

// Upload video via YouTube API
app.post("/youtube-api/upload", async (req, res) => {
    const { videoPath, title, description, hashtags = [], tags = [], categoryId, trainingSampleId } = req.body;

    if (!videoPath) {
        return res.status(400).json({ error: "videoPath is required" });
    }

    try {
        console.log(`📤 YouTube API upload: ${videoPath}`);
        const result = await youtubeAPI.uploadToYouTubeAPI(videoPath, {
            title: title || "Short Video #Shorts",
            description: description || "",
            hashtags,
            tags,
            categoryId: categoryId || "22"
        });

        // Link videoId to training sample if provided
        if (result.success && result.videoId && trainingSampleId) {
            try {
                const samples = trainingData.loadAllSamples();
                const sample = samples.find(s => s.id === trainingSampleId);
                if (sample) {
                    sample.platformVariants = sample.platformVariants || {};
                    sample.platformVariants.youtube = {
                        ...sample.platformVariants.youtube,
                        videoId: result.videoId,
                        videoUrl: result.videoUrl,
                        uploadedAt: new Date().toISOString()
                    };
                    // Rewrite samples
                    const jsonlPath = path.join(__dirname, 'data/training/video_training_data.jsonl');
                    fs.writeFileSync(jsonlPath, samples.map(s => JSON.stringify(s)).join('\n') + '\n');
                    console.log(`   📊 Linked YouTube videoId ${result.videoId} to training sample ${trainingSampleId}`);
                }
            } catch (e) {
                console.log(`   ⚠️ Could not link to training sample: ${e.message}`);
            }
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload with auto-generated SEO content
app.post("/youtube-api/upload-smart", async (req, res) => {
    const { videoPath, topic, niche = "general", trainingSampleId } = req.body;

    if (!videoPath || !topic) {
        return res.status(400).json({ error: "videoPath and topic are required" });
    }

    try {
        // Generate SEO content
        console.log(`📤 Smart YouTube API upload: ${topic}`);
        const content = await generateAllPlatformsContent(topic, niche);
        const ytContent = content.youtube;

        const result = await youtubeAPI.uploadToYouTubeAPI(videoPath, {
            title: ytContent.title,
            description: ytContent.fullCaption || ytContent.description,
            hashtags: ytContent.hashtags,
            tags: ytContent.hashtags.map(h => h.replace('#', '')),
            categoryId: niche === 'tech' ? '28' : niche === 'psychology' ? '27' : '22'
        });

        // Link videoId to training sample if provided
        if (result.success && result.videoId && trainingSampleId) {
            try {
                const samples = trainingData.loadAllSamples();
                const sample = samples.find(s => s.id === trainingSampleId);
                if (sample) {
                    sample.platformVariants = sample.platformVariants || {};
                    sample.platformVariants.youtube = {
                        videoId: result.videoId,
                        videoUrl: result.videoUrl,
                        title: ytContent.title,
                        uploadedAt: new Date().toISOString()
                    };
                    const jsonlPath = path.join(__dirname, 'data/training/video_training_data.jsonl');
                    fs.writeFileSync(jsonlPath, samples.map(s => JSON.stringify(s)).join('\n') + '\n');
                    console.log(`   📊 Linked YouTube videoId to training sample`);
                }
            } catch (e) {
                console.log(`   ⚠️ Could not link to training sample: ${e.message}`);
            }
        }

        res.json({
            ...result,
            seoContent: ytContent
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manual code exchange (fallback if redirect doesn't work)
app.post("/youtube-api/exchange-code", async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: "Authorization code is required" });
    }
    try {
        const result = await youtubeAPI.exchangeCode(code);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Disconnect YouTube API
app.post("/youtube-api/disconnect", (req, res) => {
    try {
        const result = youtubeAPI.disconnectYouTubeAPI();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
//  ANALYTICS ROUTES - AI Marketing Executive
// ------------------------------------------------------------------

// Fetch current video stats from channel
app.get("/analytics/videos", async (req, res) => {
    try {
        const data = await youtubeAnalytics.fetchAllVideoStats();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Quick health check
app.get("/analytics/health", async (req, res) => {
    try {
        const data = await youtubeAnalytics.fetchAllVideoStats();
        const health = await geminiAnalyst.quickHealthCheck(data.summary);
        res.json({ summary: data.summary, health });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Run full weekly analysis (main endpoint)
app.post("/analytics/weekly-analysis", async (req, res) => {
    try {
        console.log('📊 Starting weekly analysis...');

        // 1. Fetch current stats
        const data = await youtubeAnalytics.fetchAllVideoStats();

        // 2. Save snapshot
        youtubeAnalytics.saveAnalyticsSnapshot(data);

        // 3. Get week-over-week comparison
        const weekOverWeek = youtubeAnalytics.getWeekOverWeekComparison();

        // 4. Run Gemini analysis
        const analysis = await geminiAnalyst.analyzeWeeklyPerformance({
            ...data,
            weekOverWeek
        });

        // 5. Save analysis
        youtubeAnalytics.saveAnalysis(analysis);

        // 6. Generate video ideas based on analysis
        const videoIdeas = await geminiAnalyst.generateVideoIdeas(analysis, 5);

        // 7. AUTO-UPDATE CONTENT CONFIG (This is the key connection!)
        console.log('   🔄 Updating content generation config...');
        const updatedConfig = contentConfig.updateFromAnalysis(analysis);

        // 8. UPDATE WINNING PATTERNS (Game Theory System)
        console.log('   🎯 Updating YouTube winning patterns...');
        youtubeAnalytics.updateWinningPatterns(data.videos);

        // 9. SYNC TO TRAINING DATA
        console.log('   📊 Syncing performance to training data...');
        let trainingSynced = 0;
        const samples = trainingData.loadAllSamples();

        for (const video of data.videos) {
            // Find training sample with matching videoId
            const sample = samples.find(s =>
                s.platformVariants?.youtube?.videoId === video.videoId
            );

            if (sample && !sample.performance?.youtube) {
                const scoreResult = youtubeAnalytics.calculateMinimaxScore(video);
                trainingData.updatePerformance(sample.id, 'youtube', {
                    views: video.stats.views,
                    likes: video.stats.likes,
                    comments: video.stats.comments,
                    daysSincePublished: video.daysSincePublished,
                    ...scoreResult
                });
                trainingSynced++;
            }
        }

        if (trainingSynced > 0) {
            console.log(`   ✅ Synced ${trainingSynced} videos to training data`);
        }

        // 10. Aggregate cross-platform patterns
        console.log('   🌐 Aggregating cross-platform patterns...');
        await crossPlatform.aggregateAllPlatforms();

        console.log('✅ Weekly analysis complete!');

        res.json({
            success: true,
            summary: data.summary,
            weekOverWeek,
            analysis,
            videoIdeas: videoIdeas.videoIdeas,
            configUpdated: true,
            trainingSynced,
            message: "Weekly analysis complete! Content config auto-updated."
        });

    } catch (err) {
        console.error('❌ Weekly analysis failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get analysis history
app.get("/analytics/history", (req, res) => {
    try {
        const history = youtubeAnalytics.loadAnalyticsHistory();
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Compare two specific videos
app.post("/analytics/compare", async (req, res) => {
    const { videoIdA, videoIdB } = req.body;
    if (!videoIdA || !videoIdB) {
        return res.status(400).json({ error: "videoIdA and videoIdB are required" });
    }

    try {
        const stats = await youtubeAnalytics.getVideoStats([videoIdA, videoIdB]);
        if (stats.length < 2) {
            return res.status(404).json({ error: "One or both videos not found" });
        }

        const videoA = { ...stats[0], daysSincePublished: Math.floor((Date.now() - new Date(stats[0].publishedAt).getTime()) / (1000 * 60 * 60 * 24)) };
        const videoB = { ...stats[1], daysSincePublished: Math.floor((Date.now() - new Date(stats[1].publishedAt).getTime()) / (1000 * 60 * 60 * 24)) };

        const comparison = await geminiAnalyst.compareVideos(videoA, videoB);
        res.json({ videoA, videoB, comparison });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate video ideas from latest analysis
app.post("/analytics/generate-ideas", async (req, res) => {
    const { count = 5 } = req.body;

    try {
        const history = youtubeAnalytics.loadAnalyticsHistory();
        if (!history.analyses || history.analyses.length === 0) {
            return res.status(400).json({
                error: "No analysis history found. Run /analytics/weekly-analysis first."
            });
        }

        const latestAnalysis = history.analyses[history.analyses.length - 1];
        const ideas = await geminiAnalyst.generateVideoIdeas(latestAnalysis, count);

        res.json(ideas);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auto-generate videos from AI recommendations
app.post("/analytics/auto-generate", async (req, res) => {
    const { count = 1 } = req.body;

    try {
        const history = youtubeAnalytics.loadAnalyticsHistory();
        if (!history.analyses || history.analyses.length === 0) {
            return res.status(400).json({
                error: "No analysis history found. Run /analytics/weekly-analysis first."
            });
        }

        const latestAnalysis = history.analyses[history.analyses.length - 1];

        // Get suggested videos from latest analysis
        const suggestedVideos = latestAnalysis.suggestedVideos || [];
        if (suggestedVideos.length === 0) {
            return res.status(400).json({ error: "No video suggestions in latest analysis" });
        }

        const results = [];
        const videosToGenerate = suggestedVideos.slice(0, count);

        for (const suggestion of videosToGenerate) {
            console.log(`🎬 Auto-generating: ${suggestion.topic}`);

            // This would trigger video generation
            // For now, just return what would be generated
            results.push({
                topic: suggestion.topic,
                niche: suggestion.niche,
                reason: suggestion.whyThisWillWork,
                status: "queued"
            });
        }

        res.json({
            message: `${results.length} video(s) queued for generation`,
            videos: results,
            tip: "Use POST /create-full-video with these topics to generate"
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get current content config
app.get("/analytics/config", (req, res) => {
    try {
        const config = contentConfig.loadContentConfig();
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get the prompt enhancement that will be injected into storyboard
app.get("/analytics/config/prompt", (req, res) => {
    try {
        const enhancement = contentConfig.getStoryboardEnhancement();
        res.json({ promptEnhancement: enhancement });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset content config to defaults
app.post("/analytics/config/reset", (req, res) => {
    try {
        const config = contentConfig.resetConfig();
        res.json({ success: true, message: "Config reset to defaults", config });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get next AI-suggested video to generate
app.get("/analytics/next-video", (req, res) => {
    try {
        const nextVideo = contentConfig.getNextSuggestedVideo();
        if (nextVideo) {
            res.json({ hasVideo: true, video: nextVideo });
        } else {
            res.json({
                hasVideo: false,
                message: "No suggested videos. Run /analytics/weekly-analysis first."
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
//  FACEBOOK API ROUTES (Official Graph API for Reels)
// ------------------------------------------------------------------

// Get Facebook API authorization URL
app.get("/facebook-api/auth", async (req, res) => {
    try {
        const authUrl = facebookAPI.getAuthUrl();

        // Start OAuth server to receive callback
        facebookAPI.startOAuthServer()
            .then(result => console.log(`   ✅ Facebook API authorized! Page: ${result.pageName}`))
            .catch(err => console.log('   ⚠️ OAuth flow cancelled or timed out'));

        res.json({
            message: "Visit the URL below to authorize Facebook API access",
            authUrl: authUrl,
            instructions: [
                "1. Click or copy the authUrl to your browser",
                "2. Login with your Facebook account",
                "3. Select the Page you want to post Reels to",
                "4. Grant all requested permissions",
                "5. You'll be redirected back automatically"
            ],
            requirements: [
                "You need a Facebook Page (not just a profile)",
                "Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET env vars",
                "Your Facebook App must have 'publish_video' permission"
            ]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check Facebook API status
app.get("/facebook-api/status", async (req, res) => {
    try {
        const status = await facebookAPI.checkFacebookAPIStatus();
        // Standardize response for dashboard
        res.json({
            connected: status.authorized,
            pageName: status.page?.name,
            pageId: status.page?.id,
            followers: status.page?.followers,
            expiresAt: status.expiresAt,
            message: status.message,
            // Keep original fields for backwards compatibility
            ...status
        });
    } catch (err) {
        res.status(500).json({ connected: false, error: err.message });
    }
});

// Get list of user's Facebook Pages
app.get("/facebook-api/pages", async (req, res) => {
    try {
        const pages = await facebookAPI.getPages();
        res.json({ pages });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Switch to a different Facebook Page
app.post("/facebook-api/switch-page", async (req, res) => {
    const { pageId } = req.body;
    if (!pageId) {
        return res.status(400).json({ error: "pageId is required" });
    }
    try {
        const result = await facebookAPI.switchPage(pageId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload Reel via Facebook API
app.post("/facebook-api/upload", async (req, res) => {
    const { videoPath, description, hashtags = [] } = req.body;

    if (!videoPath) {
        return res.status(400).json({ error: "videoPath is required" });
    }

    try {
        console.log(`📤 Facebook API upload: ${videoPath}`);
        const result = await facebookAPI.uploadToFacebookAPI(videoPath, {
            description: description || "",
            hashtags
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload with auto-generated SEO content
app.post("/facebook-api/upload-smart", async (req, res) => {
    const { videoPath, topic, niche = "general" } = req.body;

    if (!videoPath || !topic) {
        return res.status(400).json({ error: "videoPath and topic are required" });
    }

    try {
        // Generate SEO content
        console.log(`📤 Smart Facebook API upload: ${topic}`);
        const content = await generateAllPlatformsContent(topic, niche);
        const fbContent = content.facebook;

        const result = await facebookAPI.uploadToFacebookAPI(videoPath, {
            description: fbContent.fullCaption || fbContent.description,
            hashtags: fbContent.hashtags
        });

        res.json({
            ...result,
            seoContent: fbContent
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Disconnect Facebook API
app.post("/facebook-api/disconnect", (req, res) => {
    try {
        const result = facebookAPI.disconnectFacebookAPI();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
//  INSTAGRAM API ROUTES (via Facebook Graph API)
// ------------------------------------------------------------------

// Check Instagram connection status
app.get("/instagram-api/status", async (req, res) => {
    try {
        const status = await instagramAPI.checkInstagramAPIStatus();
        // Standardize response for dashboard
        res.json({
            connected: status.authorized,
            instagramUsername: status.instagram?.username,
            instagramName: status.instagram?.name,
            followers: status.instagram?.followers,
            posts: status.instagram?.posts,
            pageName: status.facebookPage?.name,
            message: status.message,
            // Keep original fields for backwards compatibility
            ...status
        });
    } catch (err) {
        res.status(500).json({ connected: false, error: err.message });
    }
});

// Connect Instagram (requires Facebook auth first)
app.get("/instagram-api/connect", async (req, res) => {
    try {
        const igAccount = await instagramAPI.getInstagramAccountId();
        res.json({
            success: true,
            message: `Connected to Instagram: @${igAccount.username}`,
            instagram: igAccount
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err.message,
            instructions: [
                "1. First authorize Facebook via /facebook-api/auth",
                "2. Go to your Facebook Page Settings",
                "3. Click 'Linked Accounts' → 'Instagram'",
                "4. Connect your Instagram Business/Creator account",
                "5. Return here and try again"
            ]
        });
    }
});

// Get recent Instagram posts
app.get("/instagram-api/media", async (req, res) => {
    const { limit = 10 } = req.query;
    try {
        const media = await instagramAPI.getInstagramMedia(parseInt(limit));
        res.json({ media });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload Reel to Instagram (manual caption/hashtags)
app.post("/instagram-api/upload", async (req, res) => {
    const { videoPath, caption, hashtags = [] } = req.body;

    if (!videoPath) {
        return res.status(400).json({ error: "videoPath is required" });
    }

    try {
        console.log(`📤 Instagram API upload: ${videoPath}`);
        const result = await instagramAPI.uploadToInstagramAPI(videoPath, {
            caption: caption || "",
            hashtags
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload Reel with auto-generated SEO content
app.post("/instagram-api/upload-smart", async (req, res) => {
    const { videoPath, topic, niche = "general" } = req.body;

    if (!videoPath || !topic) {
        return res.status(400).json({ error: "videoPath and topic are required" });
    }

    try {
        // Generate Instagram-optimized SEO content
        console.log(`📤 Smart Instagram API upload: ${topic}`);
        const content = await generateAllPlatformsContent(topic, niche);
        const igContent = content.instagram;

        const result = await instagramAPI.uploadToInstagramAPI(videoPath, {
            caption: igContent.description,
            hashtags: igContent.hashtags
        });

        res.json({
            ...result,
            seoContent: igContent
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
//  TIKTOK API ROUTES
// ------------------------------------------------------------------

// Get TikTok authorization URL
app.get("/tiktok-api/auth", async (req, res) => {
    try {
        const { authUrl, state } = tiktokAPI.getAuthUrl();

        // Start OAuth callback server
        tiktokAPI.startOAuthServer()
            .then(result => console.log('   ✅ TikTok OAuth completed:', result))
            .catch(err => console.error('   ❌ TikTok OAuth failed:', err.message));

        res.json({
            message: "Visit the URL below to authorize TikTok API access",
            authUrl,
            state,
            instructions: [
                "1. Click or copy the authUrl to your browser",
                "2. Login with your TikTok account",
                "3. Grant all requested permissions",
                "4. You'll be redirected back automatically"
            ],
            requirements: [
                "TikTok Developer Account (developers.tiktok.com)",
                "App with Content Posting API access",
                "Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET env vars"
            ]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check TikTok authorization status
app.get("/tiktok-api/status", async (req, res) => {
    try {
        const status = await tiktokAPI.checkTikTokAPIStatus();
        // Standardize response for dashboard
        res.json({
            connected: status.authorized,
            username: status.user?.username,
            displayName: status.user?.displayName,
            avatarUrl: status.user?.avatarUrl,
            expiresAt: status.expiresAt,
            message: status.message,
            // Keep original fields for backwards compatibility
            ...status
        });
    } catch (err) {
        res.status(500).json({ connected: false, error: err.message });
    }
});

// Get creator info (check API access)
app.get("/tiktok-api/creator-info", async (req, res) => {
    try {
        const info = await tiktokAPI.getCreatorInfo();
        res.json(info);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload video to TikTok (manual caption/hashtags)
app.post("/tiktok-api/upload", async (req, res) => {
    const { videoPath, caption, hashtags = [] } = req.body;

    if (!videoPath) {
        return res.status(400).json({ error: "videoPath is required" });
    }

    try {
        console.log(`📤 TikTok API upload: ${videoPath}`);
        const result = await tiktokAPI.uploadToTikTokAPI(videoPath, {
            caption: caption || "",
            hashtags
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload with auto-generated SEO content
app.post("/tiktok-api/upload-smart", async (req, res) => {
    const { videoPath, topic, niche = "general" } = req.body;

    if (!videoPath || !topic) {
        return res.status(400).json({ error: "videoPath and topic are required" });
    }

    try {
        // Generate TikTok-optimized SEO content
        console.log(`📤 Smart TikTok API upload: ${topic}`);
        const content = await generateAllPlatformsContent(topic, niche);
        const ttContent = content.tiktok;

        const result = await tiktokAPI.uploadToTikTokAPI(videoPath, {
            caption: ttContent.description,
            hashtags: ttContent.hashtags
        });

        res.json({
            ...result,
            seoContent: ttContent
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Disconnect TikTok API
app.post("/tiktok-api/disconnect", (req, res) => {
    try {
        const result = tiktokAPI.disconnectTikTokAPI();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
//  VIRAL CLONER ROUTES - Discover & Clone Viral Content
// ------------------------------------------------------------------

// Fetch viral TikTok videos
app.get("/virals/tiktok", async (req, res) => {
    const { region = 'US', limit = 20 } = req.query;
    try {
        const result = await viralCloner.fetchTikTokVirals({ region, limit: parseInt(limit) });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch viral TikTok sounds
app.get("/virals/tiktok/sounds", async (req, res) => {
    const { region = 'US', limit = 20 } = req.query;
    try {
        const result = await viralCloner.fetchTikTokSounds({ region, limit: parseInt(limit) });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch viral YouTube Shorts
app.get("/virals/youtube", async (req, res) => {
    const { niche = '', limit = 20 } = req.query;
    try {
        const result = await viralCloner.fetchYouTubeVirals({ niche, maxResults: parseInt(limit) });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch viral Instagram Reels
app.get("/virals/instagram", async (req, res) => {
    const { hashtag = '', limit = 20 } = req.query;
    try {
        const result = await viralCloner.fetchInstagramVirals({ hashtag, limit: parseInt(limit) });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch viral Facebook Reels
app.get("/virals/facebook", async (req, res) => {
    const { limit = 20 } = req.query;
    try {
        const result = await viralCloner.fetchFacebookVirals({ limit: parseInt(limit) });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clone a single viral post (create unique version with AI)
app.post("/virals/clone", async (req, res) => {
    const { viral, niche = 'general', style = 'educational' } = req.body;
    if (!viral) {
        return res.status(400).json({ error: "viral object is required" });
    }
    try {
        const result = await viralCloner.cloneViralContent(viral, { niche, style });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Discover virals from all platforms and generate unique concepts
app.post("/virals/discover", async (req, res) => {
    const {
        niche = 'general',
        platforms = ['tiktok'],
        limit = 10,
        cloneTop = 5
    } = req.body;

    try {
        console.log(`🔍 Discovering virals for niche: ${niche}`);
        const result = await viralCloner.discoverAndClone({
            niche,
            platforms,
            limit,
            cloneTop
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Discover virals AND auto-generate video from top concept
app.post("/virals/discover-and-create", async (req, res) => {
    const {
        niche = 'general',
        platforms = ['tiktok'],
        autoPost = false
    } = req.body;

    try {
        console.log(`🚀 Discover → Clone → Create pipeline for: ${niche}`);

        // Step 1: Discover and clone virals
        const discovery = await viralCloner.discoverAndClone({
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

        // Step 2: Pick the highest viral potential concept
        const bestConcept = discovery.concepts.sort((a, b) =>
            (b.viralPotential?.score || 0) - (a.viralPotential?.score || 0)
        )[0];

        const topic = bestConcept.newConcept.topic;

        console.log(`   🎯 Selected topic: ${topic}`);
        console.log(`   📊 Viral score: ${bestConcept.viralPotential?.score}/10`);

        // Step 3: Generate the video
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

        // Step 4: Auto-post if enabled
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

    } catch (err) {
        console.error("❌ Viral pipeline failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get ready-to-use topics from discovered virals
app.get("/virals/topics", async (req, res) => {
    const { niche = 'general', count = 5 } = req.query;

    try {
        const discovery = await viralCloner.discoverAndClone({
            niche,
            platforms: ['tiktok'],
            limit: 20,
            cloneTop: parseInt(count)
        });

        if (!discovery.success) {
            return res.status(400).json({ error: "Discovery failed" });
        }

        // Return just the ready-to-use topics
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

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
//  BRAND CONTEXT ROUTES - Brand Identity & Content Goals
// ------------------------------------------------------------------

// Get full brand context
app.get("/brand/context", (req, res) => {
    try {
        const context = brandContext.loadBrandContext();
        res.json(context);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save full brand context
app.post("/brand/context", (req, res) => {
    try {
        const success = brandContext.saveBrandContext(req.body);
        if (success) {
            res.json({ success: true, message: "Brand context saved" });
        } else {
            res.status(500).json({ error: "Failed to save brand context" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Complete onboarding with brand data
app.post("/brand/onboarding", (req, res) => {
    try {
        const success = brandContext.completeOnboarding(req.body);
        if (success) {
            res.json({ success: true, message: "Brand onboarding complete!" });
        } else {
            res.status(500).json({ error: "Failed to complete onboarding" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update specific section of brand context
app.patch("/brand/context/:section", (req, res) => {
    const { section } = req.params;
    try {
        const success = brandContext.updateBrandSection(section, req.body);
        if (success) {
            res.json({ success: true, message: `${section} updated` });
        } else {
            res.status(500).json({ error: `Failed to update ${section}` });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check if brand context is complete
app.get("/brand/status", (req, res) => {
    try {
        const context = brandContext.loadBrandContext();
        const isComplete = brandContext.isBrandContextComplete();
        res.json({
            onboardingComplete: context.onboardingComplete,
            isComplete,
            businessName: context.business?.name || null,
            industry: context.business?.industry || null,
            primaryGoal: context.contentGoals?.primary || null,
            productsCount: context.products?.length || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get brand prompt context for AI generation
app.get("/brand/prompt-context", (req, res) => {
    try {
        const promptContext = brandContext.generatePromptContext();
        if (promptContext) {
            res.json({ hasContext: true, ...promptContext });
        } else {
            res.json({
                hasContext: false,
                message: "Brand context not configured. Complete onboarding first."
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get brand summary for AI prompts
app.get("/brand/summary", (req, res) => {
    try {
        const summary = brandContext.generateBrandSummary();
        res.json({
            hasSummary: summary.length > 0,
            summary
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PRODUCT MANAGEMENT ---

// Add a product
app.post("/brand/products", (req, res) => {
    try {
        const product = brandContext.addProduct(req.body);
        res.json({ success: true, product });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a product
app.put("/brand/products/:productId", (req, res) => {
    const { productId } = req.params;
    try {
        const product = brandContext.updateProduct(productId, req.body);
        if (product) {
            res.json({ success: true, product });
        } else {
            res.status(404).json({ error: "Product not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a product
app.delete("/brand/products/:productId", (req, res) => {
    const { productId } = req.params;
    try {
        const success = brandContext.deleteProduct(productId);
        if (success) {
            res.json({ success: true, message: "Product deleted" });
        } else {
            res.status(404).json({ error: "Product not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CTA & TEMPLATE HELPERS ---

// Get CTA templates for a content goal
app.get("/brand/templates/cta/:goal", (req, res) => {
    const { goal } = req.params;
    try {
        const templates = brandContext.getCTATemplates(goal);
        res.json({ goal, templates });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get hook templates for an industry
app.get("/brand/templates/hooks/:industry", (req, res) => {
    const { industry } = req.params;
    try {
        const templates = brandContext.getHookTemplates(industry);
        res.json({ industry, templates });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get industry preset settings
app.get("/brand/presets/:industry", (req, res) => {
    const { industry } = req.params;
    try {
        const preset = brandContext.getIndustryPreset(industry);
        if (preset) {
            res.json({ industry, preset });
        } else {
            res.json({
                industry,
                preset: null,
                message: "No preset for this industry"
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
//  TRAINING DATA ROUTES - ML Dataset Management
// ------------------------------------------------------------------

// Get training data statistics
app.get("/training/stats", (req, res) => {
    try {
        const stats = trainingData.getDatasetStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all training samples (paginated)
app.get("/training/samples", (req, res) => {
    const { limit = 50, offset = 0 } = req.query;
    try {
        const samples = trainingData.loadAllSamples();
        const paginated = samples.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
        res.json({
            total: samples.length,
            offset: parseInt(offset),
            limit: parseInt(limit),
            samples: paginated
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a specific training sample by ID
app.get("/training/samples/:sampleId", (req, res) => {
    const { sampleId } = req.params;
    try {
        const samples = trainingData.loadAllSamples();
        const sample = samples.find(s => s.id === sampleId);
        if (sample) {
            res.json(sample);
        } else {
            res.status(404).json({ error: "Sample not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update performance data for a training sample
app.post("/training/samples/:sampleId/performance", (req, res) => {
    const { sampleId } = req.params;
    const { platform, performance } = req.body;

    if (!platform || !performance) {
        return res.status(400).json({ error: "platform and performance are required" });
    }

    try {
        const updated = trainingData.updatePerformance(sampleId, platform, performance);
        if (updated) {
            res.json({ success: true, message: `Performance updated for ${platform}` });
        } else {
            res.status(404).json({ error: "Sample not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export training data to CSV
app.get("/training/export/csv", (req, res) => {
    try {
        const filepath = trainingData.exportToCSV();
        if (filepath) {
            res.download(filepath, 'training_data.csv');
        } else {
            res.status(404).json({ error: "No training data to export" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export training data for embeddings (JSONL format)
app.get("/training/export/embeddings", (req, res) => {
    try {
        const filepath = trainingData.exportForEmbeddings();
        if (filepath) {
            res.download(filepath, 'texts_for_embedding.jsonl');
        } else {
            res.status(404).json({ error: "No training data to export" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export raw JSONL training data
app.get("/training/export/jsonl", (req, res) => {
    try {
        const samples = trainingData.loadAllSamples();
        if (samples.length === 0) {
            return res.status(404).json({ error: "No training data to export" });
        }
        res.setHeader('Content-Type', 'application/jsonl');
        res.setHeader('Content-Disposition', 'attachment; filename="video_training_data.jsonl"');
        res.send(samples.map(s => JSON.stringify(s)).join('\n'));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get samples with performance data (labeled data for supervised learning)
app.get("/training/labeled", (req, res) => {
    try {
        const samples = trainingData.loadAllSamples();
        const labeled = samples.filter(s =>
            s.performance?.youtube || s.performance?.tiktok ||
            s.performance?.facebook || s.performance?.instagram
        );
        res.json({
            total: labeled.length,
            unlabeled: samples.length - labeled.length,
            samples: labeled
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Sync analytics data to training samples (batch update)
app.post("/training/sync-analytics", async (req, res) => {
    try {
        console.log("📊 Syncing analytics to training data...");

        // Get all samples
        const samples = trainingData.loadAllSamples();
        let updated = 0;

        // For each sample without performance data, try to fetch it
        for (const sample of samples) {
            // Check if we have platform data to link
            if (sample.platformVariants?.youtube?.videoId && !sample.performance?.youtube) {
                try {
                    // Try to fetch YouTube performance
                    const ytStats = await youtubeAnalytics.getVideoStats([sample.platformVariants.youtube.videoId]);
                    if (ytStats?.length > 0) {
                        const score = youtubeAnalytics.calculateMinimaxScore?.(ytStats[0]) || { score: 0, label: 'UNKNOWN' };
                        trainingData.updatePerformance(sample.id, 'youtube', {
                            ...ytStats[0],
                            ...score
                        });
                        updated++;
                    }
                } catch (e) {
                    // Skip if can't fetch
                }
            }
        }

        res.json({
            success: true,
            message: `Synced ${updated} samples with analytics data`,
            totalSamples: samples.length,
            updated
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
//  CROSS-PLATFORM ANALYTICS ROUTES
// ------------------------------------------------------------------

// Run full cross-platform analysis
app.post("/analytics/cross-platform", async (req, res) => {
    try {
        console.log("📊 Running cross-platform analysis...");
        const analysis = await crossPlatform.runFullAnalysis();
        res.json(analysis);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get unified winning patterns
app.get("/analytics/patterns", (req, res) => {
    try {
        const patterns = crossPlatform.loadWinningPatterns();
        res.json(patterns);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get content recommendation (what to create next)
app.get("/analytics/recommendation", (req, res) => {
    try {
        const recommendation = crossPlatform.getContentRecommendation();
        res.json(recommendation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get unified prompt for content generation
app.get("/analytics/unified-prompt", (req, res) => {
    try {
        const prompt = crossPlatform.generateUnifiedPrompt();
        res.json({ prompt });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get platform-specific prompt
app.get("/analytics/prompt/:platform", (req, res) => {
    const { platform } = req.params;
    try {
        const prompt = crossPlatform.getPlatformPrompt(platform);
        res.json({ platform, prompt });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Engine running on port ${PORT}`));