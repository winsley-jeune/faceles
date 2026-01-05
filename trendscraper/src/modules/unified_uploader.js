/**
 * UNIFIED UPLOADER
 *
 * Single interface for uploading to all platforms.
 * Priority: Official APIs first, Puppeteer fallback if needed.
 *
 * This solves the dual-system problem where API uploaders and
 * Puppeteer uploaders existed in parallel without coordination.
 */

import youtubeAPI from './uploaders/youtube_api_uploader.js';
import facebookAPI from './uploaders/facebook_api_uploader.js';
import instagramAPI from './uploaders/instagram_api_uploader.js';
import tiktokAPI from './uploaders/tiktok_api_uploader.js';

// Puppeteer uploaders (fallback)
import { uploadToYouTube as puppeteerYouTube } from './uploaders/youtube_uploader.js';
import { uploadToTikTok as puppeteerTikTok } from './uploaders/tiktok_uploader.js';
import { uploadToInstagram as puppeteerInstagram } from './uploaders/instagram_uploader.js';
import { uploadToFacebook as puppeteerFacebook } from './uploaders/facebook_uploader.js';

/**
 * Check if a platform's API is connected and ready
 */
const checkAPIStatus = async (platform) => {
    try {
        switch (platform) {
            case 'youtube':
                return youtubeAPI.isConnected?.() || false;
            case 'facebook':
                return facebookAPI.isConnected?.() || false;
            case 'instagram':
                return instagramAPI.isConnected?.() || false;
            case 'tiktok':
                return tiktokAPI.isConnected?.() || false;
            default:
                return false;
        }
    } catch (err) {
        return false;
    }
};

/**
 * Upload to YouTube
 */
export const uploadToYouTube = async (videoPath, options = {}) => {
    const { title, description, tags = [], hashtags = [], usePuppeteer = false } = options;

    console.log(`📤 YouTube Upload: "${title?.substring(0, 40)}..."`);

    // Try API first
    if (!usePuppeteer) {
        try {
            const apiConnected = await checkAPIStatus('youtube');
            if (apiConnected) {
                console.log('   🔌 Using YouTube API...');
                const result = await youtubeAPI.uploadToYouTubeAPI(videoPath, {
                    title,
                    description,
                    tags: tags.length > 0 ? tags : hashtags
                });
                if (result?.success) {
                    return { ...result, method: 'api' };
                }
            }
        } catch (err) {
            console.log(`   ⚠️ YouTube API failed: ${err.message}`);
        }
    }

    // Fallback to Puppeteer
    console.log('   🤖 Falling back to Puppeteer...');
    try {
        const result = await puppeteerYouTube(videoPath, { title, description });
        return { success: true, ...result, method: 'puppeteer' };
    } catch (err) {
        console.error(`   ❌ YouTube Puppeteer failed: ${err.message}`);
        return { success: false, error: err.message, method: 'puppeteer' };
    }
};

/**
 * Upload to Facebook
 */
export const uploadToFacebook = async (videoPath, options = {}) => {
    const { description, caption, hashtags = [], usePuppeteer = false } = options;
    const finalCaption = caption || description || '';

    console.log(`📤 Facebook Upload: "${finalCaption.substring(0, 40)}..."`);

    // Try API first
    if (!usePuppeteer) {
        try {
            const apiConnected = await checkAPIStatus('facebook');
            if (apiConnected) {
                console.log('   🔌 Using Facebook API...');
                const result = await facebookAPI.uploadToFacebookAPI(videoPath, {
                    description: finalCaption
                });
                if (result?.success) {
                    return { ...result, method: 'api' };
                }
            }
        } catch (err) {
            console.log(`   ⚠️ Facebook API failed: ${err.message}`);
        }
    }

    // Fallback to Puppeteer
    console.log('   🤖 Falling back to Puppeteer...');
    try {
        const result = await puppeteerFacebook(videoPath, { caption: finalCaption });
        return { success: true, ...result, method: 'puppeteer' };
    } catch (err) {
        console.error(`   ❌ Facebook Puppeteer failed: ${err.message}`);
        return { success: false, error: err.message, method: 'puppeteer' };
    }
};

/**
 * Upload to Instagram
 */
export const uploadToInstagram = async (videoPath, options = {}) => {
    const { caption, description, hashtags = [], usePuppeteer = false } = options;
    const finalCaption = caption || description || '';

    console.log(`📤 Instagram Upload: "${finalCaption.substring(0, 40)}..."`);

    // Try API first
    if (!usePuppeteer) {
        try {
            const apiConnected = await checkAPIStatus('instagram');
            if (apiConnected) {
                console.log('   🔌 Using Instagram API...');
                const result = await instagramAPI.uploadToInstagramAPI(videoPath, {
                    caption: finalCaption,
                    hashtags
                });
                if (result?.success) {
                    return { ...result, method: 'api' };
                }
            }
        } catch (err) {
            console.log(`   ⚠️ Instagram API failed: ${err.message}`);
        }
    }

    // Fallback to Puppeteer
    console.log('   🤖 Falling back to Puppeteer...');
    try {
        const result = await puppeteerInstagram(videoPath, { caption: finalCaption });
        return { success: true, ...result, method: 'puppeteer' };
    } catch (err) {
        console.error(`   ❌ Instagram Puppeteer failed: ${err.message}`);
        return { success: false, error: err.message, method: 'puppeteer' };
    }
};

/**
 * Upload to TikTok
 */
export const uploadToTikTok = async (videoPath, options = {}) => {
    const { title, description, caption, hashtags = [], usePuppeteer = false } = options;
    const finalCaption = caption || description || title || '';

    console.log(`📤 TikTok Upload: "${finalCaption.substring(0, 40)}..."`);

    // Try API first
    if (!usePuppeteer) {
        try {
            const apiConnected = await checkAPIStatus('tiktok');
            if (apiConnected) {
                console.log('   🔌 Using TikTok API...');
                const result = await tiktokAPI.uploadToTikTokAPI(videoPath, {
                    title: finalCaption,
                    description: finalCaption,
                    hashtags
                });
                if (result?.success) {
                    return { ...result, method: 'api' };
                }
            }
        } catch (err) {
            console.log(`   ⚠️ TikTok API failed: ${err.message}`);
        }
    }

    // Fallback to Puppeteer
    console.log('   🤖 Falling back to Puppeteer...');
    try {
        const result = await puppeteerTikTok(videoPath, { caption: finalCaption });
        return { success: true, ...result, method: 'puppeteer' };
    } catch (err) {
        console.error(`   ❌ TikTok Puppeteer failed: ${err.message}`);
        return { success: false, error: err.message, method: 'puppeteer' };
    }
};

/**
 * MAIN: Upload to any platform
 */
export const upload = async (platform, videoPath, options = {}) => {
    const normalizedPlatform = platform.toLowerCase();

    switch (normalizedPlatform) {
        case 'youtube':
            return uploadToYouTube(videoPath, options);
        case 'facebook':
            return uploadToFacebook(videoPath, options);
        case 'instagram':
            return uploadToInstagram(videoPath, options);
        case 'tiktok':
            return uploadToTikTok(videoPath, options);
        default:
            return { success: false, error: `Unknown platform: ${platform}` };
    }
};

/**
 * Upload to multiple platforms
 */
export const uploadToAll = async (videoPath, options = {}) => {
    const { platforms = ['youtube', 'tiktok', 'instagram', 'facebook'], ...uploadOptions } = options;

    console.log(`📤 Multi-platform upload to: ${platforms.join(', ')}`);

    const results = {};
    for (const platform of platforms) {
        results[platform] = await upload(platform, videoPath, uploadOptions);
    }

    const successCount = Object.values(results).filter(r => r.success).length;
    console.log(`   ✅ Uploaded to ${successCount}/${platforms.length} platforms`);

    return {
        success: successCount > 0,
        totalPlatforms: platforms.length,
        successfulUploads: successCount,
        results
    };
};

/**
 * Get status of all platform connections
 */
export const getConnectionStatus = async () => {
    const platforms = ['youtube', 'facebook', 'instagram', 'tiktok'];
    const status = {};

    for (const platform of platforms) {
        status[platform] = {
            apiConnected: await checkAPIStatus(platform),
            puppeteerAvailable: true // Always available as fallback
        };
    }

    return status;
};

export default {
    upload,
    uploadToYouTube,
    uploadToFacebook,
    uploadToInstagram,
    uploadToTikTok,
    uploadToAll,
    getConnectionStatus
};
