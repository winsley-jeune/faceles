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

        // 7. SAVE
        const safeTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const filename = `${niche}_${safeTopic}_${Date.now()}.mp4`;
        const destPath = path.join(VIDEOS_DIR, filename);

        fs.copyFileSync(result.filePath, destPath);
        result.cleanup();

        console.log(`   ✅ DONE! Saved to: ${filename}`);

        res.json({
            success: true,
            video_path: destPath,
            filename: filename,
            message: "Video created successfully!"
        });

    } catch (err) {
        console.error("❌ Production Failed:", err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Engine running on port ${PORT}`));