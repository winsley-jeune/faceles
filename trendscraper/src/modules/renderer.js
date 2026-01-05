import fs from "fs";
import path from "path";
import { exec, execFile } from "child_process";
import { v4 as uuidv4 } from "uuid";

// SECURITY: Use exec only for simple commands, execFile for FFmpeg with user paths
const execPromise = (cmd) => new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
            console.error("FFmpeg stderr:", stderr);
            reject(new Error(stderr || error.message));
        } else {
            resolve(stdout);
        }
    });
});

// SECURITY: execFile prevents shell injection by passing args as array
const execFilePromise = (command, args = []) => new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
            console.error("FFmpeg stderr:", stderr);
            reject(new Error(stderr || error.message));
        } else {
            resolve(stdout);
        }
    });
});

// SECURITY: Validate file paths are absolute and within allowed directories
const validateFilePath = (filePath, allowedDirs = ['/tmp', '/app/videos', process.cwd()]) => {
    const absolutePath = path.resolve(filePath);
    const isAllowed = allowedDirs.some(dir => absolutePath.startsWith(path.resolve(dir)));
    if (!isAllowed) {
        throw new Error(`Path not allowed: ${filePath}`);
    }
    return absolutePath;
};

// SECURITY: Escape special characters in FFmpeg filter strings
const escapeFFmpegFilterPath = (filePath) => {
    // FFmpeg filter requires escaping: \ : ' [ ]
    return filePath
        .replace(/\\/g, '/')           // Convert Windows paths to forward slashes
        .replace(/:/g, '\\:')          // Escape colons (except drive letters handled by forward slash)
        .replace(/'/g, "'\\''")        // Escape single quotes
        .replace(/\[/g, '\\[')         // Escape brackets
        .replace(/\]/g, '\\]');
};

// Animation presets for different scene types
const ANIMATION_PRESETS = {
    hook: {
        zoom: "z='min(zoom+0.012,1.8)'", // Faster, more aggressive zoom
        shake: true,
        flash: true, // Add flash effect
        description: "Aggressive zoom + shake + flash for hook"
    },
    body: {
        zoom: "z='min(zoom+0.002,1.3)'",
        shake: false,
        flash: false,
        description: "Smooth cinematic zoom"
    },
    cta: {
        zoom: "z='1.2+0.08*sin(on/8)'", // More noticeable pulse
        shake: false,
        flash: false,
        description: "Pulsing urgency effect"
    },
    dramatic: {
        zoom: "z='min(zoom+0.001,1.2)'",
        shake: false,
        flash: false,
        description: "Slow dramatic reveal"
    }
};

// Subtitle style presets - MrBeast/viral style
// OPTIMIZED: Smaller fonts, positioned lower to show AI art, fast karaoke pacing
const SUBTITLE_STYLES = {
    mrbeast: {
        fontName: "Arial",
        fontSize: 24,
        primaryColor: "&H00FFFFFF",
        outlineColor: "&H00000000",
        backColor: "&H80000000",
        bold: -1,
        outline: 3,
        shadow: 2,
        alignment: 2,
        marginV: 40,
        description: "Classic MrBeast style - white with black outline"
    },
    viral: {
        fontName: "Impact",
        fontSize: 26,
        primaryColor: "&H0000FFFF", // Yellow
        outlineColor: "&H00000000",
        backColor: "&H00000000",
        bold: -1,
        outline: 3,
        shadow: 0,
        alignment: 2,
        marginV: 35,
        description: "Bold yellow - maximum attention grab"
    },
    dramatic: {
        fontName: "Arial",
        fontSize: 24,
        primaryColor: "&H00FFFFFF",
        outlineColor: "&H000000FF", // Red outline
        backColor: "&H40000000",
        bold: -1,
        outline: 2,
        shadow: 2,
        alignment: 2,
        marginV: 40,
        description: "White with red outline - dramatic/conspiracy"
    },
    clean: {
        fontName: "Arial",
        fontSize: 22,
        primaryColor: "&H00FFFFFF",
        outlineColor: "&H00000000",
        backColor: "&H00000000",
        bold: -1,
        outline: 2,
        shadow: 1,
        alignment: 2,
        marginV: 35,
        description: "Clean minimal style - educational content"
    },
    neon: {
        fontName: "Impact",
        fontSize: 24,
        primaryColor: "&H00FF00FF", // Magenta/Pink
        outlineColor: "&H0000FFFF", // Cyan outline
        backColor: "&H00000000",
        bold: -1,
        outline: 3,
        shadow: 0,
        alignment: 2,
        marginV: 35,
        description: "Neon colors - tech/cyber content"
    },
    energetic: {
        fontName: "Impact",
        fontSize: 26,
        primaryColor: "&H0000D4FF", // Orange
        outlineColor: "&H00000000",
        backColor: "&H00000000",
        bold: -1,
        outline: 3,
        shadow: 2,
        alignment: 2,
        marginV: 35,
        description: "Bold orange - high energy content"
    },
    yellow_viral: {
        fontName: "Impact",
        fontSize: 26,
        primaryColor: "&H00FFFF00", // Yellow (RGBA: BBGGRR)
        outlineColor: "&H00000000",
        backColor: "&H00000000",
        bold: -1,
        outline: 3,
        shadow: 0,
        alignment: 2,
        marginV: 35,
        description: "Bold yellow - maximum attention grab"
    }
};

// Map visual themes to subtitle styles
const THEME_TO_SUBTITLE = {
    cyber_neon: 'neon',
    corporate_clean: 'clean',
    dark_cinematic: 'dramatic',
    warm_organic: 'mrbeast',
    bold_vibrant: 'energetic',
    scientific: 'clean'
};

// Transition types
const TRANSITIONS = {
    fade: { filter: "fade=t=out:st={end}:d=0.3,fade=t=in:st=0:d=0.3", duration: 0.3 },
    flash: { filter: "fade=t=out:st={end}:d=0.15:c=white,fade=t=in:st=0:d=0.15:c=white", duration: 0.15 },
    none: { filter: "", duration: 0 }
};

/**
 * Apply animation effect to a single image with transitions
 */
const animateImage = async (imagePath, duration, outputDir, sceneType = 'body', isFirst = false, isLast = false) => {
    const filename = path.basename(imagePath, path.extname(imagePath));
    const videoPath = path.join(outputDir, `${filename}.mp4`);

    const preset = ANIMATION_PRESETS[sceneType] || ANIMATION_PRESETS.body;
    const fps = 30;
    const totalFrames = Math.floor(duration * fps);

    // Build filter chain
    const filters = [
        `scale=1080:1920:force_original_aspect_ratio=increase`,
        `crop=1080:1920`,
        `zoompan=${preset.zoom}:d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=${fps}`,
        `unsharp=5:5:1.0:5:5:0.0`
    ];

    // Add shake effect for hook scenes
    if (preset.shake) {
        filters.push(`crop=in_w-8:in_h-8:4+random(0)*4:4+random(1)*4`);
        filters.push(`scale=1080:1920`);
    }

    // Add flash effect at start for hook
    if (preset.flash && isFirst) {
        filters.push(`fade=t=in:st=0:d=0.2:c=white`);
    }

    // Add fade out for transitions (except last clip)
    if (!isLast) {
        filters.push(`fade=t=out:st=${duration - 0.25}:d=0.25`);
    }

    // Add fade in (except first clip)
    if (!isFirst) {
        filters.push(`fade=t=in:st=0:d=0.25`);
    }

    const filterChain = filters.join(",");

    // SECURITY: Validate paths and use execFile with argument array
    const validatedImagePath = validateFilePath(imagePath);
    const validatedVideoPath = validateFilePath(videoPath);

    const args = [
        '-y',
        '-loop', '1',
        '-i', validatedImagePath,
        '-vf', filterChain,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '18',
        '-t', String(duration),
        '-pix_fmt', 'yuv420p',
        '-r', String(fps),
        validatedVideoPath
    ];

    await execFilePromise('ffmpeg', args);
    return videoPath;
};

/**
 * Generate ASS subtitle file with custom styling
 */
const generateStyledSubtitles = async (srtPath, assPath, style = 'viral') => {
    const styleConfig = SUBTITLE_STYLES[style] || SUBTITLE_STYLES.viral;

    // SECURITY: Validate paths and use execFile
    const validatedSrtPath = validateFilePath(srtPath);
    const validatedAssPath = validateFilePath(assPath);

    await execFilePromise('ffmpeg', ['-y', '-i', validatedSrtPath, validatedAssPath]);

    let assContent = fs.readFileSync(assPath, 'utf8');

    const styleLine = `Style: Default,${styleConfig.fontName},${styleConfig.fontSize},` +
        `${styleConfig.primaryColor},&H000000FF,${styleConfig.outlineColor},${styleConfig.backColor},` +
        `${styleConfig.bold},0,0,0,100,100,0,0,1,${styleConfig.outline},${styleConfig.shadow},` +
        `${styleConfig.alignment},10,10,${styleConfig.marginV},1`;

    assContent = assContent.replace(/Style: Default,[^\n]+/, styleLine);
    fs.writeFileSync(assPath, assContent);

    return assPath;
};

/**
 * Create word-by-word animated subtitles
 */
const createAnimatedSubtitles = (storyboard, outputPath) => {
    let srtContent = "";
    let currentTime = 0;
    let subtitleIndex = 1;

    for (const scene of storyboard) {
        const words = scene.text.split(' ');
        const sceneDuration = (scene.duration || 5) * 1000; // Convert to ms
        const wordDuration = sceneDuration / words.length;

        // Smaller chunks (2 words) for faster karaoke-style pacing like TikTok/Reels
        const chunkSize = 2;
        for (let i = 0; i < words.length; i += chunkSize) {
            const chunk = words.slice(i, Math.min(i + chunkSize, words.length)).join(' ');
            const chunkWordCount = Math.min(chunkSize, words.length - i);
            const chunkDuration = wordDuration * chunkWordCount;

            const startTime = formatSrtTime(currentTime);
            currentTime += chunkDuration;
            const endTime = formatSrtTime(currentTime);

            srtContent += `${subtitleIndex}\n${startTime} --> ${endTime}\n${chunk.toUpperCase()}\n\n`;
            subtitleIndex++;
        }
    }

    fs.writeFileSync(outputPath, srtContent);
    return outputPath;
};

/**
 * Format time for SRT (HH:MM:SS,mmm)
 */
const formatSrtTime = (ms) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
};

/**
 * Mix voiceover with background music using improved audio processing
 * Includes sidechain-like ducking effect and loudness normalization
 */
const mixAudioWithMusic = async (voicePath, musicPath, outputPath, musicVolume = 0.15) => {
    console.log("   🎵 Mixing audio with background music (enhanced)...");

    // SECURITY: Validate all paths
    const validatedVoicePath = validateFilePath(voicePath);
    const validatedMusicPath = validateFilePath(musicPath);
    const validatedOutputPath = validateFilePath(outputPath);

    // Get voice duration using execFile
    try {
        const duration = await execFilePromise('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            validatedVoicePath
        ]);
        const voiceDuration = parseFloat(duration.trim());

        // Enhanced mix with RADIO-STYLE voice processing
        const filterComplex = `[0:a]aformat=channel_layouts=stereo,` +
            `highpass=f=80,` +
            `acompressor=threshold=-18dB:ratio=6:attack=3:release=100:makeup=4,` +
            `equalizer=f=3000:t=h:w=2000:g=3,` +
            `equalizer=f=8000:t=h:w=3000:g=2[voice];` +
            `[1:a]volume=${musicVolume * 0.7},` +
            `lowpass=f=6000,` +
            `afade=t=in:st=0:d=0.5,` +
            `afade=t=out:st=${voiceDuration - 1.5}:d=1.5[music];` +
            `[voice][music]amix=inputs=2:duration=first:dropout_transition=2,` +
            `loudnorm=I=-14:TP=-1:LRA=7[out]`;

        await execFilePromise('ffmpeg', [
            '-y',
            '-i', validatedVoicePath,
            '-i', validatedMusicPath,
            '-filter_complex', filterComplex,
            '-map', '[out]',
            '-c:a', 'aac',
            '-b:a', '192k',
            validatedOutputPath
        ]);

        console.log("   ✅ Audio mixed with enhanced processing");
        return outputPath;
    } catch (error) {
        console.error("   ⚠️ Enhanced mixing failed, trying basic mix:", error.message);

        // Fallback to simpler mixing if enhanced fails
        try {
            // Need to get duration again for fallback
            const durationResult = await execFilePromise('ffprobe', [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                validatedVoicePath
            ]);
            const voiceDuration = parseFloat(durationResult.trim()) || 30;

            const basicFilter = `[0:a]aformat=channel_layouts=stereo[voice];` +
                `[1:a]volume=${musicVolume},afade=t=out:st=${voiceDuration - 2}:d=2[music];` +
                `[voice][music]amix=inputs=2:duration=first[out]`;

            await execFilePromise('ffmpeg', [
                '-y',
                '-i', validatedVoicePath,
                '-i', validatedMusicPath,
                '-filter_complex', basicFilter,
                '-map', '[out]',
                '-c:a', 'aac',
                '-b:a', '192k',
                validatedOutputPath
            ]);

            console.log("   ✅ Audio mixed (basic mode)");
            return outputPath;
        } catch {
            fs.copyFileSync(voicePath, outputPath);
            return outputPath;
        }
    }
};

/**
 * Add sound effects at key moments (transitions, reveals)
 */
const addSoundEffects = async (audioPath, storyboard, effectsDir, outputPath) => {
    console.log("   🔊 Adding sound effects...");

    // Calculate timing for sound effects
    const effects = [];
    let currentTime = 0;

    for (let i = 0; i < storyboard.length; i++) {
        const scene = storyboard[i];
        const sceneDuration = scene.duration || 5;

        // Add impact sound at hook (first scene)
        if (i === 0) {
            effects.push({
                type: 'impact',
                time: 0.1,
                volume: 0.3
            });
        }

        // Add whoosh at scene transitions (except last)
        if (i > 0 && i < storyboard.length - 1) {
            effects.push({
                type: 'whoosh',
                time: currentTime - 0.1,
                volume: 0.2
            });
        }

        // Add reveal sound at CTA (last scene)
        if (i === storyboard.length - 1) {
            effects.push({
                type: 'reveal',
                time: currentTime,
                volume: 0.25
            });
        }

        currentTime += sceneDuration;
    }

    // If no effects or effects directory doesn't exist, return original
    if (effects.length === 0 || !fs.existsSync(effectsDir)) {
        return audioPath;
    }

    // Build FFmpeg command to overlay effects
    // For now, just return the audio path - sound effect integration
    // would require downloading effect files first
    return audioPath;
};

/**
 * Main render function - assembles all components into final video
 */
export const renderVideo = async ({ audioBase64, subtitles, visuals, storyboard, musicPath = null, options = {} }) => {
    // INPUT VALIDATION
    if (!audioBase64 || typeof audioBase64 !== 'string') {
        throw new Error('renderVideo: audioBase64 must be a non-empty string');
    }

    if (!visuals || !Array.isArray(visuals) || visuals.length === 0) {
        throw new Error('renderVideo: visuals must be a non-empty array');
    }

    if (!storyboard || !Array.isArray(storyboard) || storyboard.length === 0) {
        throw new Error('renderVideo: storyboard must be a non-empty array');
    }

    // Validate array lengths match
    if (visuals.length !== storyboard.length) {
        console.warn(`⚠️ renderVideo: Visual/storyboard mismatch (${visuals.length} vs ${storyboard.length}). Using minimum.`);
    }

    // Validate all visual files exist
    const missingFiles = visuals.filter(v => !fs.existsSync(v));
    if (missingFiles.length > 0) {
        throw new Error(`renderVideo: Missing visual files: ${missingFiles.join(', ')}`);
    }

    // Validate storyboard scenes have required data
    for (let i = 0; i < storyboard.length; i++) {
        const scene = storyboard[i];
        if (!scene || typeof scene !== 'object') {
            throw new Error(`renderVideo: Invalid storyboard at index ${i}`);
        }
        if (!scene.text || typeof scene.text !== 'string') {
            console.warn(`⚠️ renderVideo: Scene ${i} missing text, using empty string`);
            storyboard[i].text = '';
        }
    }

    // Validate base64 audio format
    try {
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        if (audioBuffer.length === 0) {
            throw new Error('renderVideo: audioBase64 decodes to empty buffer');
        }
    } catch (e) {
        throw new Error(`renderVideo: Invalid base64 audio - ${e.message}`);
    }

    const {
        subtitleStyle = 'viral',
        useAnimatedSubtitles = true,
        addVignette = true,
        addColorGrade = true,
        addTransitions = true,
        musicVolume = 0.12,
        addGrain = true,
        grainAmount = 7,
        enableAnimatedSubtitles = true
    } = options;

    const tmpId = uuidv4();
    const tmpDir = `/tmp/${tmpId}`;
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    try {
        console.log("⚡ Rendering HIGH-ENGAGEMENT Video...");

        // A. Write Voice Audio
        const voicePath = `${tmpDir}/voice.mp3`;
        fs.writeFileSync(voicePath, Buffer.from(audioBase64, "base64"));
        console.log("   📢 Voice audio saved");

        // B. Mix with background music if provided
        let finalAudioPath = voicePath;
        if (musicPath && fs.existsSync(musicPath)) {
            finalAudioPath = `${tmpDir}/mixed_audio.m4a`;
            await mixAudioWithMusic(voicePath, musicPath, finalAudioPath, musicVolume);
        }

        // C. Animate each image based on scene type
        const videoClips = [];
        for (let i = 0; i < visuals.length; i++) {
            const imgPath = visuals[i];
            const scene = storyboard[i] || {};
            const sceneDuration = scene.duration || 5;
            const sceneType = scene.scene_type || 'body';
            const isFirst = i === 0;
            const isLast = i === visuals.length - 1;

            console.log(`   🎬 Scene ${i + 1}: ${sceneDuration}s [${sceneType}] -> ${path.basename(imgPath)}`);

            const clip = await animateImage(imgPath, sceneDuration, tmpDir, sceneType, isFirst, isLast);
            videoClips.push(clip);
        }

        // D. Create concat list - SECURITY: Escape single quotes in paths
        const listPath = `${tmpDir}/list.txt`;
        const fileContent = videoClips.map(p => {
            // Validate each clip path and escape single quotes for FFmpeg concat
            const validatedPath = validateFilePath(p);
            const escapedPath = validatedPath.replace(/'/g, "'\\''");
            return `file '${escapedPath}'`;
        }).join('\n');
        fs.writeFileSync(listPath, fileContent);
        console.log("   📋 Concat list created");

        // E. Generate subtitles
        const srtPath = `${tmpDir}/sub.srt`;
        const assPath = `${tmpDir}/sub.ass`;

        if (enableAnimatedSubtitles && storyboard) {
            createAnimatedSubtitles(storyboard, srtPath);
        } else if (subtitles) {
            fs.writeFileSync(srtPath, subtitles);
        }

        await generateStyledSubtitles(srtPath, assPath, subtitleStyle);
        console.log("   💬 Subtitles styled");

        // F. Concatenate video clips - SECURITY: Use execFile
        const concatPath = `${tmpDir}/concat.mp4`;
        await execFilePromise('ffmpeg', [
            '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', listPath,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '18',
            concatPath
        ]);
        console.log("   🔗 Clips concatenated");

        // G. Build final filter chain
        const finalFilters = [];

        // Subtitles - SECURITY: Escape the ASS path for FFmpeg filter syntax
        const escapedAssPath = escapeFFmpegFilterPath(assPath);
        finalFilters.push(`subtitles=${escapedAssPath}:fontsdir=/app/fonts`);

        // Vignette for cinematic look
        if (addVignette) {
            finalFilters.push(`vignette=PI/4`);
        }

        // Color grading - boost contrast and saturation for viral look
        if (addColorGrade) {
            finalFilters.push(`eq=contrast=1.15:brightness=0.03:saturation=1.25`);
        }
        if (addGrain) {
            finalFilters.push(`noise=alls=${grainAmount}:allf=t`);
        }

        // H. Final assembly with audio - SECURITY: Use execFile
        const finalPath = `${tmpDir}/final_output.mp4`;
        const filterString = finalFilters.join(',');

        const finalArgs = [
            '-y',
            '-i', concatPath,
            '-i', finalAudioPath
        ];

        if (filterString) {
            finalArgs.push('-vf', filterString);
        }

        finalArgs.push(
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '18',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-shortest',
            finalPath
        );

        await execFilePromise('ffmpeg', finalArgs);

        console.log("   ✅ Final video rendered!");

        const totalDuration = storyboard.reduce((sum, s) => sum + (s.duration || 5), 0);

        return {
            filePath: finalPath,
            duration: totalDuration,
            scenes: storyboard.length,
            cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true })
        };

    } catch (err) {
        console.error("❌ Render Error:", err.message);
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch { }
        throw err;
    }
};

/**
 * Quick preview render (lower quality, faster)
 */
export const renderPreview = async ({ audioBase64, subtitles, visuals, storyboard }) => {
    return renderVideo({
        audioBase64,
        subtitles,
        visuals,
        storyboard,
        options: {
            subtitleStyle: 'yellow_viral',
            enableAnimatedSubtitles: false,
            addVignette: false,
            addColorGrade: false,
            addTransitions: false,
            addGrain: false, // Turn off grain for previews to speed up
        }
    });
};

export { ANIMATION_PRESETS, SUBTITLE_STYLES, TRANSITIONS, THEME_TO_SUBTITLE, animateImage, generateStyledSubtitles, mixAudioWithMusic, addSoundEffects };
