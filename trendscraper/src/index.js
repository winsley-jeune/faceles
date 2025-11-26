import express from "express";
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
import youtubeAnalytics from "./modules/analytics/youtube_analytics.js";
import geminiAnalyst from "./modules/analytics/gemini_analyst.js";
import contentConfig from "./modules/analytics/content_config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

const VIDEOS_DIR = "/app/videos";
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });

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

        result.cleanup();

        console.log(`   ✅ DONE! Video: ${filenameVideo}`);
        console.log(`   ✅ DONE! Metadata: ${filenameMeta}`);

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
        res.json({ ...status, quota });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get quota info
app.get("/youtube-api/quota", (req, res) => {
    res.json(youtubeAPI.getQuotaStatus());
});

// Upload video via YouTube API
app.post("/youtube-api/upload", async (req, res) => {
    const { videoPath, title, description, hashtags = [], tags = [], categoryId } = req.body;

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
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload with auto-generated SEO content
app.post("/youtube-api/upload-smart", async (req, res) => {
    const { videoPath, topic, niche = "general" } = req.body;

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

        console.log('✅ Weekly analysis complete!');

        res.json({
            success: true,
            summary: data.summary,
            weekOverWeek,
            analysis,
            videoIdeas: videoIdeas.videoIdeas,
            configUpdated: true,
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

app.listen(PORT, () => console.log(`🚀 Engine running on port ${PORT}`));