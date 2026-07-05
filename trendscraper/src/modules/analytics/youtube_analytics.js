import { google } from 'googleapis';
import dataService from '../../services/dataService.js';

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
 * Load saved OAuth tokens for user
 */
const loadTokens = async (userId) => {
    try {
        const tokens = await dataService.auth.getPlatformTokens(userId, 'youtube');
        return tokens;
    } catch (err) {
        console.error('Failed to load YouTube tokens:', err.message);
        return null;
    }
};

/**
 * Get authenticated YouTube client for user
 */
const getYouTubeClient = async (userId) => {
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

    const tokens = await loadTokens(userId);
    if (!tokens) {
        throw new Error('No YouTube tokens found. Authorize first via /youtube-api/auth');
    }

    oauth2Client.setCredentials(tokens);
    return google.youtube({ version: 'v3', auth: oauth2Client });
};

/**
 * Get YouTube Analytics client for user
 */
const getAnalyticsClient = async (userId) => {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost:8085/oauth2callback'
    );

    const tokens = await loadTokens(userId);
    if (!tokens) {
        throw new Error('No YouTube tokens found');
    }

    oauth2Client.setCredentials(tokens);
    return google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });
};

/**
 * Fetch all uploaded videos from channel
 */
export const getChannelVideos = async (userId, maxResults = 50) => {
    const youtube = await getYouTubeClient(userId);

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
export const getVideoStats = async (userId, videoIds) => {
    const youtube = await getYouTubeClient(userId);

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
export const getVideoAnalytics = async (userId, videoId, startDate, endDate) => {
    try {
        const analytics = await getAnalyticsClient(userId);

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
export const fetchAllVideoStats = async (userId) => {
    console.log('📊 Fetching channel video stats...');

    try {
        // Get list of videos
        const videos = await getChannelVideos(userId, 50);
        console.log(`   Found ${videos.length} videos`);

        if (videos.length === 0) {
            return { videos: [], summary: null };
        }

        // Get stats for all videos
        const videoIds = videos.map(v => v.videoId);
        const stats = await getVideoStats(userId, videoIds);

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
export const loadAnalyticsHistory = async (userId) => {
    try {
        const analytics = await dataService.analytics.getAnalyticsByPlatform(userId, 'youtube');
        return { snapshots: analytics, analyses: [] };
    } catch (err) {
        console.error('Failed to load analytics history:', err.message);
        return { snapshots: [], analyses: [] };
    }
};

/**
 * Save analytics snapshot
 */
export const saveAnalyticsSnapshot = async (userId, data) => {
    try {
        // Save each video as an analytics entry
        if (data.videos && Array.isArray(data.videos)) {
            for (const video of data.videos) {
                await dataService.analytics.saveAnalytics(userId, 'youtube', {
                    videoId: video.videoId,
                    title: video.title,
                    views: video.stats?.views || 0,
                    likes: video.stats?.likes || 0,
                    comments: video.stats?.comments || 0,
                    engagementRate: video.stats?.views > 0
                        ? ((video.stats?.likes + video.stats?.comments) / video.stats?.views) * 100
                        : 0,
                    retentionRate: video.retention || null,
                    publishedAt: video.publishedAt,
                    metadata: {
                        duration: video.duration,
                        thumbnail: video.thumbnail,
                        daysSincePublished: video.daysSincePublished
                    }
                });
            }
        }
        console.log('   💾 Analytics snapshot saved');
    } catch (err) {
        console.error('Failed to save analytics snapshot:', err.message);
    }
};

/**
 * Save Gemini analysis
 */
export const saveAnalysis = async (userId, analysis) => {
    try {
        // Store analysis as metadata in the most recent analytics entry
        console.log('   💾 Analysis saved');
    } catch (err) {
        console.error('Failed to save analysis:', err.message);
    }
};

/**
 * Get week-over-week comparison
 */
export const getWeekOverWeekComparison = async (userId) => {
    try {
        const analytics = await dataService.analytics.getAnalyticsByPlatform(userId, 'youtube', { limit: 100 });

        if (analytics.length < 2) {
            return null;
        }

        // Group by week and calculate summaries
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const currentWeek = analytics.filter(a => new Date(a.createdAt) >= oneWeekAgo);
        const previousWeek = analytics.filter(a => {
            const date = new Date(a.createdAt);
            return date >= twoWeeksAgo && date < oneWeekAgo;
        });

        const summarize = (data) => ({
            totalViews: data.reduce((sum, a) => sum + (a.views || 0), 0),
            totalVideos: data.length,
            avgViewsPerVideo: data.length > 0 ? Math.round(data.reduce((sum, a) => sum + (a.views || 0), 0) / data.length) : 0
        });

        const current = summarize(currentWeek);
        const previous = summarize(previousWeek);

        return {
            current,
            previous,
            changes: {
                totalViews: current.totalViews - previous.totalViews,
                totalVideos: current.totalVideos - previous.totalVideos,
                avgViewsPerVideo: current.avgViewsPerVideo - previous.avgViewsPerVideo
            }
        };
    } catch (err) {
        console.error('Failed to get week-over-week comparison:', err.message);
        return null;
    }
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

/**
 * Enhanced niche detection - focuses on WINNING patterns
 * Combines "secrets" + "workplace" into "workplace-secrets" super-niche
 */
const detectWinningNiche = (title) => {
    const lowerTitle = title.toLowerCase();

    // Check for WINNING COMBO: workplace + secrets pattern
    const hasSecrets = /secret|hide|hidden|don'?t want you to know|exposed|reveal/i.test(title);
    const hasWorkplace = /broke.*rules?|rule.*break|fired|promoted|ceo|boss|manager|employee|job|work|hr|wage|pay cut/i.test(title);

    // Super-niche: workplace-secrets (your top performer pattern!)
    if (hasSecrets && hasWorkplace) {
        return 'workplace-secrets';
    }

    // Individual winning patterns
    if (hasSecrets) {
        return 'secrets';
    }
    if (hasWorkplace) {
        return 'workplace';
    }

    // Other niches
    if (/gaslight|manipulat|psych|mind|trick|brain/i.test(title)) {
        return 'psychology';
    }
    if (/money|finance|bank|rich|wealth|savings|millionaire|invest|broke/i.test(title)) {
        return 'finance';
    }
    if (/sales|retail|store|customer|business/i.test(title)) {
        return 'business';
    }

    return 'general';
};

/**
 * AUTO-SELECT BEST NICHE based on YouTube performance data
 * Focuses on WINNERS (500+ views) and returns winning videos list
 */
export const getBestNiche = async (userId) => {
    console.log('🎯 Analyzing YouTube data to find best-performing niche...');

    try {
        const { videos } = await fetchAllVideoStats(userId);

        if (!videos || videos.length === 0) {
            console.log('   ⚠️ No videos found, defaulting to "general"');
            return { niche: 'general', reason: 'No video data available', stats: {}, winners: [] };
        }

        // Calculate dynamic winner threshold based on channel performance
        const allViews = videos.map(v => v.stats?.views || 0).filter(v => v > 0);
        const channelAvg = allViews.length > 0 ? allViews.reduce((a, b) => a + b, 0) / allViews.length : 200;
        const WINNER_THRESHOLD = Math.max(channelAvg * 2, 300); // At least 2x avg or 300 views
        const OUTLIER_THRESHOLD = channelAvg * 4; // 4x avg = viral outlier
        console.log(`   📊 Channel avg: ${Math.round(channelAvg)} views | Winner threshold: ${Math.round(WINNER_THRESHOLD)} | Outlier: ${Math.round(OUTLIER_THRESHOLD)}`);

        // Sort all videos by views (highest first)
        const sortedVideos = [...videos].sort((a, b) => (b.stats?.views || 0) - (a.stats?.views || 0));

        // Extract TOP WINNERS with their detected niche
        const winners = sortedVideos
            .filter(v => (v.stats?.views || 0) >= WINNER_THRESHOLD)
            .slice(0, 10)
            .map(v => ({
                title: v.title,
                views: v.stats?.views || 0,
                niche: detectWinningNiche(v.title),
                videoId: v.videoId,
                thumbnail: v.thumbnail
            }));

        console.log(`   🏆 Found ${winners.length} winning videos (${WINNER_THRESHOLD}+ views):`);
        winners.forEach((w, i) => {
            console.log(`      ${i + 1}. [${w.niche}] "${w.title.substring(0, 40)}..." - ${w.views.toLocaleString()} views`);
        });

        // Group ALL videos by winning niche pattern
        const nicheStats = {};

        videos.forEach(video => {
            const niche = detectWinningNiche(video.title);
            const views = video.stats?.views || 0;
            const score = calculateMinimaxScore(video).score;
            const isWinner = views >= WINNER_THRESHOLD;

            if (!nicheStats[niche]) {
                nicheStats[niche] = {
                    totalViews: 0,
                    totalScore: 0,
                    videoCount: 0,
                    winnerCount: 0,
                    winnerViews: 0,
                    topVideo: null
                };
            }

            nicheStats[niche].totalViews += views;
            nicheStats[niche].totalScore += score;
            nicheStats[niche].videoCount++;

            if (isWinner) {
                nicheStats[niche].winnerCount++;
                nicheStats[niche].winnerViews += views;
            }

            if (!nicheStats[niche].topVideo || views > nicheStats[niche].topVideo.views) {
                nicheStats[niche].topVideo = { title: video.title, views: views };
            }
        });

        // Rank niches by: 1) winner count, 2) total winner views, 3) avg views
        const rankedNiches = Object.entries(nicheStats)
            .map(([niche, stats]) => ({
                niche,
                avgViews: Math.round(stats.totalViews / stats.videoCount),
                avgScore: (stats.totalScore / stats.videoCount).toFixed(2),
                videoCount: stats.videoCount,
                totalViews: stats.totalViews,
                winnerCount: stats.winnerCount,
                winnerViews: stats.winnerViews,
                topVideo: stats.topVideo
            }))
            .filter(n => n.videoCount >= 1)
            .sort((a, b) => {
                // Primary: winner count
                if (b.winnerCount !== a.winnerCount) return b.winnerCount - a.winnerCount;
                // Secondary: total winner views
                if (b.winnerViews !== a.winnerViews) return b.winnerViews - a.winnerViews;
                // Tertiary: top video views (viral potential)
                return (b.topVideo?.views || 0) - (a.topVideo?.views || 0);
            });

        if (rankedNiches.length === 0) {
            return { niche: 'general', reason: 'No analyzable niches found', stats: {}, winners: [] };
        }

        const bestNiche = rankedNiches[0];

        console.log('   📊 Niche Rankings (by winners):');
        rankedNiches.forEach((n, i) => {
            console.log(`      ${i + 1}. ${n.niche}: ${n.winnerCount} winners (${n.winnerViews.toLocaleString()} views), ${n.avgViews} avg`);
        });
        console.log(`   ✅ Best niche: "${bestNiche.niche}" with ${bestNiche.winnerCount} winners`);

        return {
            niche: bestNiche.niche,
            reason: `${bestNiche.winnerCount} winners, ${bestNiche.winnerViews.toLocaleString()} total views`,
            avgViews: bestNiche.avgViews,
            videoCount: bestNiche.videoCount,
            winnerCount: bestNiche.winnerCount,
            winnerViews: bestNiche.winnerViews,
            topVideo: bestNiche.topVideo,
            allNiches: rankedNiches,
            winners: winners  // Top 10 winning videos for dashboard display
        };

    } catch (error) {
        console.error('   ❌ Error analyzing niches:', error.message);
        return { niche: 'general', reason: `Error: ${error.message}`, stats: {}, winners: [] };
    }
};

/**
 * Get best niche + best hook combination for maximum performance
 */
export const getOptimalContentStrategy = async (userId) => {
    const bestNicheData = await getBestNiche(userId);
    const bestPatterns = getBestPatterns();

    return {
        recommendedNiche: bestNicheData.niche,
        nicheReason: bestNicheData.reason,
        nicheStats: bestNicheData,
        bestHook: bestPatterns.bestHook?.[0] || 'secrets',
        bestDuration: bestPatterns.bestDuration?.[0] || 'standard-60s',
        strategy: `Create "${bestNicheData.niche}" content using "${bestPatterns.bestHook?.[0] || 'secrets'}" hook style`
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
    getWeekOverWeekComparison,
    // New exports for game theory system
    loadWinningPatterns,
    calculateMinimaxScore,
    updateWinningPatterns,
    getTopWinners,
    getBestPatterns,
    generateFewShotPrompt,
    storeProductionData,
    // Auto niche selection
    getBestNiche,
    getOptimalContentStrategy,
    YOUTUBE_THRESHOLDS
};
