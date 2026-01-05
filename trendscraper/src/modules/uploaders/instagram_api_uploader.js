import fs from 'fs';
import fetch from 'node-fetch';
import dataService from '../../services/dataService.js';

// Token refresh threshold (refresh if less than 7 days remaining)
const TOKEN_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Instagram Graph API Uploader for Reels - Database Edition
 * Uses Facebook Graph API to post to Instagram Business/Creator accounts
 *
 * NOW WITH MULTI-TENANT USER ISOLATION:
 * - Tokens stored per user in PostgreSQL
 * - Each user has their own Instagram connection via Facebook
 * - No cross-user token sharing
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
 * Load saved tokens (Instagram-specific or fallback to Facebook)
 * @param {string} userId - User ID (required)
 */
const loadTokens = async (userId) => {
    try {
        // Try Instagram-specific tokens first
        const igTokenData = await dataService.tokens.getToken(userId, 'instagram');
        if (igTokenData) {
            return {
                userAccessToken: igTokenData.accessToken,
                pageAccessToken: igTokenData.metadata?.pageAccessToken,
                pageId: igTokenData.metadata?.pageId,
                pageName: igTokenData.metadata?.pageName,
                instagramAccountId: igTokenData.metadata?.instagramAccountId,
                instagramUsername: igTokenData.metadata?.instagramUsername,
                instagramName: igTokenData.metadata?.instagramName,
                followers: igTokenData.metadata?.followers,
                mediaCount: igTokenData.metadata?.mediaCount,
                expiresAt: igTokenData.expiresAt,
                scope: igTokenData.scope
            };
        }

        // Fallback to Facebook tokens (Instagram uses Facebook auth)
        const fbTokenData = await dataService.tokens.getToken(userId, 'facebook');
        if (fbTokenData) {
            return {
                userAccessToken: fbTokenData.accessToken,
                pageAccessToken: fbTokenData.metadata?.pageAccessToken,
                pageId: fbTokenData.metadata?.pageId,
                pageName: fbTokenData.metadata?.pageName,
                expiresAt: fbTokenData.expiresAt,
                scope: fbTokenData.scope
            };
        }

        return null;
    } catch (err) {
        console.error('Failed to load Instagram tokens:', err.message);
        return null;
    }
};

/**
 * Save tokens to database for user
 * @param {string} userId - User ID (required)
 * @param {object} tokens - Instagram/Facebook tokens
 */
const saveTokens = async (userId, tokens) => {
    try {
        await dataService.tokens.saveToken(userId, 'instagram', {
            accessToken: tokens.userAccessToken,
            refreshToken: null, // Facebook/Instagram don't use refresh tokens
            expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
            scope: tokens.scope,
            tokenType: 'Bearer',
            metadata: {
                pageAccessToken: tokens.pageAccessToken,
                pageId: tokens.pageId,
                pageName: tokens.pageName,
                instagramAccountId: tokens.instagramAccountId,
                instagramUsername: tokens.instagramUsername,
                instagramName: tokens.instagramName,
                followers: tokens.followers,
                mediaCount: tokens.mediaCount
            }
        });
        console.log(`   💾 [User: ${userId}] Instagram tokens saved (@${tokens.instagramUsername || 'pending'})`);
    } catch (err) {
        console.error('Failed to save Instagram tokens:', err.message);
        throw err;
    }
};

/**
 * Check if token is expired or about to expire
 */
const isTokenExpiring = (tokens) => {
    if (!tokens || !tokens.expiresAt) return true;
    const expiresAt = new Date(tokens.expiresAt).getTime();
    const now = Date.now();
    return (expiresAt - now) < TOKEN_REFRESH_THRESHOLD_MS;
};

/**
 * Refresh long-lived token (extends another 60 days)
 * @param {string} userId - User ID (required)
 */
export const refreshToken = async (userId) => {
    if (!userId) {
        throw new Error('userId is required to refresh token');
    }

    const tokens = await loadTokens(userId);

    if (!tokens || !tokens.userAccessToken) {
        throw new Error('No tokens found to refresh');
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
        console.log(`   ⚠️ [User: ${userId}] Cannot refresh token: FACEBOOK_APP_ID or FACEBOOK_APP_SECRET not set`);
        return tokens;
    }

    try {
        console.log(`   🔄 [User: ${userId}] Refreshing Instagram/Facebook token...`);

        // Exchange current long-lived token for a new one
        const refreshUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` +
            `grant_type=fb_exchange_token` +
            `&client_id=${appId}` +
            `&client_secret=${appSecret}` +
            `&fb_exchange_token=${tokens.userAccessToken}`;

        const res = await fetch(refreshUrl);
        const data = await res.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        // Update tokens
        const updatedTokens = {
            ...tokens,
            userAccessToken: data.access_token,
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // ~60 days
            lastRefreshed: new Date().toISOString()
        };

        // Also refresh page access token if we have page info
        if (tokens.pageId) {
            const pagesRes = await fetch(
                `https://graph.facebook.com/v19.0/me/accounts?access_token=${data.access_token}`
            );
            const pagesData = await pagesRes.json();

            if (pagesData.data) {
                const page = pagesData.data.find(p => p.id === tokens.pageId) || pagesData.data[0];
                if (page) {
                    updatedTokens.pageAccessToken = page.access_token;
                }
            }
        }

        await saveTokens(userId, updatedTokens);
        console.log(`   ✅ [User: ${userId}] Token refreshed successfully`);

        return updatedTokens;

    } catch (error) {
        console.error(`   ❌ [User: ${userId}] Token refresh failed:`, error.message);
        throw error;
    }
};

/**
 * Get valid tokens (refresh if needed)
 * @param {string} userId - User ID (required)
 */
const getValidTokens = async (userId) => {
    let tokens = await loadTokens(userId);

    if (!tokens) {
        throw new Error('Not authorized. Run Facebook authorization first via /facebook-api/auth');
    }

    // Check if token needs refresh
    if (isTokenExpiring(tokens)) {
        console.log(`   ⚠️ [User: ${userId}] Token expiring soon, attempting refresh...`);
        try {
            tokens = await refreshToken(userId);
        } catch (err) {
            console.log(`   ⚠️ [User: ${userId}] Token refresh failed, using existing token:`, err.message);
        }
    }

    return tokens;
};

/**
 * Get Instagram Business Account ID linked to the Facebook Page
 * @param {string} userId - User ID (required)
 */
export const getInstagramAccountId = async (userId) => {
    if (!userId) {
        throw new Error('userId is required to get Instagram account');
    }

    const tokens = await loadTokens(userId);

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
        await saveTokens(userId, igTokens);

        return igData;

    } catch (error) {
        console.error(`   ❌ [User: ${userId}] Failed to get Instagram account:`, error.message);
        throw error;
    }
};

/**
 * Upload a Reel to Instagram
 * @param {string} userId - User ID (required)
 * @param {string} videoPath - Path to video file
 * @param {object} metadata - Video metadata
 */
export const uploadToInstagramAPI = async (userId, videoPath, metadata = {}) => {
    if (!userId) {
        throw new Error('userId is required for Instagram upload');
    }

    console.log(`📤 [User: ${userId}] Uploading to Instagram Reels via API...`);

    if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
    }

    const tokens = await getValidTokens(userId);
    if (!tokens.pageAccessToken) {
        throw new Error('Not authorized. Run Facebook authorization first via /facebook-api/auth');
    }

    // Get Instagram account ID if not cached
    let igAccountId = tokens.instagramAccountId;
    if (!igAccountId) {
        const igAccount = await getInstagramAccountId(userId);
        igAccountId = igAccount.id;
    }

    const accessToken = tokens.pageAccessToken;
    const { caption = '', hashtags = [], coverUrl = null } = metadata;

    try {
        const fileSize = fs.statSync(videoPath).size;
        const fullCaption = `${caption}\n\n${hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`.slice(0, 2200);

        console.log(`   📋 [User: ${userId}] Caption: ${fullCaption.substring(0, 50)}...`);
        console.log(`   📁 [User: ${userId}] File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   📸 [User: ${userId}] Instagram Account: ${tokens.instagramUsername || igAccountId}`);

        let videoUrl = videoPath;

        // If it's a local file, upload to Facebook CDN first
        if (!videoPath.startsWith('http')) {
            console.log(`   ⚠️ [User: ${userId}] Local file detected. Using resumable upload...`);
            videoUrl = await uploadVideoToFacebookCDN(userId, videoPath, accessToken);
        }

        // Step 1: Create media container
        console.log(`   🔄 [User: ${userId}] Creating media container...`);
        const containerRes = await fetch(
            `https://graph.facebook.com/v19.0/${igAccountId}/media`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    media_type: 'REELS',
                    video_url: videoUrl,
                    caption: fullCaption,
                    share_to_feed: true,
                    access_token: accessToken
                })
            }
        );
        const containerData = await containerRes.json();

        if (containerData.error) {
            throw new Error(containerData.error.message);
        }

        const containerId = containerData.id;
        console.log(`   📝 [User: ${userId}] Container ID: ${containerId}`);

        // Step 2: Wait for video processing
        console.log(`   ⏳ [User: ${userId}] Waiting for video processing...`);
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
            console.log(`      [User: ${userId}] Processing status: ${status} (attempt ${attempts + 1}/${maxAttempts})`);
            attempts++;
        }

        if (status !== 'FINISHED') {
            throw new Error(`Video processing failed or timed out. Status: ${status}`);
        }

        // Step 3: Publish the container
        console.log(`   🚀 [User: ${userId}] Publishing Reel...`);
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

        console.log(`   ✅ [User: ${userId}] Reel published successfully!`);
        console.log(`   🔗 URL: ${reelUrl}`);

        return {
            success: true,
            platform: 'instagram',
            mediaId: mediaId,
            videoUrl: reelUrl,
            message: 'Reel uploaded to Instagram via API'
        };

    } catch (error) {
        console.error(`   ❌ [User: ${userId}] Instagram API upload failed:`, error.message);

        if (error.message.includes('OAuthException') || error.message.includes('Invalid OAuth') || error.message.includes('expired')) {
            return {
                success: false,
                platform: 'instagram',
                error: 'Instagram authorization expired. Please reconnect your Facebook account.',
                needsReauth: true
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
 * @param {string} userId - User ID (required)
 * @param {string} videoPath - Path to video file
 * @param {string} accessToken - Facebook access token
 */
const uploadVideoToFacebookCDN = async (userId, videoPath, accessToken) => {
    const tokens = await loadTokens(userId);
    const pageId = tokens.pageId;

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

    // Step 2: Upload video chunks
    const videoBuffer = fs.readFileSync(videoPath);

    const transferRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/videos?` +
        `upload_phase=transfer` +
        `&upload_session_id=${uploadSessionId}` +
        `&start_offset=0` +
        `&access_token=${accessToken}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
            },
            body: videoBuffer
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
 * @param {string} userId - User ID (required)
 */
export const checkInstagramAPIStatus = async (userId) => {
    if (!userId) {
        return {
            authorized: false,
            error: 'userId is required'
        };
    }

    try {
        let tokens = await loadTokens(userId);

        if (!tokens || !tokens.pageAccessToken) {
            return {
                authorized: false,
                message: 'Facebook not authorized. Visit /facebook-api/auth first.',
                facebookRequired: true
            };
        }

        // Check token expiration status
        const tokenExpiring = isTokenExpiring(tokens);
        let tokenStatus = 'valid';

        if (tokenExpiring) {
            tokenStatus = 'expiring_soon';
            // Try to refresh
            try {
                tokens = await refreshToken(userId);
                tokenStatus = 'refreshed';
            } catch (err) {
                tokenStatus = 'refresh_failed';
            }
        }

        // Try to get Instagram account
        try {
            const igAccount = await getInstagramAccountId(userId);

            return {
                authorized: true,
                connected: true,
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
                tokenStatus,
                expiresAt: tokens.expiresAt,
                message: `Connected to Instagram: @${igAccount.username}`
            };
        } catch (error) {
            return {
                authorized: false,
                connected: false,
                facebookConnected: true,
                instagramLinked: false,
                message: error.message,
                tokenStatus,
                instructions: [
                    '1. Go to your Facebook Page',
                    '2. Settings → Linked Accounts → Instagram',
                    '3. Connect your Instagram Business/Creator account',
                    '4. Return here and try again'
                ]
            };
        }

    } catch (error) {
        console.error(`   [User: ${userId}] Instagram status check failed:`, error.message);
        return {
            authorized: false,
            connected: false,
            message: error.message
        };
    }
};

/**
 * Get recent Instagram media/insights
 * @param {string} userId - User ID (required)
 * @param {number} limit - Number of media items to fetch
 */
export const getInstagramMedia = async (userId, limit = 10) => {
    if (!userId) {
        throw new Error('userId is required to get Instagram media');
    }

    const tokens = await loadTokens(userId);

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
    getInstagramMedia,
    refreshToken
};
