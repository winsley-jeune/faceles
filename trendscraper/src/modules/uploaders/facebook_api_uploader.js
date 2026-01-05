import fs from 'fs';
import http from 'http';
import { URL } from 'url';
import crypto from 'crypto';
import fetch from 'node-fetch';
import dataService from '../../services/dataService.js';

// SECURITY: State store for CSRF protection in OAuth flow
// Now includes userId to track which user is authorizing
const stateStore = new Map();
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Cleanup expired states every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [state, data] of stateStore.entries()) {
        if (data.expiresAt < now) {
            stateStore.delete(state);
        }
    }
}, 5 * 60 * 1000);

/**
 * Facebook Graph API Uploader for Reels - Database Edition
 * Uses official Facebook/Instagram Graph API for reliable uploads
 *
 * NOW WITH MULTI-TENANT USER ISOLATION:
 * - Tokens stored per user in PostgreSQL
 * - Each user has their own Facebook connection
 * - No cross-user token sharing
 *
 * Requirements:
 * 1. Facebook App (developers.facebook.com)
 * 2. App permissions: pages_manage_posts, pages_read_engagement, publish_video
 * 3. Page Access Token (for posting to Facebook Page)
 *
 * Environment Variables:
 * - FACEBOOK_APP_ID: Your Facebook App ID
 * - FACEBOOK_APP_SECRET: Your Facebook App Secret
 */

/**
 * Load saved tokens for user from database
 * @param {string} userId - User ID (required)
 */
const loadTokens = async (userId) => {
    try {
        const tokenData = await dataService.tokens.getToken(userId, 'facebook');
        if (!tokenData) return null;

        return {
            userAccessToken: tokenData.accessToken,
            pageAccessToken: tokenData.metadata?.pageAccessToken,
            pageId: tokenData.metadata?.pageId,
            pageName: tokenData.metadata?.pageName,
            expiresAt: tokenData.expiresAt,
            scope: tokenData.scope
        };
    } catch (err) {
        console.error('Failed to load Facebook tokens:', err.message);
        return null;
    }
};

/**
 * Save tokens to database for user
 * @param {string} userId - User ID (required)
 * @param {object} tokens - Facebook tokens
 */
const saveTokens = async (userId, tokens) => {
    try {
        await dataService.tokens.saveToken(userId, 'facebook', {
            accessToken: tokens.userAccessToken,
            refreshToken: null, // Facebook doesn't use refresh tokens
            expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
            scope: tokens.scope,
            tokenType: 'Bearer',
            metadata: {
                pageAccessToken: tokens.pageAccessToken,
                pageId: tokens.pageId,
                pageName: tokens.pageName
            }
        });
        console.log(`   💾 [User: ${userId}] Facebook tokens saved (Page: ${tokens.pageName})`);
    } catch (err) {
        console.error('Failed to save Facebook tokens:', err.message);
        throw err;
    }
};

/**
 * Get OAuth redirect URI based on environment
 */
const getRedirectUri = () => {
    if (process.env.FACEBOOK_REDIRECT_URI) {
        return process.env.FACEBOOK_REDIRECT_URI;
    }
    if (process.env.NODE_ENV === 'production') {
        const baseUrl = process.env.BASE_URL || 'https://localhost:8086';
        return `${baseUrl}/oauth2callback`;
    }
    return 'http://localhost:8086/oauth2callback';
};

/**
 * Generate OAuth authorization URL
 * @param {string} userId - User ID (required for multi-tenant isolation)
 */
export const getAuthUrl = (userId) => {
    if (!userId) {
        throw new Error('userId is required for Facebook OAuth');
    }

    const appId = process.env.FACEBOOK_APP_ID;

    if (!appId) {
        throw new Error('FACEBOOK_APP_ID not set in environment variables');
    }

    // SECURITY: Generate cryptographic state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    stateStore.set(state, {
        userId,  // Store userId to retrieve in callback
        createdAt: Date.now(),
        expiresAt: Date.now() + STATE_EXPIRY_MS
    });

    const redirectUri = getRedirectUri();
    const scope = [
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',
        'publish_video',
        'pages_read_user_content',
        'business_management'
    ].join(',');

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?` +
        `client_id=${appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&response_type=code` +
        `&state=${state}`;

    return authUrl;
};

/**
 * Start local server to receive OAuth callback
 */
export const startOAuthServer = () => {
    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url, 'http://localhost:8086');

                if (url.pathname === '/oauth2callback') {
                    const code = url.searchParams.get('code');
                    const state = url.searchParams.get('state');
                    const error = url.searchParams.get('error');

                    if (error) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`<h1>Authorization Error</h1><p>${error}</p>`);
                        server.close();
                        reject(new Error(error));
                        return;
                    }

                    // SECURITY: Validate state parameter to prevent CSRF attacks
                    const stateData = stateStore.get(state);
                    if (!state || !stateData) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`
                            <html>
                                <body style="font-family: Arial; text-align: center; padding: 50px;">
                                    <h1>Security Error</h1>
                                    <p>Invalid or expired state parameter. Please try again.</p>
                                </body>
                            </html>
                        `);
                        server.close();
                        reject(new Error('Invalid state parameter - possible CSRF attack'));
                        return;
                    }

                    // Extract userId from state
                    const userId = stateData.userId;

                    // Remove state to prevent reuse
                    stateStore.delete(state);

                    if (code) {
                        // Exchange code for access token
                        const tokenResult = await exchangeCodeForToken(userId, code);

                        if (tokenResult.success) {
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(`
                                <html>
                                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                                        <h1>✅ Facebook Authorization Successful!</h1>
                                        <p>Connected to Page: <strong>${tokenResult.pageName || 'Unknown'}</strong></p>
                                        <p>You can close this window and return to the terminal.</p>
                                        <script>setTimeout(() => window.close(), 3000);</script>
                                    </body>
                                </html>
                            `);
                            server.close();
                            resolve({ ...tokenResult, userId });
                        } else {
                            res.writeHead(400, { 'Content-Type': 'text/html' });
                            res.end(`<h1>Error</h1><p>${tokenResult.error}</p>`);
                            server.close();
                            reject(new Error(tokenResult.error));
                        }
                    }
                }
            } catch (error) {
                res.writeHead(500);
                res.end('Error processing authorization');
                server.close();
                reject(error);
            }
        });

        server.listen(8086, () => {
            console.log('   ⏳ Waiting for Facebook authorization...');
            console.log('   (Listening on http://localhost:8086/oauth2callback)');
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            server.close();
            reject(new Error('OAuth flow timed out after 5 minutes'));
        }, 5 * 60 * 1000);

        server.on('error', (err) => {
            reject(err);
        });
    });
};

/**
 * Exchange authorization code for tokens
 * @param {string} userId - User ID (required)
 * @param {string} code - Authorization code from Facebook
 */
const exchangeCodeForToken = async (userId, code) => {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = getRedirectUri();

    if (!appId || !appSecret) {
        throw new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set');
    }

    try {
        // Exchange code for user access token
        const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` +
            `client_id=${appId}` +
            `&client_secret=${appSecret}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&code=${code}`;

        const tokenRes = await fetch(tokenUrl);
        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            throw new Error(tokenData.error.message);
        }

        const userAccessToken = tokenData.access_token;

        // Get long-lived token (60 days instead of 1 hour)
        const longLivedUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` +
            `grant_type=fb_exchange_token` +
            `&client_id=${appId}` +
            `&client_secret=${appSecret}` +
            `&fb_exchange_token=${userAccessToken}`;

        const longLivedRes = await fetch(longLivedUrl);
        const longLivedData = await longLivedRes.json();

        const longLivedToken = longLivedData.access_token || userAccessToken;

        // Get user's pages
        const pagesRes = await fetch(
            `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}`
        );
        const pagesData = await pagesRes.json();

        if (!pagesData.data || pagesData.data.length === 0) {
            throw new Error('No Facebook Pages found. You need a Page to post Reels.');
        }

        // Use first page (or let user choose later)
        const page = pagesData.data[0];

        const tokens = {
            userAccessToken: longLivedToken,
            pageAccessToken: page.access_token,
            pageId: page.id,
            pageName: page.name,
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // ~60 days
            scope: tokenData.scope
        };

        await saveTokens(userId, tokens);

        console.log(`   ✅ [User: ${userId}] Connected to Facebook Page: ${page.name}`);

        return {
            success: true,
            pageId: page.id,
            pageName: page.name,
            allPages: pagesData.data.map(p => ({ id: p.id, name: p.name }))
        };

    } catch (error) {
        console.error(`   ❌ [User: ${userId}] Token exchange failed:`, error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Upload a Reel to Facebook Page
 * @param {string} userId - User ID (required)
 * @param {string} videoPath - Path to video file
 * @param {object} metadata - Video metadata
 */
export const uploadToFacebookAPI = async (userId, videoPath, metadata = {}) => {
    if (!userId) {
        throw new Error('userId is required for Facebook upload');
    }

    console.log(`📤 [User: ${userId}] Uploading to Facebook Reels via API...`);

    if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
    }

    const tokens = await loadTokens(userId);
    if (!tokens || !tokens.pageAccessToken) {
        throw new Error('Not authorized. Please connect your Facebook account first.');
    }

    const pageId = tokens.pageId;
    const accessToken = tokens.pageAccessToken;

    const { description = '', hashtags = [] } = metadata;

    try {
        const fileSize = fs.statSync(videoPath).size;
        const fullDescription = `${description}\n\n${hashtags.join(' ')}`.slice(0, 2200);

        console.log(`   📋 [User: ${userId}] Description: ${fullDescription.substring(0, 50)}...`);
        console.log(`   📁 [User: ${userId}] File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

        // Step 1: Initialize upload session
        console.log(`   🔄 [User: ${userId}] Initializing upload session...`);
        const initRes = await fetch(
            `https://graph.facebook.com/v19.0/${pageId}/video_reels?` +
            `upload_phase=start` +
            `&access_token=${accessToken}`,
            { method: 'POST' }
        );
        const initData = await initRes.json();

        if (initData.error) {
            throw new Error(initData.error.message);
        }

        const videoId = initData.video_id;
        const uploadUrl = initData.upload_url;

        console.log(`   📝 [User: ${userId}] Video ID: ${videoId}`);

        // Step 2: Upload video file
        console.log(`   ⬆️ [User: ${userId}] Uploading video file...`);
        const videoBuffer = fs.readFileSync(videoPath);

        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileSize.toString()
            },
            body: videoBuffer
        });

        const uploadData = await uploadRes.json();

        if (uploadData.error) {
            throw new Error(uploadData.error.message);
        }

        console.log(`   ✅ [User: ${userId}] Video uploaded, finalizing...`);

        // Step 3: Finish upload and publish
        const finishRes = await fetch(
            `https://graph.facebook.com/v19.0/${pageId}/video_reels?` +
            `upload_phase=finish` +
            `&video_id=${videoId}` +
            `&video_state=PUBLISHED` +
            `&description=${encodeURIComponent(fullDescription)}` +
            `&access_token=${accessToken}`,
            { method: 'POST' }
        );

        const finishData = await finishRes.json();

        if (finishData.error) {
            throw new Error(finishData.error.message);
        }

        const reelUrl = `https://www.facebook.com/reel/${finishData.video_id || videoId}`;

        console.log(`   ✅ [User: ${userId}] Reel published successfully!`);
        console.log(`   🔗 URL: ${reelUrl}`);

        return {
            success: true,
            platform: 'facebook',
            videoId: finishData.video_id || videoId,
            videoUrl: reelUrl,
            message: 'Reel uploaded to Facebook via API'
        };

    } catch (error) {
        console.error(`   ❌ [User: ${userId}] Facebook API upload failed:`, error.message);

        if (error.message.includes('OAuthException') || error.message.includes('expired')) {
            return {
                success: false,
                platform: 'facebook',
                error: 'Facebook authorization expired. Please reconnect your account.',
                needsReauth: true
            };
        }

        return {
            success: false,
            platform: 'facebook',
            error: error.message
        };
    }
};

/**
 * Check Facebook API authorization status
 * @param {string} userId - User ID (required)
 */
export const checkFacebookAPIStatus = async (userId) => {
    if (!userId) {
        return {
            authorized: false,
            error: 'userId is required'
        };
    }

    try {
        const tokens = await loadTokens(userId);

        if (!tokens) {
            return {
                authorized: false,
                message: 'Not connected to Facebook'
            };
        }

        // Check if token is expired
        if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
            return {
                authorized: false,
                message: 'Token expired. Please reconnect.',
                needsReauth: true
            };
        }

        // Verify token by fetching page info
        const res = await fetch(
            `https://graph.facebook.com/v19.0/${tokens.pageId}?` +
            `fields=name,fan_count,followers_count` +
            `&access_token=${tokens.pageAccessToken}`
        );
        const data = await res.json();

        if (data.error) {
            return {
                authorized: false,
                message: data.error.message,
                needsReauth: data.error.code === 190
            };
        }

        return {
            authorized: true,
            page: {
                id: tokens.pageId,
                name: data.name,
                followers: data.followers_count || data.fan_count || 0
            },
            expiresAt: tokens.expiresAt,
            message: `Authorized as: ${data.name}`
        };

    } catch (error) {
        console.error(`   [User: ${userId}] Facebook status check failed:`, error.message);
        return {
            authorized: false,
            message: error.message
        };
    }
};

/**
 * Get list of user's Facebook Pages
 * @param {string} userId - User ID (required)
 */
export const getPages = async (userId) => {
    if (!userId) {
        throw new Error('userId is required to get pages');
    }

    const tokens = await loadTokens(userId);

    if (!tokens || !tokens.userAccessToken) {
        throw new Error('Not authorized');
    }

    const res = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${tokens.userAccessToken}`
    );
    const data = await res.json();

    if (data.error) {
        throw new Error(data.error.message);
    }

    return data.data.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category
    }));
};

/**
 * Switch to a different Facebook Page
 * @param {string} userId - User ID (required)
 * @param {string} pageId - Page ID to switch to
 */
export const switchPage = async (userId, pageId) => {
    if (!userId) {
        throw new Error('userId is required to switch page');
    }

    const tokens = await loadTokens(userId);

    if (!tokens || !tokens.userAccessToken) {
        throw new Error('Not authorized');
    }

    // Get page access token for the selected page
    const res = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}?` +
        `fields=access_token,name` +
        `&access_token=${tokens.userAccessToken}`
    );
    const data = await res.json();

    if (data.error) {
        throw new Error(data.error.message);
    }

    // Update tokens with new page
    const updatedTokens = {
        ...tokens,
        pageId: pageId,
        pageName: data.name,
        pageAccessToken: data.access_token
    };
    await saveTokens(userId, updatedTokens);

    console.log(`   ✅ [User: ${userId}] Switched to page: ${data.name}`);

    return {
        success: true,
        pageId: pageId,
        pageName: data.name
    };
};

/**
 * Disconnect Facebook API - remove user's stored tokens
 * @param {string} userId - User ID (required)
 */
export const disconnectFacebookAPI = async (userId) => {
    if (!userId) {
        throw new Error('userId is required to disconnect Facebook');
    }

    try {
        await dataService.tokens.deleteToken(userId, 'facebook');
        console.log(`   🔓 [User: ${userId}] Facebook tokens removed`);
        return { success: true, message: 'Facebook disconnected successfully' };
    } catch (err) {
        console.error('Failed to disconnect Facebook:', err.message);
        return { success: false, error: err.message };
    }
};

export default {
    getAuthUrl,
    startOAuthServer,
    uploadToFacebookAPI,
    checkFacebookAPIStatus,
    getPages,
    switchPage,
    disconnectFacebookAPI
};
