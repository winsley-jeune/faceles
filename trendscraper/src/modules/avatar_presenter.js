/**
 * AI Avatar Presenter Module
 * Generates realistic AI presenter videos using MuseTalk lip-sync
 *
 * Uses Sieve API for MuseTalk integration (~$0.14/min of generated video)
 * Supports: Custom avatars, stock avatars, image-to-avatar conversion
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// Sieve API Configuration
const SIEVE_API_KEY = process.env.SIEVE_API_KEY;
const SIEVE_API_BASE = 'https://mango.sievedata.com/v2';

// Stock avatar presets (free to use)
const STOCK_AVATARS = {
    professional_male: {
        id: 'professional_male',
        name: 'Professional Male',
        description: 'Business professional male presenter',
        videoUrl: 'https://storage.googleapis.com/sieve-public-data/avatars/professional_male.mp4',
        thumbnail: '/avatars/professional_male_thumb.jpg',
        gender: 'male',
        style: 'corporate'
    },
    professional_female: {
        id: 'professional_female',
        name: 'Professional Female',
        description: 'Business professional female presenter',
        videoUrl: 'https://storage.googleapis.com/sieve-public-data/avatars/professional_female.mp4',
        thumbnail: '/avatars/professional_female_thumb.jpg',
        gender: 'female',
        style: 'corporate'
    },
    casual_male: {
        id: 'casual_male',
        name: 'Casual Male',
        description: 'Friendly casual male presenter',
        videoUrl: 'https://storage.googleapis.com/sieve-public-data/avatars/casual_male.mp4',
        thumbnail: '/avatars/casual_male_thumb.jpg',
        gender: 'male',
        style: 'casual'
    },
    casual_female: {
        id: 'casual_female',
        name: 'Casual Female',
        description: 'Friendly casual female presenter',
        videoUrl: 'https://storage.googleapis.com/sieve-public-data/avatars/casual_female.mp4',
        thumbnail: '/avatars/casual_female_thumb.jpg',
        gender: 'female',
        style: 'casual'
    },
    instructor_male: {
        id: 'instructor_male',
        name: 'Training Instructor (Male)',
        description: 'Authority figure for training videos',
        videoUrl: 'https://storage.googleapis.com/sieve-public-data/avatars/instructor_male.mp4',
        thumbnail: '/avatars/instructor_male_thumb.jpg',
        gender: 'male',
        style: 'training'
    },
    instructor_female: {
        id: 'instructor_female',
        name: 'Training Instructor (Female)',
        description: 'Authority figure for training videos',
        videoUrl: 'https://storage.googleapis.com/sieve-public-data/avatars/instructor_female.mp4',
        thumbnail: '/avatars/instructor_female_thumb.jpg',
        gender: 'female',
        style: 'training'
    }
};

// Avatar placement modes
const AVATAR_MODES = {
    FULL_SCREEN: 'full_screen',      // Avatar takes full video
    PICTURE_IN_PICTURE: 'pip',        // Small avatar in corner
    SIDE_BY_SIDE: 'side_by_side',     // Avatar on one side, content on other
    OVERLAY: 'overlay'                 // Avatar overlaid on content
};

/**
 * Check if Sieve API is configured
 */
export const isAvatarEnabled = () => {
    return !!SIEVE_API_KEY;
};

/**
 * Get available stock avatars
 */
export const getStockAvatars = () => {
    return Object.values(STOCK_AVATARS);
};

/**
 * Get avatar by ID
 */
export const getAvatarById = (avatarId) => {
    return STOCK_AVATARS[avatarId] || null;
};

/**
 * Call Sieve API
 */
const callSieveAPI = async (endpoint, method = 'GET', body = null) => {
    if (!SIEVE_API_KEY) {
        throw new Error('SIEVE_API_KEY is not configured. Get your API key at sievedata.com');
    }

    const options = {
        method,
        headers: {
            'X-API-Key': SIEVE_API_KEY,
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${SIEVE_API_BASE}${endpoint}`, options);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sieve API error (${response.status}): ${errorText}`);
    }

    return response.json();
};

/**
 * Upload file to Sieve
 */
const uploadToSieve = async (filePath) => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    // Get upload URL
    const uploadInfo = await callSieveAPI('/files/upload', 'POST', {
        name: fileName
    });

    // Upload file
    const uploadResponse = await fetch(uploadInfo.url, {
        method: 'PUT',
        body: fileBuffer,
        headers: {
            'Content-Type': 'application/octet-stream'
        }
    });

    if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to Sieve');
    }

    return uploadInfo.file_url;
};

/**
 * Run MuseTalk lip-sync job
 */
const runMuseTalkJob = async (videoUrl, audioUrl) => {
    console.log('   🎭 Starting MuseTalk lip-sync job...');

    // Push job to Sieve
    const job = await callSieveAPI('/push', 'POST', {
        function: 'sieve/musetalk',
        inputs: {
            source_video: { url: videoUrl },
            driving_audio: { url: audioUrl }
        }
    });

    console.log(`   📋 Job ID: ${job.id}`);

    // Poll for completion
    let status = 'queued';
    let result = null;
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max

    while (status !== 'finished' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        const jobStatus = await callSieveAPI(`/jobs/${job.id}`);
        status = jobStatus.status;

        if (status === 'finished') {
            result = jobStatus.outputs;
            console.log('   ✅ MuseTalk job completed!');
        } else if (status === 'failed') {
            throw new Error(`MuseTalk job failed: ${jobStatus.error || 'Unknown error'}`);
        } else {
            attempts++;
            if (attempts % 6 === 0) { // Log every 30 seconds
                console.log(`   ⏳ Processing... (${Math.round(attempts * 5 / 60)} min)`);
            }
        }
    }

    if (attempts >= maxAttempts) {
        throw new Error('MuseTalk job timed out');
    }

    return result;
};

/**
 * Run SieveSync (higher quality) lip-sync job
 */
const runSieveSyncJob = async (videoUrl, audioUrl, options = {}) => {
    console.log('   🎭 Starting SieveSync lip-sync job (high quality)...');

    const {
        enhanceFace = true,
        enhanceAudio = false
    } = options;

    // Push job to Sieve
    const job = await callSieveAPI('/push', 'POST', {
        function: 'sieve/lipsync',
        inputs: {
            source_video: { url: videoUrl },
            driving_audio: { url: audioUrl },
            enhance_face: enhanceFace,
            enhance_audio: enhanceAudio
        }
    });

    console.log(`   📋 Job ID: ${job.id}`);

    // Poll for completion
    let status = 'queued';
    let result = null;
    let attempts = 0;
    const maxAttempts = 180; // 15 minutes max for high quality

    while (status !== 'finished' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const jobStatus = await callSieveAPI(`/jobs/${job.id}`);
        status = jobStatus.status;

        if (status === 'finished') {
            result = jobStatus.outputs;
            console.log('   ✅ SieveSync job completed!');
        } else if (status === 'failed') {
            throw new Error(`SieveSync job failed: ${jobStatus.error || 'Unknown error'}`);
        } else {
            attempts++;
            if (attempts % 6 === 0) {
                console.log(`   ⏳ Processing... (${Math.round(attempts * 5 / 60)} min)`);
            }
        }
    }

    if (attempts >= maxAttempts) {
        throw new Error('SieveSync job timed out');
    }

    return result;
};

/**
 * Download result video from Sieve
 */
const downloadResult = async (resultUrl, outputPath) => {
    const response = await fetch(resultUrl);

    if (!response.ok) {
        throw new Error('Failed to download result video');
    }

    const buffer = await response.buffer();
    fs.writeFileSync(outputPath, buffer);

    return outputPath;
};

/**
 * Generate AI avatar presenter video
 *
 * @param {Object} options
 * @param {string} options.audioPath - Path to voiceover audio file
 * @param {string} options.avatarId - Stock avatar ID or 'custom'
 * @param {string} options.customAvatarPath - Path to custom avatar video/image
 * @param {string} options.outputDir - Output directory
 * @param {boolean} options.highQuality - Use SieveSync for higher quality (slower)
 */
export const generateAvatarVideo = async (options) => {
    const {
        audioPath,
        avatarId = 'professional_female',
        customAvatarPath = null,
        outputDir,
        highQuality = false
    } = options;

    if (!isAvatarEnabled()) {
        throw new Error('AI Avatar feature requires SIEVE_API_KEY. Get your key at sievedata.com');
    }

    console.log('🎭 Generating AI Avatar Presenter Video...');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get avatar source
    let avatarVideoUrl;
    if (customAvatarPath && fs.existsSync(customAvatarPath)) {
        console.log('   📤 Uploading custom avatar...');
        avatarVideoUrl = await uploadToSieve(customAvatarPath);
    } else {
        const avatar = getAvatarById(avatarId);
        if (!avatar) {
            throw new Error(`Unknown avatar ID: ${avatarId}`);
        }
        avatarVideoUrl = avatar.videoUrl;
        console.log(`   👤 Using stock avatar: ${avatar.name}`);
    }

    // Upload audio
    console.log('   📤 Uploading audio...');
    const audioUrl = await uploadToSieve(audioPath);

    // Run lip-sync
    let result;
    if (highQuality) {
        result = await runSieveSyncJob(avatarVideoUrl, audioUrl, {
            enhanceFace: true,
            enhanceAudio: false
        });
    } else {
        result = await runMuseTalkJob(avatarVideoUrl, audioUrl);
    }

    // Download result
    const outputPath = path.join(outputDir, `avatar_${Date.now()}.mp4`);
    console.log('   📥 Downloading result...');

    const resultUrl = result.output?.url || result.video?.url || result.url;
    if (!resultUrl) {
        throw new Error('No output URL in result');
    }

    await downloadResult(resultUrl, outputPath);

    console.log(`   ✅ Avatar video saved: ${outputPath}`);

    // Estimate cost (~$0.14/min)
    const audioDuration = await getAudioDuration(audioPath);
    const estimatedCost = (audioDuration / 60) * 0.14;
    console.log(`   💰 Estimated cost: $${estimatedCost.toFixed(2)}`);

    return {
        videoPath: outputPath,
        duration: audioDuration,
        cost: estimatedCost,
        avatarId: customAvatarPath ? 'custom' : avatarId
    };
};

/**
 * Get audio duration in seconds
 */
const getAudioDuration = async (audioPath) => {
    // Simple estimation based on file size for MP3
    // In production, use ffprobe for accurate duration
    try {
        const stats = fs.statSync(audioPath);
        // Rough estimate: 128kbps = 16KB/s
        return Math.round(stats.size / 16000);
    } catch {
        return 60; // Default to 1 minute
    }
};

/**
 * Generate image-to-avatar (static image to talking avatar)
 */
export const generateImageToAvatar = async (options) => {
    const {
        imagePath,
        audioPath,
        outputDir,
        highQuality = true
    } = options;

    if (!isAvatarEnabled()) {
        throw new Error('AI Avatar feature requires SIEVE_API_KEY');
    }

    console.log('🎭 Converting Image to Talking Avatar...');

    // Upload image
    console.log('   📤 Uploading image...');
    const imageUrl = await uploadToSieve(imagePath);

    // Upload audio
    console.log('   📤 Uploading audio...');
    const audioUrl = await uploadToSieve(audioPath);

    // For image-to-avatar, we use the lipsync function which handles both
    const job = await callSieveAPI('/push', 'POST', {
        function: 'sieve/lipsync',
        inputs: {
            source_image: { url: imageUrl },
            driving_audio: { url: audioUrl },
            enhance_face: highQuality
        }
    });

    console.log(`   📋 Job ID: ${job.id}`);

    // Poll for completion
    let status = 'queued';
    let result = null;
    let attempts = 0;

    while (status !== 'finished' && status !== 'failed' && attempts < 180) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const jobStatus = await callSieveAPI(`/jobs/${job.id}`);
        status = jobStatus.status;

        if (status === 'finished') {
            result = jobStatus.outputs;
        } else if (status === 'failed') {
            throw new Error(`Image-to-avatar failed: ${jobStatus.error}`);
        }
        attempts++;
    }

    // Download result
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `image_avatar_${Date.now()}.mp4`);
    const resultUrl = result.output?.url || result.video?.url || result.url;
    await downloadResult(resultUrl, outputPath);

    console.log(`   ✅ Image-to-Avatar video saved: ${outputPath}`);

    return {
        videoPath: outputPath
    };
};

/**
 * Check API status and credits
 */
export const checkAvatarAPIStatus = async () => {
    if (!SIEVE_API_KEY) {
        return {
            enabled: false,
            message: 'SIEVE_API_KEY not configured'
        };
    }

    try {
        const response = await callSieveAPI('/user');
        return {
            enabled: true,
            user: response.email,
            credits: response.credits,
            message: 'Sieve API connected'
        };
    } catch (error) {
        return {
            enabled: false,
            message: error.message
        };
    }
};

/**
 * Get avatar placement modes
 */
export const getAvatarModes = () => {
    return Object.entries(AVATAR_MODES).map(([key, value]) => ({
        id: value,
        name: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        description: getAvatarModeDescription(value)
    }));
};

const getAvatarModeDescription = (mode) => {
    const descriptions = {
        [AVATAR_MODES.FULL_SCREEN]: 'Avatar presenter takes the full video frame',
        [AVATAR_MODES.PICTURE_IN_PICTURE]: 'Small avatar in corner with content behind',
        [AVATAR_MODES.SIDE_BY_SIDE]: 'Avatar on one side, presentation content on the other',
        [AVATAR_MODES.OVERLAY]: 'Avatar semi-transparent overlaid on content'
    };
    return descriptions[mode] || '';
};

export {
    STOCK_AVATARS,
    AVATAR_MODES
};

export default {
    isAvatarEnabled,
    getStockAvatars,
    getAvatarById,
    generateAvatarVideo,
    generateImageToAvatar,
    checkAvatarAPIStatus,
    getAvatarModes,
    STOCK_AVATARS,
    AVATAR_MODES
};
