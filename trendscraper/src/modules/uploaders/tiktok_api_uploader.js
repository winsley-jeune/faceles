import fs from 'fs';
import crypto from 'crypto';
import http from 'http';
import { URL } from 'url';
import fetch from 'node-fetch';
import dataService from '../../services/dataService.js';

// SECURITY: Request-scoped PKCE storage to prevent race conditions
// Each OAuth flow gets its own state parameter as a key
// Now includes userId for multi-tenant isolation
const pkceStore = new Map();

// Cleanup expired PKCE entries every 5 minutes
const PKCE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [state, data] of pkceStore.entries()) {
        if (data.expiresAt < now) {
            pkceStore.delete(state);
        }
    }
}, 5 * 60 * 1000);

/**
 * Generate PKCE code verifier and challenge
 * TikTok requires PKCE for OAuth authorization (Desktop/Sandbox apps)
 *
 * Requirements per TikTok docs:
 * - Code verifier: 43-128 chars using [A-Z]/[a-z]/[0-9]/"-"/"."/"_"/"~"
 * - Code challenge: SHA256 hash in HEX encoding
 */
const generatePKCE = () => {
    const allowedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let codeVerifier = '';
    const randomBytes = crypto.randomBytes(64);
    for (let i = 0; i < 64; i++) {
        codeVerifier += allowedChars[randomBytes[i] % allowedChars.length];
    }

    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('hex');

    return { codeVerifier, codeChallenge };
};

/**
 * TikTok Content Posting API Uploader - Database Edition
 * Uses official TikTok API for video uploads
 *
 * NOW WITH MULTI-TENANT USER ISOLATION:
 * - Tokens stored per user in PostgreSQL
 * - Each user has their own TikTok connection
 * - No cross-user token sharing
 *
 * Requirements:
 * 1. TikTok Developer Account (developers.tiktok.com)
 * 2. App with "Content Posting API" access
 * 3. OAuth 2.0 authorization with PKCE
 *
 * Environment Variables:
 * - TIKTOK_CLIENT_KEY: Your TikTok App Client Key
 * - TIKTOK_CLIENT_SECRET: Your TikTok App Client Secret
 */

/**
 * Load saved tokens for user from database
 * @param {string} userId - User ID (required)
 */
const loadTokens = async (userId) => {
    try {
        const tokenData = await dataService.tokens.getToken(userId, 'tiktok');
        if (!tokenData) return null;

        return {
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
            expiresAt: tokenData.expiresAt,
            scope: tokenData.scope,
            tokenType: tokenData.tokenType || 'Bearer',
            openId: tokenData.metadata?.openId
        };
    } catch (err) {
        console.error('Failed to load TikTok tokens:', err.message);
        return null;
    }
};

/**
 * Save tokens to database for user
 * @param {string} userId - User ID (required)
 * @param {object} tokens - OAuth tokens from TikTok
 */
const saveTokens = async (userId, tokens) => {
    try {
        await dataService.tokens.saveToken(userId, 'tiktok', {
            accessToken: tokens.accessToken || tokens.access_token,
            refreshToken: tokens.refreshToken || tokens.refresh_token,
            expiresAt: tokens.expiresAt || (Date.now() + (tokens.expires_in * 1000)),
            scope: tokens.scope,
            tokenType: tokens.tokenType || tokens.token_type || 'Bearer',
            metadata: {
                openId: tokens.openId || tokens.open_id
            }
        });
        console.log(`   💾 [User: ${userId}] TikTok tokens saved`);
    } catch (err) {
        console.error('Failed to save TikTok tokens:', err.message);
        throw err;
    }
};

/**
 * Check if TikTok API is connected (has valid tokens)
 * @param {string} userId - User ID (required)
 */
export const isConnected = async (userId) => {
    try {
        const tokens = await loadTokens(userId);
        if (!tokens || !tokens.accessToken) {
            return false;
        }
        // Check if token is not expired (with 5 min buffer)
        const expiresAt = new Date(tokens.expiresAt);
        const bufferTime = 5 * 60 * 1000; // 5 minutes
        return expiresAt.getTime() > (Date.now() + bufferTime);
    } catch (err) {
        return false;
    }
};

/**
 * Get OAuth redirect URI based on environment
 */
const getRedirectUri = () => {
    if (process.env.TIKTOK_REDIRECT_URI) {
        return process.env.TIKTOK_REDIRECT_URI;
    }
    if (process.env.NODE_ENV === 'production') {
        const baseUrl = process.env.BASE_URL || 'https://localhost:8087';
        return `${baseUrl}/oauth2callback/`;
    }
    return 'http://localhost:8087/oauth2callback/';
};

/**
 * Generate OAuth authorization URL with PKCE
 * @param {string} userId - User ID (required for multi-tenant isolation)
 */
export const getAuthUrl = (userId) => {
    if (!userId) {
        throw new Error('userId is required for TikTok OAuth');
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) {
        throw new Error('TIKTOK_CLIENT_KEY not set in environment variables');
    }

    const redirectUri = getRedirectUri();
    const scope = ['user.info.basic', 'video.publish', 'video.upload'].join(',');

    // SECURITY: Generate cryptographic state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Generate PKCE code verifier and challenge
    const { codeVerifier, codeChallenge } = generatePKCE();

    // SECURITY: Store code verifier keyed by state with userId
    pkceStore.set(state, {
        userId,  // Track which user is authorizing
        codeVerifier,
        createdAt: Date.now(),
        expiresAt: Date.now() + PKCE_EXPIRY_MS
    });

    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    authUrl.searchParams.append('client_key', clientKey);
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');

    return authUrl.toString();
};

/**
 * Start local server to receive OAuth callback
 */
export const startOAuthServer = () => {
    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url, 'http://localhost:8087');

                if (url.pathname === '/oauth2callback/' || url.pathname === '/oauth2callback') {
                    const code = url.searchParams.get('code');
                    const state = url.searchParams.get('state');
                    const error = url.searchParams.get('error');
                    const errorDescription = url.searchParams.get('error_description');

                    if (error) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`
                            <html>
                                <body style="font-family: Arial; text-align: center; padding: 50px;">
                                    <h1>TikTok Authorization Failed</h1>
                                    <p>Error: ${error}</p>
                                    <p>${errorDescription || ''}</p>
                                </body>
                            </html>
                        `);
                        server.close();
                        reject(new Error(`TikTok OAuth error: ${error} - ${errorDescription}`));
                        return;
                    }

                    // SECURITY: Validate state parameter
                    const pkceData = pkceStore.get(state);
                    if (!state || !pkceData) {
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

                    const userId = pkceData.userId;
                    const codeVerifier = pkceData.codeVerifier;

                    // Remove PKCE data to prevent reuse
                    pkceStore.delete(state);

                    if (code) {
                        // Exchange code for access token
                        const clientKey = process.env.TIKTOK_CLIENT_KEY;
                        const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
                        const redirectUri = getRedirectUri();

                        const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'Cache-Control': 'no-cache'
                            },
                            body: new URLSearchParams({
                                client_key: clientKey,
                                client_secret: clientSecret,
                                code: code,
                                grant_type: 'authorization_code',
                                redirect_uri: redirectUri,
                                code_verifier: codeVerifier
                            })
                        });

                        const tokenData = await tokenResponse.json();

                        if (tokenData.error) {
                            throw new Error(`Token exchange failed: ${tokenData.error} - ${tokenData.error_description}`);
                        }

                        const tokens = {
                            accessToken: tokenData.access_token,
                            refreshToken: tokenData.refresh_token,
                            expiresAt: Date.now() + (tokenData.expires_in * 1000),
                            scope: tokenData.scope,
                            tokenType: tokenData.token_type,
                            openId: tokenData.open_id
                        };

                        await saveTokens(userId, tokens);

                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(`
                            <html>
                                <body style="font-family: Arial; text-align: center; padding: 50px;">
                                    <h1>TikTok Authorization Successful!</h1>
                                    <p>You can close this window and return to the terminal.</p>
                                    <script>setTimeout(() => window.close(), 3000);</script>
                                </body>
                            </html>
                        `);

                        server.close();
                        resolve({ success: true, tokens, userId });
                    } else {
                        res.writeHead(400);
                        res.end('No authorization code received');
                        server.close();
                        reject(new Error('No authorization code received'));
                    }
                }
            } catch (error) {
                console.error('OAuth callback error:', error);
                res.writeHead(500);
                res.end('Internal server error');
                server.close();
                reject(error);
            }
        });

        server.listen(8087, () => {
            console.log('   ⏳ Waiting for TikTok authorization...');
            console.log('   (Listening on http://localhost:8087/oauth2callback/)');

            setTimeout(() => {
                server.close();
                reject(new Error('OAuth flow timed out after 5 minutes'));
            }, 5 * 60 * 1000);
        });

        server.on('error', (err) => {
            reject(err);
        });
    });
};

/**
 * Refresh access token using refresh token
 * @param {string} userId - User ID (required)
 */
export const refreshAccessToken = async (userId) => {
    if (!userId) {
        throw new Error('userId is required to refresh token');
    }

    try {
        const tokens = await loadTokens(userId);
        if (!tokens || !tokens.refreshToken) {
            throw new Error('No refresh token available');
        }

        const clientKey = process.env.TIKTOK_CLIENT_KEY;
        const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

        const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_key: clientKey,
                client_secret: clientSecret,
                grant_type: 'refresh_token',
                refresh_token: tokens.refreshToken
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(`Token refresh failed: ${data.error}`);
        }

        const newTokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + (data.expires_in * 1000),
            scope: data.scope,
            tokenType: data.token_type,
            openId: tokens.openId
        };

        await saveTokens(userId, newTokens);
        console.log(`   🔄 [User: ${userId}] TikTok tokens refreshed`);

        return newTokens;
    } catch (error) {
        console.error(`   [User: ${userId}] Token refresh failed:`, error.message);
        throw error;
    }
};

/**
 * Upload video to TikTok
 * @param {string} userId - User ID (required)
 * @param {string} videoPath - Path to video file
 * @param {object} metadata - Video metadata
 */
export const uploadToTikTokAPI = async (userId, videoPath, { caption, title, description, hashtags = [] }) => {
    if (!userId) {
        throw new Error('userId is required for TikTok upload');
    }

    try {
        let tokens = await loadTokens(userId);
        if (!tokens) {
            throw new Error('Not authorized. Please connect your TikTok account first.');
        }

        // Check if token expired, refresh if needed
        if (new Date(tokens.expiresAt).getTime() <= Date.now()) {
            console.log(`   [User: ${userId}] Token expired, refreshing...`);
            tokens = await refreshAccessToken(userId);
        }

        const clientKey = process.env.TIKTOK_CLIENT_KEY;
        const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

        // Step 1: Initialize upload
        console.log(`   📤 [User: ${userId}] Initializing TikTok upload...`);

        const videoBuffer = fs.readFileSync(videoPath);
        const videoSizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);

        const initResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8'
            },
            body: JSON.stringify({
                source_info: {
                    source: 'FILE_UPLOAD',
                    video_size: videoBuffer.length,
                    chunk_size: videoBuffer.length,
                    total_chunk_count: 1
                }
            })
        });

        const initData = await initResponse.json();

        if (initData.error) {
            throw new Error(`Upload init failed: ${initData.error.message}`);
        }

        const publishId = initData.data.publish_id;
        const uploadUrl = initData.data.upload_url;

        console.log(`   📤 [User: ${userId}] Uploading video (${videoSizeMB} MB)...`);

        // Step 2: Upload video content
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': videoBuffer.length.toString()
            },
            body: videoBuffer
        });

        if (!uploadResponse.ok) {
            throw new Error(`Video upload failed: ${uploadResponse.statusText}`);
        }

        // Step 3: Publish video
        console.log(`   📤 [User: ${userId}] Publishing to TikTok...`);

        const fullCaption = caption || [title, description, ...hashtags].filter(Boolean).join(' ');

        const publishResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8'
            },
            body: JSON.stringify({
                post_info: {
                    title: title || 'Short Video',
                    privacy_level: 'SELF_ONLY',
                    disable_comment: false,
                    disable_duet: false,
                    disable_stitch: false,
                    video_cover_timestamp_ms: 1000
                },
                source_info: {
                    source: 'FILE_UPLOAD',
                    video_size: videoBuffer.length,
                    chunk_size: videoBuffer.length,
                    total_chunk_count: 1
                },
                post_mode: 'DIRECT_POST',
                media_type: 'VIDEO'
            })
        });

        const publishData = await publishResponse.json();

        if (publishData.error) {
            throw new Error(`Publish failed: ${publishData.error.message}`);
        }

        console.log(`   ✅ [User: ${userId}] TikTok upload successful`);

        return {
            success: true,
            publishId: publishData.data.publish_id,
            platform: 'tiktok'
        };
    } catch (error) {
        console.error(`   ❌ [User: ${userId}] TikTok upload failed:`, error.message);

        if (error.message?.includes('invalid_grant') || error.message?.includes('Token has been expired')) {
            return {
                success: false,
                error: 'TikTok authorization expired. Please reconnect your account.',
                needsReauth: true
            };
        }

        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Check TikTok API connection status
 * @param {string} userId - User ID (required)
 */
export const checkTikTokAPIStatus = async (userId) => {
    if (!userId) {
        return { authorized: false, error: 'userId is required' };
    }

    try {
        const tokens = await loadTokens(userId);
        if (!tokens) {
            return { authorized: false, message: 'Not connected to TikTok' };
        }

        // Check if token expired
        if (new Date(tokens.expiresAt).getTime() <= Date.now()) {
            return {
                authorized: false,
                message: 'Token expired',
                needsReauth: true
            };
        }

        // Try to get creator info
        const creatorInfo = await getCreatorInfo(userId);
        if (creatorInfo) {
            return {
                authorized: true,
                creator: creatorInfo
            };
        }

        return { authorized: true };
    } catch (error) {
        console.error(`   [User: ${userId}] TikTok status check failed:`, error.message);
        return { authorized: false, error: error.message };
    }
};

/**
 * Get creator info from TikTok API
 * @param {string} userId - User ID (required)
 */
export const getCreatorInfo = async (userId) => {
    if (!userId) {
        throw new Error('userId is required to get creator info');
    }

    try {
        const tokens = await loadTokens(userId);
        if (!tokens) {
            throw new Error('Not authorized');
        }

        const response = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokens.accessToken}`
            }
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(`Failed to get creator info: ${data.error.message}`);
        }

        return data.data?.user || null;
    } catch (error) {
        console.error(`   [User: ${userId}] Failed to get creator info:`, error.message);
        return null;
    }
};

/**
 * Disconnect TikTok API - remove user's stored tokens
 * @param {string} userId - User ID (required)
 */
export const disconnectTikTokAPI = async (userId) => {
    if (!userId) {
        throw new Error('userId is required to disconnect TikTok');
    }

    try {
        await dataService.tokens.deleteToken(userId, 'tiktok');
        console.log(`   🔓 [User: ${userId}] TikTok tokens removed`);
        return { success: true, message: 'TikTok disconnected successfully' };
    } catch (err) {
        console.error('Failed to disconnect TikTok:', err.message);
        return { success: false, error: err.message };
    }
};

export default {
    isConnected,
    getAuthUrl,
    startOAuthServer,
    refreshAccessToken,
    uploadToTikTokAPI,
    checkTikTokAPIStatus,
    getCreatorInfo,
    disconnectTikTokAPI
};
