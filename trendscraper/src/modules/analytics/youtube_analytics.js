import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const TOKENS_PATH = '/app/data/youtube_tokens.json';
const ANALYTICS_PATH = '/app/data/analytics_history.json';
const WINNERS_PATH = '/app/data/winning_patterns.json';

/**
 * YouTube Analytics - MINIMAX Strategy
 *
 * Game Theory: Minimize early drop-off, Maximize completion rate
 * Key Metrics: Watch time, retention %, completion rate
 *
 * YouTube's algorithm rewards:
 * - High average view duration
 * - High completion rate (% of video watched)
 * - Session time (do viewers stay on YouTube after your video?)
 *
 * Our strategy:
 * - Track retention patterns per video type
 * - Identify which hooks keep viewers past 3 seconds
 * - Find optimal video length for completion rate
 * - Store production variables (voice, visuals, style) with performance
 */

// Performance thresholds for YouTube Shorts
const YOUTUBE_THRESHOLDS = {
    VIRAL: 1000,        // Views
    GOOD: 500,
    AVERAGE: 200,
    POOR: 100,
    RETENTION_TARGET: 70  // % watched target
};

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

// ============================================================
// WINNING PATTERNS STORAGE (Few-Shot Learning System)
// ============================================================

/**
 * Load winning patterns data
 */
export const loadWinningPatterns = () => {
    if (fs.existsSync(WINNERS_PATH)) {
        return JSON.parse(fs.readFileSync(WINNERS_PATH, 'utf8'));
    }
    return {
        platform: 'youtube',
        strategy: 'minimax',
        winners: [],
        patterns: {
            hooks: {},
            niches: {},
            durations: {},
            voices: {},
            visualStyles: {},
            postingTimes: {}
        },
        lastUpdated: null
    };
};

/**
 * Save winning patterns data
 */
const saveWinningPatterns = (data) => {
    data.lastUpdated = new Date().toISOString();
    const dir = path.dirname(WINNERS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(WINNERS_PATH, JSON.stringify(data, null, 2));
};

/**
 * Extract content patterns from video title/data
 */
const extractPatterns = (video) => {
    const title = video.title || '';
    const patterns = {
        hookStyle: 'general',
        niche: 'general',
        duration: 'unknown',
        titlePatterns: []
    };

    // Hook style detection
    if (/broke.*rules?|rule.*break/i.test(title)) patterns.hookStyle = 'rule-breaking';
    else if (/secret|hide|hidden/i.test(title)) patterns.hookStyle = 'secrets';
    else if (/don'?t want you to know/i.test(title)) patterns.hookStyle = 'insider';
    else if (/shocking|insane|crazy/i.test(title)) patterns.hookStyle = 'shock';
    else if (/trick|hack|tip/i.test(title)) patterns.hookStyle = 'tips';
    else if (/\d+%/i.test(title)) patterns.hookStyle = 'statistic';
    else if (/truth|real/i.test(title)) patterns.hookStyle = 'truth-reveal';

    // Niche detection
    if (/money|finance|bank|rich|broke|wealth|savings/i.test(title)) patterns.niche = 'finance';
    else if (/psychology|psych|gaslighting|manipulation/i.test(title)) patterns.niche = 'psychology';
    else if (/sales|retail|store|customer/i.test(title)) patterns.niche = 'business';
    else if (/job|work|career|boss|employee|promote/i.test(title)) patterns.niche = 'career';

    // Duration category (parse ISO 8601)
    if (video.duration) {
        const match = video.duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
        if (match) {
            const totalSeconds = (parseInt(match[1] || 0) * 60) + parseInt(match[2] || 0);
            if (totalSeconds <= 30) patterns.duration = 'short-30s';
            else if (totalSeconds <= 45) patterns.duration = 'medium-45s';
            else if (totalSeconds <= 60) patterns.duration = 'standard-60s';
            else if (totalSeconds <= 90) patterns.duration = 'long-90s';
            else patterns.duration = 'extra-long';
        }
    }

    // Title patterns
    if (/[\u{1F600}-\u{1F9FF}]/u.test(title)) patterns.titlePatterns.push('has-emoji');
    if (/\b[A-Z]{2,}\b/.test(title)) patterns.titlePatterns.push('has-caps');
    if (/\d/.test(title)) patterns.titlePatterns.push('has-numbers');
    if (/!/.test(title)) patterns.titlePatterns.push('has-exclamation');
    if (/\?/.test(title)) patterns.titlePatterns.push('has-question');

    return patterns;
};

/**
 * Calculate MINIMAX score for a video
 * Minimize: Early drop-off (low retention)
 * Maximize: Completion rate, engagement
 */
export const calculateMinimaxScore = (video) => {
    const views = video.stats?.views || 0;
    const likes = video.stats?.likes || 0;
    const comments = video.stats?.comments || 0;
    const daysSincePublished = video.daysSincePublished || 1;
    const retention = video.retention || null; // From YouTube Analytics API

    // Base score from views
    let score = 0;
    if (views >= YOUTUBE_THRESHOLDS.VIRAL) score = 2;
    else if (views >= YOUTUBE_THRESHOLDS.GOOD) score = 1;
    else if (views >= YOUTUBE_THRESHOLDS.AVERAGE) score = 0;
    else if (views >= YOUTUBE_THRESHOLDS.POOR) score = -1;
    else score = -2;

    // Engagement bonus (likes + comments relative to views)
    const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
    if (engagementRate >= 5) score += 0.5;
    else if (engagementRate >= 3) score += 0.25;
    else if (engagementRate < 1) score -= 0.25;

    // Retention bonus (if available)
    if (retention !== null) {
        if (retention >= 80) score += 0.5;
        else if (retention >= YOUTUBE_THRESHOLDS.RETENTION_TARGET) score += 0.25;
        else if (retention < 40) score -= 0.5;
    }

    // Velocity bonus for new content
    if (daysSincePublished <= 3) {
        const viewsPerDay = views / Math.max(daysSincePublished, 1);
        if (viewsPerDay >= 200) score += 0.5;
        else if (viewsPerDay >= 100) score += 0.25;
        else if (viewsPerDay < 20) score -= 0.25;
    }

    return {
        score: Math.max(-2, Math.min(2, score)),
        label: score >= 1.5 ? 'VIRAL' : score >= 0.5 ? 'GOOD' : score >= -0.5 ? 'AVERAGE' : score >= -1.5 ? 'POOR' : 'FLOP',
        metrics: { views, likes, comments, engagementRate: engagementRate.toFixed(2), retention, daysSincePublished }
    };
};

/**
 * Update winning patterns from video performance data
 */
export const updateWinningPatterns = (videos, productionData = {}) => {
    const data = loadWinningPatterns();
    let newWinners = 0;

    videos.forEach(video => {
        const views = video.stats?.views || 0;
        const scoreData = calculateMinimaxScore(video);
        const patterns = extractPatterns(video);

        // Check if this is a winner (views >= threshold)
        if (views >= YOUTUBE_THRESHOLDS.AVERAGE) {
            const existingWinner = data.winners.find(w => w.videoId === video.videoId);

            if (!existingWinner) {
                // New winner!
                data.winners.push({
                    videoId: video.videoId,
                    title: video.title,
                    views: views,
                    likes: video.stats?.likes || 0,
                    score: scoreData.score,
                    scoreLabel: scoreData.label,
                    patterns: patterns,
                    production: productionData[video.videoId] || null,
                    publishedAt: video.publishedAt,
                    addedAt: new Date().toISOString()
                });
                newWinners++;
                console.log(`   🏆 YouTube winner: "${video.title}" (${views} views, score: ${scoreData.score})`);
            } else {
                // Update existing winner
                existingWinner.views = views;
                existingWinner.likes = video.stats?.likes || 0;
                existingWinner.score = scoreData.score;
                existingWinner.scoreLabel = scoreData.label;
                existingWinner.updatedAt = new Date().toISOString();
            }
        }

        // Update pattern statistics
        const updatePatternStats = (category, key, score) => {
            if (!data.patterns[category][key]) {
                data.patterns[category][key] = { totalScore: 0, count: 0, wins: 0, avgScore: 0 };
            }
            data.patterns[category][key].totalScore += score;
            data.patterns[category][key].count += 1;
            if (score > 0) data.patterns[category][key].wins += 1;
            data.patterns[category][key].avgScore =
                data.patterns[category][key].totalScore / data.patterns[category][key].count;
        };

        updatePatternStats('hooks', patterns.hookStyle, scoreData.score);
        updatePatternStats('niches', patterns.niche, scoreData.score);
        updatePatternStats('durations', patterns.duration, scoreData.score);

        // Track posting time
        if (video.publishedAt) {
            const hour = new Date(video.publishedAt).getUTCHours();
            const timeSlot = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
            updatePatternStats('postingTimes', timeSlot, scoreData.score);
        }
    });

    // Sort winners by score and keep top 20
    data.winners.sort((a, b) => b.score - a.score);
    data.winners = data.winners.slice(0, 20);

    saveWinningPatterns(data);

    if (newWinners > 0) {
        console.log(`   📊 YouTube: ${newWinners} new winner(s) added`);
    }

    return data;
};

/**
 * Get top N winners for few-shot examples
 */
export const getTopWinners = (count = 3) => {
    const data = loadWinningPatterns();
    return data.winners.slice(0, count);
};

/**
 * Get best performing patterns (for content generation)
 */
export const getBestPatterns = () => {
    const data = loadWinningPatterns();

    const getBestInCategory = (category) => {
        const items = Object.entries(data.patterns[category] || {});
        if (items.length === 0) return null;
        items.sort((a, b) => b[1].avgScore - a[1].avgScore);
        return items[0];
    };

    return {
        bestHook: getBestInCategory('hooks'),
        bestNiche: getBestInCategory('niches'),
        bestDuration: getBestInCategory('durations'),
        bestPostingTime: getBestInCategory('postingTimes'),
        bestVoice: getBestInCategory('voices'),
        bestVisualStyle: getBestInCategory('visualStyles')
    };
};

/**
 * Generate few-shot prompt from YouTube winners
 */
export const generateFewShotPrompt = () => {
    const winners = getTopWinners(3);
    const bestPatterns = getBestPatterns();

    if (winners.length === 0) {
        return '';
    }

    let prompt = `
--- YOUTUBE WINNERS (MINIMAX Strategy: High retention + completion) ---
Learn from these top-performing YouTube Shorts:

`;

    winners.forEach((w, i) => {
        prompt += `WINNER #${i + 1} (${w.views} views, score: ${w.score}):
Title: "${w.title}"
Hook Style: ${w.patterns?.hookStyle || 'unknown'}
Niche: ${w.patterns?.niche || 'general'}
${w.production?.voiceId ? `Voice: ${w.production.voiceId}` : ''}
---
`;
    });

    if (bestPatterns.bestHook) {
        prompt += `\nBEST HOOK STYLE: ${bestPatterns.bestHook[0]} (avg score: ${bestPatterns.bestHook[1].avgScore.toFixed(2)})`;
    }
    if (bestPatterns.bestNiche) {
        prompt += `\nBEST NICHE: ${bestPatterns.bestNiche[0]} (avg score: ${bestPatterns.bestNiche[1].avgScore.toFixed(2)})`;
    }
    if (bestPatterns.bestDuration) {
        prompt += `\nBEST DURATION: ${bestPatterns.bestDuration[0]} (avg score: ${bestPatterns.bestDuration[1].avgScore.toFixed(2)})`;
    }

    prompt += `

FOR YOUTUBE: Focus on strong hooks (first 3 sec) and high completion rate.
`;

    return prompt;
};

/**
 * Store production data for a video (call this when video is created)
 */
export const storeProductionData = (videoId, productionInfo) => {
    const data = loadWinningPatterns();

    // Find if video exists in winners
    const winner = data.winners.find(w => w.videoId === videoId);
    if (winner) {
        winner.production = productionInfo;
        saveWinningPatterns(data);
        console.log(`   💾 Production data stored for: ${videoId}`);
    }

    return data;
};

export default {
    getChannelVideos,
    getVideoStats,
    getVideoAnalytics,
    fetchAllVideoStats,
    loadAnalyticsHistory,
    saveAnalyticsSnapshot,
    saveAnalysis,
    getWeekOverWeekComparison,
    // New exports for game theory system
    loadWinningPatterns,
    calculateMinimaxScore,
    updateWinningPatterns,
    getTopWinners,
    getBestPatterns,
    generateFewShotPrompt,
    storeProductionData,
    YOUTUBE_THRESHOLDS
};
