import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';

const TOKENS_PATH = '/app/data/youtube_tokens.json';
const CREDENTIALS_PATH = '/app/data/youtube_credentials.json';

/**
 * YouTube API Uploader
 * Uses official YouTube Data API v3 for reliable uploads
 * Quota: ~6 videos/day (10,000 units, ~1,600 per upload)
 */

/**
 * Get OAuth2 client with credentials
 */
const getOAuth2Client = () => {
    // Try environment variables first
    let clientId = process.env.YOUTUBE_CLIENT_ID;
    let clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    // Fall back to credentials file
    if ((!clientId || !clientSecret) && fs.existsSync(CREDENTIALS_PATH)) {
        const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        clientId = creds.client_id || creds.installed?.client_id || creds.web?.client_id;
        clientSecret = creds.client_secret || creds.installed?.client_secret || creds.web?.client_secret;
    }

    if (!clientId || !clientSecret) {
        throw new Error('YouTube API credentials not found. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars or place credentials in /app/data/youtube_credentials.json');
    }

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost:8085/oauth2callback'
    );

    return oauth2Client;
};

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
    console.log('   💾 YouTube API tokens saved');
};

/**
 * Interactive OAuth flow - opens browser for authorization
 * Returns authorization URL for user to visit
 */
export const getAuthUrl = () => {
    const oauth2Client = getOAuth2Client();

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube'
        ],
        prompt: 'consent' // Force to get refresh token
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

                    if (code) {
                        const oauth2Client = getOAuth2Client();
                        const { tokens } = await oauth2Client.getToken(code);
                        saveTokens(tokens);

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
                        resolve({ success: true, tokens });
                    } else {
                        res.writeHead(400);
                        res.end('No authorization code received');
                        server.close();
                        reject(new Error('No authorization code'));
                    }
                }
            } catch (error) {
                res.writeHead(500);
                res.end('Error processing authorization');
                server.close();
                reject(error);
            }
        });

        server.listen(8085, () => {
            console.log('   OAuth callback server listening on port 8085');
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            server.close();
            reject(new Error('OAuth timeout - no response received'));
        }, 300000);
    });
};

/**
 * Exchange authorization code for tokens (manual flow)
 */
export const exchangeCode = async (code) => {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    saveTokens(tokens);
    return { success: true, message: 'Tokens saved successfully' };
};

/**
 * Get authenticated YouTube client
 */
const getYouTubeClient = async () => {
    const oauth2Client = getOAuth2Client();
    const tokens = loadTokens();

    if (!tokens) {
        throw new Error('No YouTube tokens found. Run authorization first via /youtube-api/auth');
    }

    oauth2Client.setCredentials(tokens);

    // Auto-refresh token if expired
    oauth2Client.on('tokens', (newTokens) => {
        const updatedTokens = { ...tokens, ...newTokens };
        saveTokens(updatedTokens);
        console.log('   🔄 YouTube tokens refreshed');
    });

    return google.youtube({ version: 'v3', auth: oauth2Client });
};

/**
 * Upload video to YouTube using official API
 */
export const uploadToYouTubeAPI = async (videoPath, { title, description, hashtags = [], tags = [], categoryId = '22' }) => {
    console.log('📤 Uploading to YouTube via API...');

    if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
    }

    try {
        const youtube = await getYouTubeClient();

        // Prepare metadata
        const videoTitle = title.slice(0, 100); // YouTube title limit
        const fullDescription = `${description}\n\n${hashtags.join(' ')}`.slice(0, 5000);

        // Combine hashtags and tags
        const videoTags = [
            ...tags,
            ...hashtags.map(h => h.replace('#', '')),
            'Shorts'
        ].slice(0, 500); // Tag limit

        console.log(`   📋 Title: ${videoTitle}`);
        console.log(`   #️⃣ Tags: ${videoTags.slice(0, 5).join(', ')}...`);

        // Upload video
        const res = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title: videoTitle,
                    description: fullDescription,
                    tags: videoTags,
                    categoryId: categoryId, // 22 = People & Blogs, 27 = Education, 28 = Science & Tech
                    defaultLanguage: 'en',
                    defaultAudioLanguage: 'en'
                },
                status: {
                    privacyStatus: 'public', // 'public', 'private', or 'unlisted'
                    selfDeclaredMadeForKids: false,
                    madeForKids: false
                }
            },
            media: {
                body: fs.createReadStream(videoPath)
            }
        }, {
            // Upload progress callback
            onUploadProgress: (evt) => {
                const progress = Math.round((evt.bytesRead / fs.statSync(videoPath).size) * 100);
                if (progress % 20 === 0) {
                    console.log(`   ⬆️ Upload progress: ${progress}%`);
                }
            }
        });

        const videoId = res.data.id;
        const videoUrl = `https://youtube.com/shorts/${videoId}`;

        console.log(`   ✅ Video uploaded successfully!`);
        console.log(`   🔗 URL: ${videoUrl}`);

        return {
            success: true,
            platform: 'youtube',
            videoId: videoId,
            videoUrl: videoUrl,
            message: 'Video uploaded to YouTube via API'
        };

    } catch (error) {
        console.error('   ❌ YouTube API upload failed:', error.message);

        // Handle specific errors
        if (error.message.includes('quota')) {
            return {
                success: false,
                platform: 'youtube',
                error: 'YouTube API quota exceeded. Try again tomorrow or use browser automation.',
                quotaExceeded: true
            };
        }

        if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired')) {
            return {
                success: false,
                platform: 'youtube',
                error: 'YouTube tokens expired. Re-authorize via /youtube-api/auth',
                tokenExpired: true
            };
        }

        return {
            success: false,
            platform: 'youtube',
            error: error.message
        };
    }
};

/**
 * Check if YouTube API is authorized and tokens are valid
 */
export const checkYouTubeAPIStatus = async () => {
    try {
        const tokens = loadTokens();

        if (!tokens) {
            return {
                authorized: false,
                message: 'Not authorized. Visit /youtube-api/auth to authorize.'
            };
        }

        // Try to get channel info to verify tokens work
        const youtube = await getYouTubeClient();
        const res = await youtube.channels.list({
            part: ['snippet'],
            mine: true
        });

        if (res.data.items && res.data.items.length > 0) {
            const channel = res.data.items[0];
            return {
                authorized: true,
                channel: {
                    id: channel.id,
                    title: channel.snippet.title,
                    thumbnail: channel.snippet.thumbnails?.default?.url
                },
                message: `Authorized as: ${channel.snippet.title}`
            };
        }

        return {
            authorized: false,
            message: 'Could not verify channel access'
        };

    } catch (error) {
        return {
            authorized: false,
            message: error.message,
            tokenExpired: error.message.includes('invalid_grant')
        };
    }
};

/**
 * Get remaining quota estimate (rough calculation)
 */
export const getQuotaStatus = () => {
    // YouTube API quota resets at midnight Pacific Time
    // Each upload costs ~1600 units, daily limit is 10,000
    // This is a rough estimate - actual usage tracking would require storing upload counts

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

export default {
    getAuthUrl,
    startOAuthServer,
    exchangeCode,
    uploadToYouTubeAPI,
    checkYouTubeAPIStatus,
    getQuotaStatus
};
