import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const TOKENS_PATH = '/app/data/youtube_tokens.json';
const ANALYTICS_PATH = '/app/data/analytics_history.json';

/**
 * YouTube Analytics Fetcher (Lightweight Version)
 * Fetches video performance data for analysis
 */

/**
 * Load saved OAuth tokens
 */
const loadTokens = () => {
    if (fs.existsSync(TOKENS_PATH)) {
        return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    }
    return null;
};

/**
 * Get authenticated YouTube client
 */
const getYouTubeClient = () => {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('YouTube API credentials not configured');
    }

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost:8085/oauth2callback'
    );

    const tokens = loadTokens();
    if (!tokens) {
        throw new Error('No YouTube tokens found. Authorize first via /youtube-api/auth');
    }

    oauth2Client.setCredentials(tokens);
    return google.youtube({ version: 'v3', auth: oauth2Client });
};

/**
 * Get YouTube Analytics client
 */
const getAnalyticsClient = () => {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost:8085/oauth2callback'
    );

    const tokens = loadTokens();
    if (!tokens) {
        throw new Error('No YouTube tokens found');
    }

    oauth2Client.setCredentials(tokens);
    return google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });
};

/**
 * Fetch all uploaded videos from channel
 */
export const getChannelVideos = async (maxResults = 50) => {
    const youtube = getYouTubeClient();

    // Get channel's uploads playlist
    const channelResponse = await youtube.channels.list({
        part: ['contentDetails'],
        mine: true
    });

    const uploadsPlaylistId = channelResponse.data.items[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
        throw new Error('Could not find uploads playlist');
    }

    // Get videos from uploads playlist
    const videosResponse = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults: maxResults
    });

    return videosResponse.data.items.map(item => ({
        videoId: item.contentDetails.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.medium?.url
    }));
};

/**
 * Fetch stats for specific videos
 */
export const getVideoStats = async (videoIds) => {
    const youtube = getYouTubeClient();

    const response = await youtube.videos.list({
        part: ['statistics', 'snippet', 'contentDetails'],
        id: videoIds.join(',')
    });

    return response.data.items.map(video => ({
        videoId: video.id,
        title: video.snippet.title,
        publishedAt: video.snippet.publishedAt,
        duration: video.contentDetails.duration,
        stats: {
            views: parseInt(video.statistics.viewCount || 0),
            likes: parseInt(video.statistics.likeCount || 0),
            comments: parseInt(video.statistics.commentCount || 0)
        }
    }));
};

/**
 * Fetch detailed analytics for videos (requires YouTube Analytics API)
 * Note: Analytics data has 2-3 day delay
 */
export const getVideoAnalytics = async (videoId, startDate, endDate) => {
    try {
        const analytics = getAnalyticsClient();

        const response = await analytics.reports.query({
            ids: 'channel==MINE',
            startDate: startDate,
            endDate: endDate,
            metrics: 'views,averageViewDuration,averageViewPercentage,subscribersGained',
            dimensions: 'video',
            filters: `video==${videoId}`
        });

        if (response.data.rows && response.data.rows.length > 0) {
            const row = response.data.rows[0];
            return {
                videoId: row[0],
                views: row[1],
                avgViewDuration: row[2], // in seconds
                avgViewPercentage: row[3], // 0-100
                subscribersGained: row[4]
            };
        }
        return null;
    } catch (error) {
        console.log(`   ⚠️ Analytics not available for ${videoId}: ${error.message}`);
        return null;
    }
};

/**
 * Fetch all channel videos with their stats
 */
export const fetchAllVideoStats = async () => {
    console.log('📊 Fetching channel video stats...');

    try {
        // Get list of videos
        const videos = await getChannelVideos(50);
        console.log(`   Found ${videos.length} videos`);

        if (videos.length === 0) {
            return { videos: [], summary: null };
        }

        // Get stats for all videos
        const videoIds = videos.map(v => v.videoId);
        const stats = await getVideoStats(videoIds);

        // Merge video info with stats
        const videosWithStats = stats.map(stat => {
            const video = videos.find(v => v.videoId === stat.videoId);
            return {
                ...stat,
                thumbnail: video?.thumbnail,
                daysSincePublished: Math.floor(
                    (Date.now() - new Date(stat.publishedAt).getTime()) / (1000 * 60 * 60 * 24)
                )
            };
        });

        // Sort by views (descending)
        videosWithStats.sort((a, b) => b.stats.views - a.stats.views);

        // Calculate summary
        const summary = {
            totalVideos: videosWithStats.length,
            totalViews: videosWithStats.reduce((sum, v) => sum + v.stats.views, 0),
            totalLikes: videosWithStats.reduce((sum, v) => sum + v.stats.likes, 0),
            avgViewsPerVideo: Math.round(
                videosWithStats.reduce((sum, v) => sum + v.stats.views, 0) / videosWithStats.length
            ),
            topPerformer: videosWithStats[0],
            worstPerformer: videosWithStats[videosWithStats.length - 1],
            fetchedAt: new Date().toISOString()
        };

        console.log(`   ✅ Total views: ${summary.totalViews}`);
        console.log(`   ✅ Avg views/video: ${summary.avgViewsPerVideo}`);

        return { videos: videosWithStats, summary };

    } catch (error) {
        console.error('❌ Failed to fetch video stats:', error.message);
        throw error;
    }
};

/**
 * Load analytics history
 */
export const loadAnalyticsHistory = () => {
    if (fs.existsSync(ANALYTICS_PATH)) {
        return JSON.parse(fs.readFileSync(ANALYTICS_PATH, 'utf8'));
    }
    return { snapshots: [], analyses: [] };
};

/**
 * Save analytics snapshot
 */
export const saveAnalyticsSnapshot = (data) => {
    const history = loadAnalyticsHistory();

    history.snapshots.push({
        date: new Date().toISOString(),
        ...data
    });

    // Keep only last 12 snapshots (3 months of weekly data)
    if (history.snapshots.length > 12) {
        history.snapshots = history.snapshots.slice(-12);
    }

    const dir = path.dirname(ANALYTICS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(ANALYTICS_PATH, JSON.stringify(history, null, 2));
    console.log('   💾 Analytics snapshot saved');

    return history;
};

/**
 * Save Gemini analysis
 */
export const saveAnalysis = (analysis) => {
    const history = loadAnalyticsHistory();

    history.analyses.push({
        date: new Date().toISOString(),
        ...analysis
    });

    // Keep only last 12 analyses
    if (history.analyses.length > 12) {
        history.analyses = history.analyses.slice(-12);
    }

    fs.writeFileSync(ANALYTICS_PATH, JSON.stringify(history, null, 2));
    console.log('   💾 Analysis saved');
};

/**
 * Get week-over-week comparison
 */
export const getWeekOverWeekComparison = () => {
    const history = loadAnalyticsHistory();

    if (history.snapshots.length < 2) {
        return null;
    }

    const current = history.snapshots[history.snapshots.length - 1];
    const previous = history.snapshots[history.snapshots.length - 2];

    return {
        current: current.summary,
        previous: previous.summary,
        changes: {
            totalViews: current.summary.totalViews - previous.summary.totalViews,
            totalVideos: current.summary.totalVideos - previous.summary.totalVideos,
            avgViewsPerVideo: current.summary.avgViewsPerVideo - previous.summary.avgViewsPerVideo
        }
    };
};

export default {
    getChannelVideos,
    getVideoStats,
    getVideoAnalytics,
    fetchAllVideoStats,
    loadAnalyticsHistory,
    saveAnalyticsSnapshot,
    saveAnalysis,
    getWeekOverWeekComparison
};
