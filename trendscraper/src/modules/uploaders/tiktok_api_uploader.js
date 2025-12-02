import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { URL } from 'url';
import fetch from 'node-fetch';

const TOKENS_PATH = '/app/data/tiktok_tokens.json';

// Store code verifier for PKCE flow (needed during token exchange)
let currentCodeVerifier = null;

/**
 * Generate PKCE code verifier and challenge
 * TikTok requires PKCE for OAuth authorization (Desktop/Sandbox apps)
 *
 * Requirements per TikTok docs:
 * - Code verifier: 43-128 chars using [A-Z]/[a-z]/[0-9]/"-"/"."/"_"/"~"
 * - Code challenge: SHA256 hash in HEX encoding
 */
const generatePKCE = () => {
    // Generate code verifier using allowed characters (43-128 chars)
    // TikTok allows: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
    const allowedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let codeVerifier = '';
    const randomBytes = crypto.randomBytes(64);
    for (let i = 0; i < 64; i++) {
        codeVerifier += allowedChars[randomBytes[i] % allowedChars.length];
    }

    // Generate code challenge using SHA256 with HEX encoding (TikTok specific)
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('hex');

    console.log(`   PKCE generated - verifier length: ${codeVerifier.length}, challenge: ${codeChallenge.substring(0, 16)}...`);

    return { codeVerifier, codeChallenge };
};

/**
 * TikTok Content Posting API Uploader
 * Uses official TikTok API for video uploads
 *
 * Requirements:
 * 1. TikTok Developer Account (developers.tiktok.com)
 * 2. App with "Content Posting API" access
 * 3. OAuth 2.0 authorization
 *
 * Environment Variables:
 * - TIKTOK_CLIENT_KEY: Your TikTok App Client Key
 * - TIKTOK_CLIENT_SECRET: Your TikTok App Client Secret
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
    console.log('   💾 TikTok tokens saved');
};

/**
 * Generate OAuth authorization URL with PKCE
 * Following TikTok Desktop Login Kit docs exactly
 */
export const getAuthUrl = () => {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;

    if (!clientKey) {
        throw new Error('TIKTOK_CLIENT_KEY not set in environment variables');
    }

    // Redirect URI must match EXACTLY what's registered in TikTok Developer Portal
    // Including trailing slash if configured that way
    const redirectUri = 'http://localhost:8087/oauth2callback/';

    // TikTok OAuth scopes for content posting
    const scope = [
        'user.info.basic',
        'video.publish',
        'video.upload'
    ].join(',');

    // TikTok uses CSRF state parameter (alphanumeric as per docs)
    const state = Math.random().toString(36).substring(2);

    // Generate PKCE code verifier and challenge
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Store code verifier for later use during token exchange
    currentCodeVerifier = codeVerifier;

    // Build URL exactly as TikTok docs show (with trailing slash on authorize)
    const authUrl = `https://www.tiktok.com/v2/auth/authorize/` +
        `?client_key=${clientKey}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${state}` +
        `&code_challenge=${codeChallenge}` +
        `&code_challenge_method=S256`;

    return { authUrl, state, codeVerifier };
};

/**
 * Start local server to receive OAuth callback
 */
export const startOAuthServer = () => {
    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url, 'http://localhost:8087');

                // Handle both with and without trailing slash
                if (url.pathname === '/oauth2callback' || url.pathname === '/oauth2callback/') {
                    const code = url.searchParams.get('code');
                    const error = url.searchParams.get('error');
                    const errorDescription = url.searchParams.get('error_description');

                    if (error) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`<h1>Authorization Error</h1><p>${error}: ${errorDescription}</p>`);
                        server.close();
                        reject(new Error(`${error}: ${errorDescription}`));
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
                                        <h1>✅ TikTok Authorization Successful!</h1>
                                        <p>Connected to: <strong>@${tokenResult.username || 'TikTok User'}</strong></p>
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

        server.listen(8087, () => {
            console.log('   OAuth callback server listening on port 8087');
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            server.close();
            reject(new Error('OAuth timeout - no response received'));
        }, 300000);
    });
};

/**
 * Exchange authorization code for tokens (with PKCE code_verifier)
 */
const exchangeCodeForToken = async (code) => {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    // Must match the redirect_uri used in authorization request (with trailing slash)
    const redirectUri = 'http://localhost:8087/oauth2callback/';

    if (!clientKey || !clientSecret) {
        throw new Error('TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be set');
    }

    if (!currentCodeVerifier) {
        throw new Error('No code verifier available. Please restart the OAuth flow.');
    }

    try {
        // Exchange code for access token (include code_verifier for PKCE)
        const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_key: clientKey,
                client_secret: clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
                code_verifier: currentCodeVerifier
            })
        });

        // Clear the code verifier after use
        const usedCodeVerifier = currentCodeVerifier;
        currentCodeVerifier = null;

        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            throw new Error(tokenData.error_description || tokenData.error);
        }

        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;
        const expiresIn = tokenData.expires_in;
        const openId = tokenData.open_id;

        // Get user info
        const userRes = await fetch(
            `https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );
        const userData = await userRes.json();

        const user = userData.data?.user || {};

        const tokens = {
            accessToken,
            refreshToken,
            openId,
            expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
            username: user.username || user.display_name,
            displayName: user.display_name,
            avatarUrl: user.avatar_url,
            savedAt: new Date().toISOString()
        };

        saveTokens(tokens);

        console.log(`   ✅ Connected to TikTok: @${tokens.username}`);

        return {
            success: true,
            openId,
            username: tokens.username,
            displayName: tokens.displayName
        };

    } catch (error) {
        console.error('   ❌ Token exchange failed:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async () => {
    const tokens = loadTokens();
    if (!tokens || !tokens.refreshToken) {
        throw new Error('No refresh token available');
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_key: clientKey,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: tokens.refreshToken
        })
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
        throw new Error(tokenData.error_description || tokenData.error);
    }

    tokens.accessToken = tokenData.access_token;
    tokens.refreshToken = tokenData.refresh_token;
    tokens.expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    saveTokens(tokens);

    return tokens;
};

/**
 * Upload a video to TikTok
 * TikTok Content Posting API: 3-step process
 * 1. Initialize upload
 * 2. Upload video file
 * 3. Publish with caption
 */
export const uploadToTikTokAPI = async (videoPath, { caption, hashtags = [] }) => {
    console.log('📤 Uploading to TikTok via API...');

    if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
    }

    let tokens = loadTokens();
    if (!tokens || !tokens.accessToken) {
        throw new Error('Not authorized. Run TikTok authorization first via /tiktok-api/auth');
    }

    // Check if token needs refresh
    if (new Date(tokens.expiresAt) < new Date()) {
        console.log('   🔄 Refreshing expired token...');
        tokens = await refreshAccessToken();
    }

    const accessToken = tokens.accessToken;

    try {
        const fileSize = fs.statSync(videoPath).size;
        const fullCaption = `${caption} ${hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`.slice(0, 2200);

        console.log(`   📋 Caption: ${fullCaption.substring(0, 50)}...`);
        console.log(`   📁 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

        // TikTok chunk requirements:
        // - Min chunk: 5MB, Max chunk: 64MB
        // - Files < 64MB: single chunk
        // - Files > 64MB: multiple chunks
        // - total_chunk_count = floor(video_size / chunk_size)
        // - Last chunk contains remaining bytes (can exceed chunk_size up to 128MB)

        let chunkSize, totalChunks;
        const MIN_CHUNK = 5 * 1024 * 1024;   // 5MB minimum
        const MAX_CHUNK = 64 * 1024 * 1024;  // 64MB maximum per chunk
        const MAX_LAST_CHUNK = 128 * 1024 * 1024; // 128MB max for last chunk

        if (fileSize <= MAX_CHUNK) {
            // Small/medium file: single chunk
            chunkSize = fileSize;
            totalChunks = 1;
        } else {
            // Large file: multiple chunks
            // TikTok formula: total_chunk_count = floor(video_size / chunk_size)
            // Last chunk absorbs remainder (up to 128MB)
            chunkSize = MAX_CHUNK;
            totalChunks = Math.floor(fileSize / chunkSize);

            // Calculate what the last chunk would be (remaining bytes after N-1 regular chunks)
            let lastChunkWouldBe = fileSize - ((totalChunks - 1) * chunkSize);

            // If last chunk would exceed 128MB, we need to use smaller chunks
            // to ensure the last chunk stays under 128MB
            if (lastChunkWouldBe > MAX_LAST_CHUNK) {
                // Calculate the ideal chunk size so last chunk is ~120MB (with some margin)
                // We want: fileSize - ((totalChunks - 1) * chunkSize) <= 128MB
                // Solving: chunkSize >= (fileSize - 128MB) / (totalChunks - 1)
                const targetLastChunk = 120 * 1024 * 1024; // Target 120MB for safety
                chunkSize = Math.ceil((fileSize - targetLastChunk) / (totalChunks - 1));

                // Clamp to valid range
                if (chunkSize < MIN_CHUNK) chunkSize = MIN_CHUNK;
                if (chunkSize > MAX_CHUNK) chunkSize = MAX_CHUNK;

                // Recalculate with new chunk size
                totalChunks = Math.floor(fileSize / chunkSize);
                if (totalChunks < 1) totalChunks = 1;
            }
        }

        // Calculate the actual last chunk size for logging
        const lastChunkSize = fileSize - (chunkSize * (totalChunks - 1));
        console.log(`   📦 Upload strategy: ${totalChunks} chunk(s)`);
        console.log(`      - Regular chunks: ${(chunkSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`      - Last chunk: ${(lastChunkSize / 1024 / 1024).toFixed(2)} MB`);

        // Step 1: Initialize video upload
        // Try direct post first, fall back to inbox/draft mode if not approved
        console.log('   🔄 Initializing upload (direct post mode)...');

        // Direct post mode - publishes immediately with caption
        const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                post_info: {
                    title: fullCaption,  // TikTok uses title field for the caption/description
                    privacy_level: 'PUBLIC_TO_EVERYONE',
                    disable_duet: false,
                    disable_comment: false,
                    disable_stitch: false
                },
                source_info: {
                    source: 'FILE_UPLOAD',
                    video_size: fileSize,
                    chunk_size: chunkSize,
                    total_chunk_count: totalChunks
                }
            })
        });

        const initData = await initRes.json();
        console.log('   Init response:', JSON.stringify(initData, null, 2));

        // TikTok returns error.code: "ok" for success, check for actual errors
        if (initData.error?.code && initData.error.code !== 'ok') {
            throw new Error(initData.error.message || `Init failed: ${initData.error.code}`);
        }

        const publishId = initData.data?.publish_id;
        const uploadUrl = initData.data?.upload_url;

        if (!uploadUrl) {
            throw new Error('No upload URL received from TikTok');
        }

        console.log(`   📝 Publish ID: ${publishId}`);

        // Step 2: Upload video file in chunks
        console.log('   ⬆️ Uploading video file...');

        const fileHandle = fs.openSync(videoPath, 'r');

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * chunkSize;
            // Last chunk gets all remaining bytes (can be larger than chunkSize, up to 128MB)
            const isLastChunk = (chunkIndex === totalChunks - 1);
            const end = isLastChunk ? fileSize : (start + chunkSize);
            const currentChunkSize = end - start;

            // Read chunk from file
            const chunkBuffer = Buffer.alloc(currentChunkSize);
            fs.readSync(fileHandle, chunkBuffer, 0, currentChunkSize, start);

            console.log(`      Uploading chunk ${chunkIndex + 1}/${totalChunks} (${(currentChunkSize / 1024 / 1024).toFixed(2)} MB)...`);

            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'video/mp4',
                    'Content-Length': currentChunkSize.toString(),
                    'Content-Range': `bytes ${start}-${end - 1}/${fileSize}`
                },
                body: chunkBuffer
            });

            if (!uploadRes.ok) {
                fs.closeSync(fileHandle);
                throw new Error(`Chunk ${chunkIndex + 1} upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
            }
        }

        fs.closeSync(fileHandle);
        console.log('   ✅ Video uploaded successfully!');

        // Step 3: Check publish status
        console.log('   ⏳ Waiting for TikTok to process...');
        let status = 'PROCESSING';
        let attempts = 0;
        const maxAttempts = 30;
        let videoId = null;

        while (status === 'PROCESSING' && attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds

            const statusRes = await fetch(
                `https://open.tiktokapis.com/v2/post/publish/status/fetch/`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        publish_id: publishId
                    })
                }
            );

            const statusData = await statusRes.json();
            status = statusData.data?.status;
            videoId = statusData.data?.publicaly_available_post_id?.[0]?.id;

            console.log(`      Processing status: ${status} (attempt ${attempts + 1}/${maxAttempts})`);
            attempts++;

            if (status === 'PUBLISH_COMPLETE') {
                break;
            } else if (status === 'FAILED') {
                throw new Error(`Publish failed: ${statusData.data?.fail_reason || 'Unknown error'}`);
            }
        }

        const videoUrl = videoId
            ? `https://www.tiktok.com/@${tokens.username}/video/${videoId}`
            : `https://www.tiktok.com/@${tokens.username}`;

        console.log(`   ✅ Video published successfully!`);
        console.log(`   🔗 URL: ${videoUrl}`);

        return {
            success: true,
            platform: 'tiktok',
            publishId,
            videoId,
            videoUrl,
            message: 'Video uploaded to TikTok via API'
        };

    } catch (error) {
        console.error('   ❌ TikTok API upload failed:', error.message);

        // Handle specific errors
        if (error.message.includes('access_token') || error.message.includes('expired')) {
            return {
                success: false,
                platform: 'tiktok',
                error: 'TikTok token expired. Re-authorize via /tiktok-api/auth',
                tokenExpired: true
            };
        }

        return {
            success: false,
            platform: 'tiktok',
            error: error.message
        };
    }
};

/**
 * Check TikTok API authorization status
 */
export const checkTikTokAPIStatus = async () => {
    try {
        const tokens = loadTokens();

        if (!tokens) {
            return {
                authorized: false,
                message: 'Not authorized. Visit /tiktok-api/auth to authorize.'
            };
        }

        // Check if token is expired
        if (new Date(tokens.expiresAt) < new Date()) {
            // Try to refresh
            try {
                await refreshAccessToken();
            } catch (e) {
                return {
                    authorized: false,
                    message: 'Token expired. Re-authorize via /tiktok-api/auth',
                    tokenExpired: true
                };
            }
        }

        // Try to verify token by fetching user info (may fail in sandbox with limited scopes)
        let user = {};
        try {
            const res = await fetch(
                `https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,avatar_url`,
                {
                    headers: {
                        'Authorization': `Bearer ${tokens.accessToken}`
                    }
                }
            );
            const data = await res.json();

            // If we get an access_token_invalid error, token is bad
            if (data.error?.code === 'access_token_invalid') {
                return {
                    authorized: false,
                    message: 'Token invalid. Re-authorize via /tiktok-api/auth',
                    tokenExpired: true
                };
            }

            user = data.data?.user || {};
        } catch (e) {
            // User info fetch failed, but token might still be valid for posting
            console.log('   Note: User info fetch failed, but tokens exist');
        }

        // Token exists and isn't expired - consider authorized for posting
        return {
            authorized: true,
            user: {
                openId: tokens.openId,
                username: user.username || tokens.username || 'TikTok User',
                displayName: user.display_name || tokens.displayName,
                avatarUrl: user.avatar_url,
            },
            expiresAt: tokens.expiresAt,
            message: `Authorized as: @${user.username || tokens.username}`
        };

    } catch (error) {
        return {
            authorized: false,
            message: error.message
        };
    }
};

/**
 * Get creator info (for checking API access)
 */
export const getCreatorInfo = async () => {
    const tokens = loadTokens();

    if (!tokens || !tokens.accessToken) {
        throw new Error('Not authorized');
    }

    const res = await fetch(
        `https://open.tiktokapis.com/v2/post/publish/creator_info/`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json'
            }
        }
    );
    const data = await res.json();

    if (data.error?.code) {
        throw new Error(data.error.message);
    }

    return data.data;
};

/**
 * Disconnect TikTok API - remove stored tokens
 */
export const disconnectTikTokAPI = () => {
    if (fs.existsSync(TOKENS_PATH)) {
        fs.unlinkSync(TOKENS_PATH);
        console.log('   🔓 TikTok tokens removed');
        return { success: true, message: 'TikTok disconnected successfully' };
    }
    return { success: true, message: 'No TikTok tokens to remove' };
};

export default {
    getAuthUrl,
    startOAuthServer,
    uploadToTikTokAPI,
    checkTikTokAPIStatus,
    refreshAccessToken,
    getCreatorInfo,
    disconnectTikTokAPI
};
