/**
 * UNIFIED UPLOADER (API-only, multi-tenant)
 *
 * Single interface for posting to all platforms via their OFFICIAL APIs.
 * Every call is scoped to a userId so the right tenant's OAuth tokens are used.
 *
 * Browser-automation (Playwright/Puppeteer) uploaders were removed: they used a
 * single shared cookie profile (cross-user posting risk), violated platform ToS,
 * and were unmaintainable. Posting is API-only.
 */

import youtubeAPI from './uploaders/youtube_api_uploader.js';
import facebookAPI from './uploaders/facebook_api_uploader.js';
import instagramAPI from './uploaders/instagram_api_uploader.js';
import tiktokAPI from './uploaders/tiktok_api_uploader.js';

function requireUserId(userId) {
    if (!userId) throw new Error('unified_uploader: userId is required');
}

/** Upload to YouTube (official API, scoped to userId). */
export const uploadToYouTube = async (userId, videoPath, options = {}) => {
    requireUserId(userId);
    const { title, description, tags = [], hashtags = [] } = options;
    console.log(`📤 [${userId}] YouTube API upload: "${(title || '').substring(0, 40)}"`);
    return youtubeAPI.uploadToYouTubeAPI(userId, videoPath, {
        title,
        description,
        tags: tags.length > 0 ? tags : hashtags
    });
};

/** Upload to Facebook (official API, scoped to userId). */
export const uploadToFacebook = async (userId, videoPath, options = {}) => {
    requireUserId(userId);
    const { description, caption } = options;
    const finalCaption = caption || description || '';
    console.log(`📤 [${userId}] Facebook API upload: "${finalCaption.substring(0, 40)}"`);
    return facebookAPI.uploadToFacebookAPI(userId, videoPath, { description: finalCaption });
};

/** Upload to Instagram (official API, scoped to userId). */
export const uploadToInstagram = async (userId, videoPath, options = {}) => {
    requireUserId(userId);
    const { caption, description, hashtags = [] } = options;
    const finalCaption = caption || description || '';
    console.log(`📤 [${userId}] Instagram API upload: "${finalCaption.substring(0, 40)}"`);
    return instagramAPI.uploadToInstagramAPI(userId, videoPath, { caption: finalCaption, hashtags });
};

/** Upload to TikTok (official API, scoped to userId). */
export const uploadToTikTok = async (userId, videoPath, options = {}) => {
    requireUserId(userId);
    const { title, description, caption, hashtags = [] } = options;
    const finalCaption = caption || description || title || '';
    console.log(`📤 [${userId}] TikTok API upload: "${finalCaption.substring(0, 40)}"`);
    return tiktokAPI.uploadToTikTokAPI(userId, videoPath, {
        title: finalCaption,
        description: finalCaption,
        hashtags
    });
};

/** MAIN: upload to any single platform for a user. */
export const upload = async (userId, platform, videoPath, options = {}) => {
    requireUserId(userId);
    switch (String(platform).toLowerCase()) {
        case 'youtube': return uploadToYouTube(userId, videoPath, options);
        case 'facebook': return uploadToFacebook(userId, videoPath, options);
        case 'instagram': return uploadToInstagram(userId, videoPath, options);
        case 'tiktok': return uploadToTikTok(userId, videoPath, options);
        default: return { success: false, error: `Unknown platform: ${platform}` };
    }
};

/** Upload to multiple platforms for a user. */
export const uploadToAll = async (userId, videoPath, options = {}) => {
    requireUserId(userId);
    const { platforms = ['youtube', 'tiktok', 'instagram', 'facebook'], ...uploadOptions } = options;
    console.log(`📤 [${userId}] Multi-platform upload to: ${platforms.join(', ')}`);

    const results = {};
    for (const platform of platforms) {
        try {
            results[platform] = await upload(userId, platform, videoPath, uploadOptions);
        } catch (err) {
            results[platform] = { success: false, error: err.message };
        }
    }

    const successCount = Object.values(results).filter((r) => r?.success).length;
    console.log(`   ✅ Uploaded to ${successCount}/${platforms.length} platforms`);
    return {
        success: successCount > 0,
        totalPlatforms: platforms.length,
        successfulUploads: successCount,
        results
    };
};

export default {
    upload,
    uploadToYouTube,
    uploadToFacebook,
    uploadToInstagram,
    uploadToTikTok,
    uploadToAll
};
