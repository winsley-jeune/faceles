/**
 * Training Video Controller
 * Generates professional training and educational videos
 * Supports: Safety, SOP, Onboarding, Equipment Operation, General Training
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';

import { generateProImages } from '../modules/visuals_pro.js';
import { generateSmartVoice } from '../modules/voice_pro.js';
import { getMusicByEnergy } from '../modules/audio_pro.js';
import { renderVideo } from '../modules/renderer.js';
import { generateEstimatedSubtitles, alignSubtitlesToAudio } from '../modules/subtitle_sync.js';
import trainingVideoGenerator from '../modules/training_video_generator.js';
import documentToVideo from '../modules/document_to_video.js';

import env from '../config/env.js';

const VIDEOS_DIR = env.VIDEOS_DIR;

// Multer config for training media uploads
const trainingMediaStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(VIDEOS_DIR, 'training_media');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `training_${Date.now()}${ext}`);
    }
});

const trainingMediaUpload = multer({
    storage: trainingMediaStorage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/webp',
            'video/mp4', 'video/quicktime',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'text/markdown'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only images, videos, PDFs, Word docs, and text files are allowed'));
        }
    }
});

const trainingVideoController = {
    // Multer middleware for file upload
    uploadMiddleware: trainingMediaUpload.single('file'),
    uploadMultipleMiddleware: trainingMediaUpload.array('files', 10),

    /**
     * Upload training media (images/videos/documents)
     */
    uploadMedia: async (req, res) => {
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        console.log(`📤 [User: ${userId}] Training media uploaded: ${req.file.filename}`);

        res.json({
            success: true,
            path: req.file.path,
            filename: req.file.filename,
            size: req.file.size,
            type: req.file.mimetype.startsWith('image/') ? 'image' :
                  req.file.mimetype.startsWith('video/') ? 'video' : 'document'
        });
    },

    /**
     * Get available video types and their templates
     */
    getVideoTypes: async (req, res) => {
        const videoTypes = trainingVideoGenerator.getVideoTypes();
        res.json({
            success: true,
            videoTypes
        });
    },

    /**
     * Get template details for a specific video type
     */
    getTemplateDetails: async (req, res) => {
        const { videoType } = req.params;
        const template = trainingVideoGenerator.getTemplateDetails(videoType);
        res.json({
            success: true,
            template
        });
    },

    /**
     * Generate training video
     */
    generateVideo: async (req, res) => {
        const userId = req.user.id;
        const trainingData = req.body;

        if (!trainingData.title) {
            return res.status(400).json({ error: "Training title is required" });
        }

        const runId = uuidv4();
        console.log(`🎬 [${runId}] [User: ${userId}] STARTING TRAINING VIDEO: ${trainingData.title}`);
        console.log(`   📚 Video Type: ${trainingData.videoType || 'training'}`);

        try {
            // 1. SCRIPTING - Generate training storyboard
            console.log("   🧠 Generating training video script...");
            const { storyboard, voicePreset, videoType, template } = await trainingVideoGenerator.generateTrainingStoryboard(trainingData);

            console.log(`   📋 Generated ${storyboard.length} scenes using ${template} template`);

            // 2. PREPARE USER MEDIA
            console.log("   📁 Preparing user media files...");
            const userMedia = await prepareUserMedia(trainingData.mediaFiles || [], VIDEOS_DIR);

            const fullScript = storyboard.map(s => s.text).join(" ");

            // 3. VISUALS - Mix user media with AI-generated images
            console.log("   🎨 Generating visuals (mixing user media + AI)...");
            const visualPaths = [];

            for (let i = 0; i < storyboard.length; i++) {
                const scene = storyboard[i];
                if (scene.useUserMedia && scene.mediaIndex !== null && userMedia[scene.mediaIndex]) {
                    // Use user-provided media
                    visualPaths.push(userMedia[scene.mediaIndex].path);
                    console.log(`      Scene ${i + 1}: Using user media #${scene.mediaIndex}`);
                } else {
                    // Generate AI visual for this scene
                    const generated = await generateProImages([scene.image_prompt], {
                        topic: trainingData.title,
                        sceneTypes: [scene.scene_type || 'body'],
                        outputDir: VIDEOS_DIR
                    });
                    visualPaths.push(generated[0]);
                    console.log(`      Scene ${i + 1}: Generated AI visual`);
                }
            }

            // 4. VOICE - Use template-recommended voice preset
            console.log(`   🎙️ Generating voiceover (preset: ${voicePreset})...`);
            const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR, {
                preferPreset: voicePreset
            });

            // 5. MUSIC - Select appropriate music based on video type
            console.log("   🎵 Selecting background music...");
            const musicEnergy = getMusicEnergyForType(videoType);
            const musicTrack = await getMusicByEnergy(musicEnergy, VIDEOS_DIR);

            // 6. SUBTITLES
            console.log("   📝 Generating subtitles...");
            let subtitles = await alignSubtitlesToAudio(audioBase64, fullScript);
            if (!subtitles) {
                console.log("   ⚠️ Alignment failed. Using estimation.");
                subtitles = generateEstimatedSubtitles(storyboard);
            }

            // 7. RENDER
            console.log("   ⚡ Rendering final video...");
            const result = await renderVideo({
                audioBase64: audioBase64,
                subtitles: subtitles,
                visuals: visualPaths,
                storyboard: storyboard,
                musicPath: musicTrack ? musicTrack.path : null,
                options: {
                    subtitleStyle: getSubtitleStyleForType(videoType),
                    addVignette: false,
                    addColorGrade: true,
                    addTransitions: true,
                    musicVolume: 0.08 // Lower for training videos
                }
            });

            // 8. GENERATE METADATA
            console.log("   📝 Generating metadata...");
            const metadata = trainingVideoGenerator.generateTrainingMetadata(trainingData);

            // 9. SAVE VIDEO + METADATA
            const safeName = trainingData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
            const timestamp = Date.now();
            const filenameVideo = `training_${videoType}_${safeName}_${timestamp}.mp4`;
            const filenameMeta = `training_${videoType}_${safeName}_${timestamp}.json`;

            const destPath = path.join(VIDEOS_DIR, filenameVideo);
            const metaPath = path.join(VIDEOS_DIR, filenameMeta);

            fs.copyFileSync(result.filePath, destPath);

            const metadataBundle = {
                type: 'training_video',
                userId: userId,
                videoType: videoType,
                template: template,
                title: trainingData.title,
                description: trainingData.description,
                targetAudience: trainingData.targetAudience,
                company: trainingData.company,
                keyPoints: trainingData.keyPoints,
                steps: trainingData.steps,
                duration: trainingData.duration,
                createdAt: new Date().toISOString(),
                videoFile: filenameVideo,
                voicePreset: voicePreset,
                sceneCount: storyboard.length,
                platforms: metadata
            };
            fs.writeFileSync(metaPath, JSON.stringify(metadataBundle, null, 2));

            result.cleanup();

            console.log(`   ✅ DONE! [User: ${userId}] Training Video: ${filenameVideo}`);

            res.json({
                success: true,
                videoPath: destPath,
                filename: filenameVideo,
                metadataPath: metaPath,
                metadata: metadataBundle,
                message: `${template} video created successfully!`
            });

        } catch (error) {
            console.error(`   ❌ Training video generation failed:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Preview storyboard without generating full video
     */
    previewStoryboard: async (req, res) => {
        const userId = req.user.id;
        const trainingData = req.body;

        if (!trainingData.title) {
            return res.status(400).json({ error: "Training title is required" });
        }

        try {
            console.log(`📋 [User: ${userId}] Generating storyboard preview for: ${trainingData.title}`);
            const result = await trainingVideoGenerator.generateTrainingStoryboard(trainingData);

            res.json({
                success: true,
                storyboard: result.storyboard,
                voicePreset: result.voicePreset,
                videoType: result.videoType,
                template: result.template,
                estimatedDuration: result.storyboard.reduce((sum, scene) => sum + scene.duration, 0)
            });
        } catch (error) {
            console.error("Storyboard preview failed:", error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Get supported document types
     */
    getSupportedDocuments: async (req, res) => {
        res.json({
            success: true,
            supportedTypes: documentToVideo.SUPPORTED_TYPES,
            extensions: documentToVideo.getSupportedExtensions()
        });
    },

    /**
     * Upload document for conversion
     */
    uploadDocument: async (req, res) => {
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const validation = documentToVideo.validateDocument(req.file.path);
        if (!validation.valid) {
            fs.unlinkSync(req.file.path); // Clean up invalid file
            return res.status(400).json({ error: validation.error });
        }

        console.log(`📄 [User: ${userId}] Document uploaded: ${req.file.filename}`);

        res.json({
            success: true,
            path: req.file.path,
            filename: req.file.filename,
            size: req.file.size,
            type: 'document'
        });
    },

    /**
     * Analyze document and extract structure
     */
    analyzeDocument: async (req, res) => {
        const userId = req.user.id;
        const { documentPath, videoType } = req.body;

        if (!documentPath) {
            return res.status(400).json({ error: 'Document path is required' });
        }

        try {
            console.log(`📄 [User: ${userId}] Analyzing document: ${path.basename(documentPath)}`);

            const result = await documentToVideo.documentToTrainingVideo(documentPath, {
                videoType: videoType || 'training'
            });

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('Document analysis failed:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Convert document directly to training video
     */
    documentToVideo: async (req, res) => {
        const userId = req.user.id;
        const {
            documentPath,
            videoType,
            company,
            targetAudience,
            duration
        } = req.body;

        if (!documentPath) {
            return res.status(400).json({ error: 'Document path is required' });
        }

        try {
            console.log(`🎬 [User: ${userId}] Converting document to video: ${path.basename(documentPath)}`);

            // 1. Convert document to training data
            const { trainingData, documentInfo, structure } = await documentToVideo.documentToTrainingVideo(
                documentPath,
                {
                    videoType: videoType || 'training',
                    company,
                    targetAudience,
                    targetDuration: duration || 180
                }
            );

            // 2. Generate storyboard
            console.log("   🧠 Generating video script...");
            const { storyboard, voicePreset, template } = await trainingVideoGenerator.generateTrainingStoryboard(trainingData);

            // 3. Generate visuals
            console.log("   🎨 Generating visuals...");
            const visualPaths = [];
            for (let i = 0; i < storyboard.length; i++) {
                const scene = storyboard[i];
                const generated = await generateProImages([scene.image_prompt], {
                    topic: trainingData.title,
                    sceneTypes: [scene.scene_type || 'body'],
                    outputDir: VIDEOS_DIR
                });
                visualPaths.push(generated[0]);
            }

            // 4. Generate voice
            const fullScript = storyboard.map(s => s.text).join(" ");
            console.log(`   🎙️ Generating voiceover (preset: ${voicePreset})...`);
            const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR, {
                preferPreset: voicePreset
            });

            // 5. Music
            const musicTrack = await getMusicByEnergy('low', VIDEOS_DIR);

            // 6. Subtitles
            let subtitles = await alignSubtitlesToAudio(audioBase64, fullScript);
            if (!subtitles) {
                subtitles = generateEstimatedSubtitles(storyboard);
            }

            // 7. Render
            console.log("   ⚡ Rendering final video...");
            const result = await renderVideo({
                audioBase64,
                subtitles,
                visuals: visualPaths,
                storyboard,
                musicPath: musicTrack?.path,
                options: {
                    subtitleStyle: 'clean',
                    musicVolume: 0.08
                }
            });

            // 8. Save
            const safeName = trainingData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
            const timestamp = Date.now();
            const filenameVideo = `doc_${videoType || 'training'}_${safeName}_${timestamp}.mp4`;

            const destPath = path.join(VIDEOS_DIR, filenameVideo);
            fs.copyFileSync(result.filePath, destPath);

            result.cleanup();

            console.log(`   ✅ Document converted to video: ${filenameVideo}`);

            res.json({
                success: true,
                videoPath: destPath,
                filename: filenameVideo,
                documentInfo,
                extractedStructure: structure,
                message: 'Document successfully converted to training video!'
            });

        } catch (error) {
            console.error('Document to video conversion failed:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
};

/**
 * Helper: Prepare user media files
 */
async function prepareUserMedia(mediaFiles, outputDir) {
    const prepared = [];

    for (const media of mediaFiles) {
        if (media.path && fs.existsSync(media.path)) {
            prepared.push({
                path: media.path,
                type: media.type || 'image'
            });
        }
    }

    return prepared;
}

/**
 * Helper: Get music energy level based on video type
 */
function getMusicEnergyForType(videoType) {
    const energyMap = {
        safety: 'low',        // Serious, attention-grabbing
        sop: 'low',           // Instructional, calm
        onboarding: 'medium', // Welcoming, upbeat
        equipment_operation: 'low',
        training: 'medium'
    };
    return energyMap[videoType] || 'medium';
}

/**
 * Helper: Get subtitle style based on video type
 */
function getSubtitleStyleForType(videoType) {
    const styleMap = {
        safety: 'bold',       // High visibility
        sop: 'clean',         // Professional
        onboarding: 'friendly', // Warm
        equipment_operation: 'clean',
        training: 'clean'
    };
    return styleMap[videoType] || 'clean';
}

export default trainingVideoController;
