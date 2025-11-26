import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';
import fetch from 'node-fetch';
import FormData from 'form-data';

const TOKENS_PATH = '/app/data/facebook_tokens.json';

/**
 * Facebook Graph API Uploader for Reels
 * Uses official Facebook/Instagram Graph API for reliable uploads
 *
 * Requirements:
 * 1. Facebook App (developers.facebook.com)
 * 2. App permissions: pages_manage_posts, pages_read_engagement, publish_video
 * 3. Page Access Token (for posting to Facebook Page)
 *
 * Environment Variables:
 * - FACEBOOK_APP_ID: Your Facebook App ID
 * - FACEBOOK_APP_SECRET: Your Facebook App Secret
 * - FACEBOOK_PAGE_ID: Your Facebook Page ID (for Reels)
 */

/**
 * Load saved tokens
 */
const loadTokens = () => {
    if (fs.existsSync(TOKENS_PATH)) {
        return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
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
    console.log('   💾 Facebook tokens saved');
};

/**
 * Generate OAuth authorization URL
 */
export const getAuthUrl = () => {
    const appId = process.env.FACEBOOK_APP_ID;

    if (!appId) {
        throw new Error('FACEBOOK_APP_ID not set in environment variables');
    }

    const redirectUri = 'http://localhost:8086/oauth2callback';
    const scope = [
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',
        'publish_video',
        'pages_read_user_content'
    ].join(',');

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?` +
        `client_id=${appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&response_type=code`;

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
                    const error = url.searchParams.get('error');

                    if (error) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`<h1>Authorization Error</h1><p>${error}</p>`);
                        server.close();
                        reject(new Error(error));
                        return;
                    }

                    if (code) {
                        // Exchange code for access token
                        const tokenResult = await exchangeCodeForToken(code);

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
                            resolve(tokenResult);
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
            console.log('   OAuth callback server listening on port 8086');
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            server.close();
            reject(new Error('OAuth timeout - no response received'));
        }, 300000);
    });
};

/**
 * Exchange authorization code for tokens
 */
const exchangeCodeForToken = async (code) => {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = 'http://localhost:8086/oauth2callback';

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
            savedAt: new Date().toISOString()
        };

        saveTokens(tokens);

        console.log(`   ✅ Connected to Facebook Page: ${page.name}`);

        return {
            success: true,
            pageId: page.id,
            pageName: page.name,
            allPages: pagesData.data.map(p => ({ id: p.id, name: p.name }))
        };

    } catch (error) {
        console.error('   ❌ Token exchange failed:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Upload a Reel to Facebook Page
 * Facebook Reels API: Resumable upload for videos
 */
export const uploadToFacebookAPI = async (videoPath, { description, hashtags = [] }) => {
    console.log('📤 Uploading to Facebook Reels via API...');

    if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
    }

    const tokens = loadTokens();
    if (!tokens || !tokens.pageAccessToken) {
        throw new Error('Not authorized. Run Facebook authorization first via /facebook-api/auth');
    }

    const pageId = process.env.FACEBOOK_PAGE_ID || tokens.pageId;
    const accessToken = tokens.pageAccessToken;

    try {
        const fileSize = fs.statSync(videoPath).size;
        const fullDescription = `${description}\n\n${hashtags.join(' ')}`.slice(0, 2200);

        console.log(`   📋 Description: ${fullDescription.substring(0, 50)}...`);
        console.log(`   📁 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

        // Step 1: Initialize upload session
        console.log('   🔄 Initializing upload session...');
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

        console.log(`   📝 Video ID: ${videoId}`);

        // Step 2: Upload video file
        console.log('   ⬆️ Uploading video file...');
        const videoBuffer = fs.readFileSync(videoPath);

        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `OAuth ${accessToken}`,
                'offset': '0',
                'file_size': fileSize.toString(),
                'Content-Type': 'application/octet-stream'
            },
            body: videoBuffer
        });

        const uploadData = await uploadRes.json();

        if (uploadData.error) {
            throw new Error(uploadData.error.message);
        }

        console.log('   ✅ Video uploaded, finalizing...');

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

        console.log(`   ✅ Reel published successfully!`);
        console.log(`   🔗 URL: ${reelUrl}`);

        return {
            success: true,
            platform: 'facebook',
            videoId: finishData.video_id || videoId,
            reelUrl: reelUrl,
            message: 'Reel uploaded to Facebook via API'
        };

    } catch (error) {
        console.error('   ❌ Facebook API upload failed:', error.message);

        // Handle specific errors
        if (error.message.includes('OAuthException')) {
            return {
                success: false,
                platform: 'facebook',
                error: 'Facebook token expired. Re-authorize via /facebook-api/auth',
                tokenExpired: true
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
 */
export const checkFacebookAPIStatus = async () => {
    try {
        const tokens = loadTokens();

        if (!tokens) {
            return {
                authorized: false,
                message: 'Not authorized. Visit /facebook-api/auth to authorize.'
            };
        }

        // Check if token is expired
        if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
            return {
                authorized: false,
                message: 'Token expired. Re-authorize via /facebook-api/auth',
                tokenExpired: true
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
                tokenExpired: data.error.code === 190
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
        return {
            authorized: false,
            message: error.message
        };
    }
};

/**
 * Get list of user's Facebook Pages
 */
export const getPages = async () => {
    const tokens = loadTokens();

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
 */
export const switchPage = async (pageId) => {
    const tokens = loadTokens();

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

    // Update tokens
    tokens.pageId = pageId;
    tokens.pageName = data.name;
    tokens.pageAccessToken = data.access_token;
    saveTokens(tokens);

    console.log(`   ✅ Switched to page: ${data.name}`);

    return {
        success: true,
        pageId: pageId,
        pageName: data.name
    };
};

export default {
    getAuthUrl,
    startOAuthServer,
    uploadToFacebookAPI,
    checkFacebookAPIStatus,
    getPages,
    switchPage
};
