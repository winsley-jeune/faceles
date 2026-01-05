import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';
import crypto from 'crypto';
import dataService from '../../services/dataService.js';

// Legacy paths (fallback for credentials only)
const CREDENTIALS_PATH = '/app/data/youtube_credentials.json';

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
 * YouTube API Uploader - Database Edition
 * Uses official YouTube Data API v3 for reliable uploads
 * Quota: ~6 videos/day (10,000 units, ~1,600 per upload)
 *
 * NOW WITH MULTI-TENANT USER ISOLATION:
 * - Tokens stored per user in PostgreSQL
 * - Each user has their own YouTube connection
 * - No cross-user token sharing
 */

/**
 * Get OAuth redirect URI based on environment
 */
const getRedirectUri = () => {
    if (process.env.YOUTUBE_REDIRECT_URI) {
        return process.env.YOUTUBE_REDIRECT_URI;
    }
    if (process.env.NODE_ENV === 'production') {
        const baseUrl = process.env.BASE_URL || 'https://localhost:8085';
        return `${baseUrl}/oauth2callback`;
    }
    return 'http://localhost:8085/oauth2callback';
};

/**
 * Get OAuth2 client with credentials
 */
const getOAuth2Client = () => {
    let clientId = process.env.YOUTUBE_CLIENT_ID;
    let clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    // Fall back to credentials file
    if ((!clientId || !clientSecret) && fs.existsSync(CREDENTIALS_PATH)) {
        const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        clientId = creds.client_id || creds.installed?.client_id || creds.web?.client_id;
        clientSecret = creds.client_secret || creds.installed?.client_secret || creds.web?.client_secret;
    }

    if (!clientId || !clientSecret) {
        throw new Error('YouTube API credentials not found. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars');
    }

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        getRedirectUri()
    );

    return oauth2Client;
};

/**
 * Load saved tokens for user from database
 * @param {string} userId - User ID (required)
 */
const loadTokens = async (userId) => {
    try {
        const tokenData = await dataService.tokens.getToken(userId, 'youtube');
        if (!tokenData) return null;

        return {
            access_token: tokenData.accessToken,
            refresh_token: tokenData.refreshToken,
            scope: tokenData.scope,
            token_type: tokenData.tokenType || 'Bearer',
            expiry_date: tokenData.expiresAt ? new Date(tokenData.expiresAt).getTime() : null
        };
    } catch (err) {
        console.error('Failed to load YouTube tokens:', err.message);
        return null;
    }
};

/**
 * Save tokens to database for user
 * @param {string} userId - User ID (required)
 * @param {object} tokens - OAuth tokens from Google
 */
const saveTokens = async (userId, tokens) => {
    try {
        await dataService.tokens.saveToken(userId, 'youtube', {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            scope: tokens.scope,
            tokenType: tokens.token_type || 'Bearer'
        });
        console.log(`   💾 [User: ${userId}] YouTube API tokens saved`);
    } catch (err) {
        console.error('Failed to save YouTube tokens:', err.message);
        throw err;
    }
};

/**
 * Interactive OAuth flow - opens browser for authorization
 * Returns authorization URL for user to visit
 * @param {string} userId - User ID (required for multi-tenant isolation)
 */
export const getAuthUrl = (userId) => {
    if (!userId) {
        throw new Error('userId is required for YouTube OAuth');
    }

    const oauth2Client = getOAuth2Client();

    // SECURITY: Generate cryptographic state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    stateStore.set(state, {
        userId,  // Store userId to retrieve in callback
        createdAt: Date.now(),
        expiresAt: Date.now() + STATE_EXPIRY_MS
    });

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube'
        ],
        prompt: 'consent', // Force to get refresh token
        state: state // CSRF protection
    });

    return authUrl;
};

/**
 * Start local server to receive OAuth callback
 */
export const startOAuthServer = () => {
    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url, 'http://localhost:8085');

                if (url.pathname === '/oauth2callback') {
                    const code = url.searchParams.get('code');
                    const state = url.searchParams.get('state');

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
                        const oauth2Client = getOAuth2Client();
                        const { tokens } = await oauth2Client.getToken(code);
                        await saveTokens(userId, tokens);

                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(`
                            <html>
                                <body style="font-family: Arial; text-align: center; padding: 50px;">
                                    <h1>YouTube Authorization Successful!</h1>
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

        server.listen(8085, () => {
            console.log('   ⏳ Waiting for YouTube authorization...');
            console.log('   (Listening on http://localhost:8085/oauth2callback)');

            // Timeout after 5 minutes
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
 * Manual code exchange (for when redirect doesn't work)
 * @param {string} userId - User ID (required)
 * @param {string} code - Authorization code from Google
 */
export const exchangeCode = async (userId, code) => {
    if (!userId) {
        throw new Error('userId is required for token exchange');
    }

    try {
        const oauth2Client = getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);
        await saveTokens(userId, tokens);
        return { success: true, message: 'Tokens saved successfully' };
    } catch (error) {
        console.error('Token exchange error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Upload video to YouTube
 * @param {string} userId - User ID (required)
 * @param {string} videoPath - Path to video file
 * @param {object} metadata - Video metadata
 */
export const uploadToYouTubeAPI = async (userId, videoPath, metadata = {}) => {
    if (!userId) {
        throw new Error('userId is required for YouTube upload');
    }

    try {
        // Load user's tokens
        const tokens = await loadTokens(userId);
        if (!tokens) {
            throw new Error('Not authorized. Please connect your YouTube account first.');
        }

        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials(tokens);

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        const {
            title = 'Untitled Short',
            description = '',
            hashtags = [],
            tags = [],
            categoryId = '22',
            privacyStatus = 'public'
        } = metadata;

        // Format description with hashtags
        const fullDescription = description + '\n\n' + hashtags.join(' ');

        console.log(`   📤 [User: ${userId}] Uploading to YouTube: ${title}`);

        const response = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title,
                    description: fullDescription,
                    tags,
                    categoryId
                },
                status: {
                    privacyStatus,
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream(videoPath)
            }
        });

        const videoId = response.data.id;
        const videoUrl = `https://youtube.com/shorts/${videoId}`;

        console.log(`   ✅ [User: ${userId}] YouTube upload successful: ${videoUrl}`);

        return {
            success: true,
            videoId,
            videoUrl,
            title,
            platform: 'youtube'
        };
    } catch (error) {
        console.error(`   ❌ [User: ${userId}] YouTube upload failed:`, error.message);

        if (error.message?.includes('invalid_grant') || error.message?.includes('Token has been expired')) {
            return {
                success: false,
                error: 'YouTube authorization expired. Please reconnect your account.',
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
 * Check YouTube API connection status for user
 * @param {string} userId - User ID (required)
 */
export const checkYouTubeAPIStatus = async (userId) => {
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
                message: 'Not connected to YouTube'
            };
        }

        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials(tokens);

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        // Try to get channel info
        const response = await youtube.channels.list({
            part: 'snippet,statistics',
            mine: true
        });

        if (response.data.items && response.data.items.length > 0) {
            const channel = response.data.items[0];
            return {
                authorized: true,
                channel: {
                    id: channel.id,
                    title: channel.snippet.title,
                    subscriberCount: channel.statistics.subscriberCount,
                    videoCount: channel.statistics.videoCount
                }
            };
        }

        return { authorized: false, message: 'No YouTube channel found' };
    } catch (error) {
        console.error(`   [User: ${userId}] YouTube status check failed:`, error.message);

        if (error.message?.includes('invalid_grant') || error.message?.includes('Token has been expired')) {
            return {
                authorized: false,
                error: 'Authorization expired. Please reconnect.',
                needsReauth: true
            };
        }

        return { authorized: false, error: error.message };
    }
};

/**
 * Get quota status
 */
export const getQuotaStatus = () => {
    // YouTube API quota resets at midnight Pacific Time
    const now = new Date();
    const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const midnight = new Date(pacificTime);
    midnight.setHours(24, 0, 0, 0);

    const hoursUntilReset = Math.round((midnight - pacificTime) / (1000 * 60 * 60));

    return {
        dailyLimit: 10000,
        costPerUpload: 1600,
        maxUploadsPerDay: 6,
        quotaResetsIn: `${hoursUntilReset} hours`,
        note: 'Quota resets at midnight Pacific Time'
    };
};

/**
 * Disconnect YouTube API - remove user's stored tokens
 * @param {string} userId - User ID (required)
 */
export const disconnectYouTubeAPI = async (userId) => {
    if (!userId) {
        throw new Error('userId is required to disconnect YouTube');
    }

    try {
        await dataService.tokens.deleteToken(userId, 'youtube');
        console.log(`   🔓 [User: ${userId}] YouTube tokens removed`);
        return { success: true, message: 'YouTube disconnected successfully' };
    } catch (err) {
        console.error('Failed to disconnect YouTube:', err.message);
        return { success: false, error: err.message };
    }
};

export default {
    getAuthUrl,
    startOAuthServer,
    exchangeCode,
    uploadToYouTubeAPI,
    checkYouTubeAPIStatus,
    getQuotaStatus,
    disconnectYouTubeAPI
};
