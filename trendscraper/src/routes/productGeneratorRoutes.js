import Express from 'express'

// ------------------------------------------------------------------
//  PRODUCT VIDEO GENERATOR ROUTES
// ------------------------------------------------------------------

// Upload product media (images/videos)
app.post("/product/upload-media", productMediaUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        console.log(`📤 Product media uploaded: ${req.file.filename}`);

        res.json({
            success: true,
            path: req.file.path,
            filename: req.file.filename,
            size: req.file.size,
            type: req.file.mimetype.startsWith('image/') ? 'image' : 'video'
        });
    } catch (err) {
        console.error("❌ Upload failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// Generate product promotional video
app.post("/product/generate-video", async (req, res) => {
    const productData = req.body;

    if (!productData.name || !productData.description) {
        return res.status(400).json({ error: "Product name and description are required" });
    }

    const runId = uuidv4();
    console.log(`🎬 [${runId}] STARTING PRODUCT VIDEO: ${productData.name}`);

    try {
        // 1. SCRIPTING - Generate product storyboard
        console.log("   🧠 Generating product promotional script...");
        const storyboard = await productVideoGenerator.generateProductStoryboard(productData);

        // 2. PREPARE USER MEDIA
        console.log("   📁 Preparing user media files...");
        const userMedia = await productVideoGenerator.prepareUserMedia(productData.mediaFiles || [], VIDEOS_DIR);

        const fullScript = storyboard.map(s => s.text).join(" ");
        const imagePrompts = storyboard.map(s => s.image_prompt);
        const sceneTypes = storyboard.map(s => s.scene_type || 'body');

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
                    topic: productData.name,
                    sceneTypes: [scene.scene_type || 'body'],
                    outputDir: VIDEOS_DIR
                });
                visualPaths.push(generated[0]);
                console.log(`      Scene ${i + 1}: Generated AI visual`);
            }
        }

        // 4. VOICE
        console.log("   🎙️ Generating pro voiceover...");
        const audioBase64 = await generateSmartVoice(fullScript, VIDEOS_DIR);

        // 5. MUSIC (Upbeat for promotional content)
        console.log("   🎵 Selecting background music...");
        const musicTrack = await getMusicByEnergy('high', VIDEOS_DIR);

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
                subtitleStyle: 'viral',
                addVignette: true,
                addColorGrade: true,
                addTransitions: true,
                musicVolume: 0.12
            }
        });

        // 8. GENERATE SEO METADATA
        console.log("   📝 Generating SEO metadata...");
        const metadata = productVideoGenerator.generateProductMetadata(productData);

        // 9. SAVE VIDEO + METADATA
        const safeName = productData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        const timestamp = Date.now();
        const filenameVideo = `product_${safeName}_${timestamp}.mp4`;
        const filenameMeta = `product_${safeName}_${timestamp}.json`;

        const destPath = path.join(VIDEOS_DIR, filenameVideo);
        const metaPath = path.join(VIDEOS_DIR, filenameMeta);

        fs.copyFileSync(result.filePath, destPath);

        const metadataBundle = {
            type: 'product_video',
            productName: productData.name,
            productDescription: productData.description,
            specifications: productData.specifications,
            capabilities: productData.capabilities,
            cta: productData.cta,
            createdAt: new Date().toISOString(),
            videoFile: filenameVideo,
            platforms: metadata
        };
        fs.writeFileSync(metaPath, JSON.stringify(metadataBundle, null, 2));

        result.cleanup();

        console.log(`   ✅ DONE! Product Video: ${filenameVideo}`);

        res.json({
            success: true,
            videoPath: destPath,
            filename: filenameVideo,
            metadataPath: metaPath,
            metadata: metadataBundle,
            message: "Product video created successfully!"
        });

    } catch (err) {
        console.error("❌ Product Video Failed:", err);
        res.status(500).json({ error: err.message });
    }
});