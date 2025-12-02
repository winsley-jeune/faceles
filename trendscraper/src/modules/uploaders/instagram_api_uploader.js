import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const TOKENS_PATH = '/app/data/instagram_tokens.json';
const FB_TOKENS_PATH = '/app/data/facebook_tokens.json';

/**
 * Instagram Graph API Uploader for Reels
 * Uses Facebook Graph API to post to Instagram Business/Creator accounts
 *
 * Requirements:
 * 1. Instagram Business or Creator Account
 * 2. Instagram account linked to a Facebook Page
 * 3. Facebook App with instagram_basic, instagram_content_publish permissions
 *
 * Flow:
 * 1. Use Facebook Page token to get Instagram Business Account ID
 * 2. Upload video to Instagram via container-based upload
 * 3. Publish the container as a Reel
 */

/**
 * Load saved tokens (Instagram or fallback to Facebook)
 */
const loadTokens = () => {
    // First try Instagram-specific tokens
    if (fs.existsSync(TOKENS_PATH)) {
        return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    }
    // Fallback to Facebook tokens (they work for Instagram too)
    if (fs.existsSync(FB_TOKENS_PATH)) {
        return JSON.parse(fs.readFileSync(FB_TOKENS_PATH, 'utf8'));
    }
    return null;
};

/**
 * Save tokens to file
 */
const saveTokens = (tokens) => {
    const dir = path.dirname(TOKENS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
    console.log('   💾 Instagram tokens saved');
};

/**
 * Get Instagram Business Account ID linked to the Facebook Page
 */
export const getInstagramAccountId = async () => {
    const tokens = loadTokens();

    if (!tokens || !tokens.pageAccessToken) {
        throw new Error('Facebook not authorized. Authorize Facebook first via /facebook-api/auth');
    }

    try {
        // Get Instagram Business Account connected to the Facebook Page
        const res = await fetch(
            `https://graph.facebook.com/v19.0/${tokens.pageId}?` +
            `fields=instagram_business_account` +
            `&access_token=${tokens.pageAccessToken}`
        );
        const data = await res.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        if (!data.instagram_business_account) {
            throw new Error(
                'No Instagram Business Account linked to this Facebook Page. ' +
                'Go to your Facebook Page Settings → Linked Accounts → Instagram to connect.'
            );
        }

        const igAccountId = data.instagram_business_account.id;

        // Get Instagram account details
        const igRes = await fetch(
            `https://graph.facebook.com/v19.0/${igAccountId}?` +
            `fields=id,username,name,profile_picture_url,followers_count,media_count` +
            `&access_token=${tokens.pageAccessToken}`
        );
        const igData = await igRes.json();

        if (igData.error) {
            throw new Error(igData.error.message);
        }

        // Save Instagram account info
        const igTokens = {
            ...tokens,
            instagramAccountId: igAccountId,
            instagramUsername: igData.username,
            instagramName: igData.name,
            followers: igData.followers_count,
            mediaCount: igData.media_count
        };
        saveTokens(igTokens);

        return igData;

    } catch (error) {
        console.error('   ❌ Failed to get Instagram account:', error.message);
        throw error;
    }
};

/**
 * Upload a Reel to Instagram
 * Instagram Reels API: Container-based upload (2-step process)
 *
 * Step 1: Create media container with video URL
 * Step 2: Publish the container
 */
export const uploadToInstagramAPI = async (videoPath, { caption, hashtags = [], coverUrl = null }) => {
    console.log('📤 Uploading to Instagram Reels via API...');

    if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
    }

    const tokens = loadTokens();
    if (!tokens || !tokens.pageAccessToken) {
        throw new Error('Not authorized. Run Facebook authorization first via /facebook-api/auth');
    }

    // Get Instagram account ID if not cached
    let igAccountId = tokens.instagramAccountId;
    if (!igAccountId) {
        const igAccount = await getInstagramAccountId();
        igAccountId = igAccount.id;
    }

    const accessToken = tokens.pageAccessToken;

    try {
        const fileSize = fs.statSync(videoPath).size;
        const fullCaption = `${caption}\n\n${hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`.slice(0, 2200);

        console.log(`   📋 Caption: ${fullCaption.substring(0, 50)}...`);
        console.log(`   📁 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   📸 Instagram Account: ${tokens.instagramUsername || igAccountId}`);

        // Instagram requires a publicly accessible URL for the video
        // For local files, we need to either:
        // 1. Host the video temporarily (e.g., on a server)
        // 2. Use a video hosting service
        // For now, we'll check if videoPath is a URL or local file

        let videoUrl = videoPath;

        // If it's a local file, we need to handle it differently
        if (!videoPath.startsWith('http')) {
            // Option: Upload to a temporary hosting service or use Facebook's resumable upload
            // For MVP, we'll use Facebook's video upload endpoint first, then reference it
            console.log('   ⚠️ Local file detected. Using resumable upload...');
            videoUrl = await uploadVideoToFacebookCDN(videoPath, accessToken);
        }

        // Step 1: Create media container
        console.log('   🔄 Creating media container...');
        const containerRes = await fetch(
            `https://graph.facebook.com/v19.0/${igAccountId}/media`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    media_type: 'REELS',
                    video_url: videoUrl,
                    caption: fullCaption,
                    share_to_feed: true,  // Also share to feed
                    access_token: accessToken
                })
            }
        );
        const containerData = await containerRes.json();

        if (containerData.error) {
            throw new Error(containerData.error.message);
        }

        const containerId = containerData.id;
        console.log(`   📝 Container ID: ${containerId}`);

        // Step 2: Wait for video processing (Instagram processes the video)
        console.log('   ⏳ Waiting for video processing...');
        let status = 'IN_PROGRESS';
        let attempts = 0;
        const maxAttempts = 30; // 5 minutes max wait

        while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 10000)); // Wait 10 seconds

            const statusRes = await fetch(
                `https://graph.facebook.com/v19.0/${containerId}?` +
                `fields=status_code,status` +
                `&access_token=${accessToken}`
            );
            const statusData = await statusRes.json();

            if (statusData.error) {
                throw new Error(statusData.error.message);
            }

            status = statusData.status_code;
            console.log(`      Processing status: ${status} (attempt ${attempts + 1}/${maxAttempts})`);
            attempts++;
        }

        if (status !== 'FINISHED') {
            throw new Error(`Video processing failed or timed out. Status: ${status}`);
        }

        // Step 3: Publish the container
        console.log('   🚀 Publishing Reel...');
        const publishRes = await fetch(
            `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creation_id: containerId,
                    access_token: accessToken
                })
            }
        );
        const publishData = await publishRes.json();

        if (publishData.error) {
            throw new Error(publishData.error.message);
        }

        const mediaId = publishData.id;

        // Get the permalink
        const mediaRes = await fetch(
            `https://graph.facebook.com/v19.0/${mediaId}?` +
            `fields=permalink,shortcode` +
            `&access_token=${accessToken}`
        );
        const mediaData = await mediaRes.json();

        const reelUrl = mediaData.permalink || `https://www.instagram.com/reel/${mediaData.shortcode}/`;

        console.log(`   ✅ Reel published successfully!`);
        console.log(`   🔗 URL: ${reelUrl}`);

        return {
            success: true,
            platform: 'instagram',
            mediaId: mediaId,
            reelUrl: reelUrl,
            message: 'Reel uploaded to Instagram via API'
        };

    } catch (error) {
        console.error('   ❌ Instagram API upload failed:', error.message);

        // Handle specific errors
        if (error.message.includes('OAuthException') || error.message.includes('Invalid OAuth')) {
            return {
                success: false,
                platform: 'instagram',
                error: 'Token expired. Re-authorize via /facebook-api/auth',
                tokenExpired: true
            };
        }

        if (error.message.includes('instagram_business_account')) {
            return {
                success: false,
                platform: 'instagram',
                error: 'Instagram Business Account not linked. Connect Instagram to your Facebook Page first.',
                setupRequired: true
            };
        }

        return {
            success: false,
            platform: 'instagram',
            error: error.message
        };
    }
};

/**
 * Upload video to Facebook CDN (to get a public URL for Instagram)
 * This is a workaround for local files
 */
const uploadVideoToFacebookCDN = async (videoPath, accessToken) => {
    const tokens = loadTokens();
    const pageId = tokens.pageId;

    // Use Facebook's resumable upload to get a hosted URL
    const fileSize = fs.statSync(videoPath).size;

    // Step 1: Start upload session
    const startRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/videos?` +
        `upload_phase=start` +
        `&file_size=${fileSize}` +
        `&access_token=${accessToken}`,
        { method: 'POST' }
    );
    const startData = await startRes.json();

    if (startData.error) {
        throw new Error(`CDN upload start failed: ${startData.error.message}`);
    }

    const uploadSessionId = startData.upload_session_id;
    const uploadUrl = startData.video_file_chunk_url ||
        `https://graph.facebook.com/v19.0/${pageId}/videos`;

    // Step 2: Upload video chunks
    const videoBuffer = fs.readFileSync(videoPath);

    const transferRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/videos`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
            },
            body: JSON.stringify({
                upload_phase: 'transfer',
                upload_session_id: uploadSessionId,
                start_offset: 0,
                video_file_chunk: videoBuffer.toString('base64'),
                access_token: accessToken
            })
        }
    );

    // Step 3: Finish and get video URL
    const finishRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/videos?` +
        `upload_phase=finish` +
        `&upload_session_id=${uploadSessionId}` +
        `&access_token=${accessToken}`,
        { method: 'POST' }
    );
    const finishData = await finishRes.json();

    if (finishData.error) {
        throw new Error(`CDN upload finish failed: ${finishData.error.message}`);
    }

    // The video is now on Facebook's CDN
    // We need to get its source URL
    const videoId = finishData.video_id || finishData.id;

    const sourceRes = await fetch(
        `https://graph.facebook.com/v19.0/${videoId}?` +
        `fields=source` +
        `&access_token=${accessToken}`
    );
    const sourceData = await sourceRes.json();

    return sourceData.source;
};

/**
 * Check Instagram API authorization status
 */
export const checkInstagramAPIStatus = async () => {
    try {
        const tokens = loadTokens();

        if (!tokens || !tokens.pageAccessToken) {
            return {
                authorized: false,
                message: 'Facebook not authorized. Visit /facebook-api/auth first.',
                facebookRequired: true
            };
        }

        // Try to get Instagram account
        try {
            const igAccount = await getInstagramAccountId();

            return {
                authorized: true,
                instagram: {
                    id: igAccount.id,
                    username: igAccount.username,
                    name: igAccount.name,
                    followers: igAccount.followers_count,
                    posts: igAccount.media_count
                },
                facebookPage: {
                    id: tokens.pageId,
                    name: tokens.pageName
                },
                message: `Connected to Instagram: @${igAccount.username}`
            };
        } catch (error) {
            return {
                authorized: false,
                facebookConnected: true,
                instagramLinked: false,
                message: error.message,
                instructions: [
                    '1. Go to your Facebook Page',
                    '2. Settings → Linked Accounts → Instagram',
                    '3. Connect your Instagram Business/Creator account',
                    '4. Return here and try again'
                ]
            };
        }

    } catch (error) {
        return {
            authorized: false,
            message: error.message
        };
    }
};

/**
 * Get recent Instagram media/insights
 */
export const getInstagramMedia = async (limit = 10) => {
    const tokens = loadTokens();

    if (!tokens || !tokens.instagramAccountId) {
        throw new Error('Instagram not connected');
    }

    const res = await fetch(
        `https://graph.facebook.com/v19.0/${tokens.instagramAccountId}/media?` +
        `fields=id,caption,media_type,permalink,thumbnail_url,timestamp,like_count,comments_count,plays` +
        `&limit=${limit}` +
        `&access_token=${tokens.pageAccessToken}`
    );
    const data = await res.json();

    if (data.error) {
        throw new Error(data.error.message);
    }

    return data.data;
};

export default {
    getInstagramAccountId,
    uploadToInstagramAPI,
    checkInstagramAPIStatus,
    getInstagramMedia
};
