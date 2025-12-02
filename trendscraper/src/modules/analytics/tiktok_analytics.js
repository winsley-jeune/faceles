import fs from 'fs';
import path from 'path';

const TOKENS_PATH = '/app/data/tiktok_tokens.json';
const WINNERS_PATH = '/app/data/tiktok_winning_patterns.json';

/**
 * TikTok Analytics - EXPECTED VALUE Strategy
 *
 * Game Theory: Maximize expected value across many attempts
 * TikTok = Viral Lottery - Most videos flop, but occasional hits go massive
 *
 * TikTok's algorithm:
 * - Tests new content with small audience (~200-500 views)
 * - If engagement is high, scales exponentially
 * - First hour performance is CRITICAL
 * - Rewards: Comments, shares, watch time, replays
 *
 * Our strategy:
 * - High volume posting (accept 80% will flop)
 * - Optimize for the 20% that can go viral
 * - Track first-hour velocity as key metric
 * - Use trending sounds/hashtags
 * - Pattern interrupts in first 1 second
 */

// Performance thresholds for TikTok
const TIKTOK_THRESHOLDS = {
    VIRAL: 10000,       // Views (TikTok viral is higher than YT)
    GOOD: 2000,
    AVERAGE: 500,
    POOR: 100,
    FIRST_HOUR_TARGET: 100  // Views in first hour to signal algorithm
};

/**
 * Load TikTok tokens
 */
const loadTokens = () => {
    if (fs.existsSync(TOKENS_PATH)) {
        return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    }
    return null;
};

/**
 * Load winning patterns data
 */
export const loadWinningPatterns = () => {
    if (fs.existsSync(WINNERS_PATH)) {
        return JSON.parse(fs.readFileSync(WINNERS_PATH, 'utf8'));
    }
    return {
        platform: 'tiktok',
        strategy: 'expected-value',
        winners: [],
        patterns: {
            hooks: {},
            niches: {},
            sounds: {},
            hashtags: {},
            durations: {},
            postingTimes: {}
        },
        viralRate: 0,  // % of videos that go viral
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
 * Extract content patterns from TikTok video
 */
const extractPatterns = (video) => {
    const caption = video.caption || video.title || '';
    const patterns = {
        hookStyle: 'general',
        niche: 'general',
        duration: 'unknown',
        hasSound: false,
        hashtags: []
    };

    // Hook style detection
    if (/pov|POV/i.test(caption)) patterns.hookStyle = 'pov';
    else if (/wait.*for.*it|wait.*till/i.test(caption)) patterns.hookStyle = 'wait-for-it';
    else if (/secret|hide|hidden/i.test(caption)) patterns.hookStyle = 'secrets';
    else if (/hack|trick|tip/i.test(caption)) patterns.hookStyle = 'tips';
    else if (/story.*time|storytime/i.test(caption)) patterns.hookStyle = 'storytime';
    else if (/part\s*\d|pt\s*\d/i.test(caption)) patterns.hookStyle = 'series';

    // Niche detection
    if (/money|finance|bank|rich|broke|wealth/i.test(caption)) patterns.niche = 'finance';
    else if (/psychology|psych|manipulation/i.test(caption)) patterns.niche = 'psychology';
    else if (/business|entrepreneur|startup/i.test(caption)) patterns.niche = 'business';
    else if (/dating|relationship|love/i.test(caption)) patterns.niche = 'relationships';
    else if (/fitness|gym|workout/i.test(caption)) patterns.niche = 'fitness';

    // Extract hashtags
    const hashtagMatches = caption.match(/#\w+/g) || [];
    patterns.hashtags = hashtagMatches.slice(0, 10);

    // Duration category
    if (video.duration) {
        const seconds = typeof video.duration === 'number' ? video.duration : parseInt(video.duration);
        if (seconds <= 15) patterns.duration = 'ultra-short-15s';
        else if (seconds <= 30) patterns.duration = 'short-30s';
        else if (seconds <= 60) patterns.duration = 'standard-60s';
        else patterns.duration = 'long-60s+';
    }

    // Sound detection
    if (video.sound || video.music) {
        patterns.hasSound = true;
        patterns.soundName = video.sound?.name || video.music?.title || 'unknown';
    }

    return patterns;
};

/**
 * Calculate EXPECTED VALUE score for a TikTok video
 * EV = (Probability of Viral) × (Viral Payoff) + (Probability of Flop) × (Flop Cost)
 */
export const calculateExpectedValueScore = (video) => {
    const views = video.views || video.stats?.views || 0;
    const likes = video.likes || video.stats?.likes || 0;
    const comments = video.comments || video.stats?.comments || 0;
    const shares = video.shares || video.stats?.shares || 0;
    const firstHourViews = video.firstHourViews || null;

    // Base score from views (TikTok scale is different)
    let score = 0;
    if (views >= TIKTOK_THRESHOLDS.VIRAL) score = 2;
    else if (views >= TIKTOK_THRESHOLDS.GOOD) score = 1;
    else if (views >= TIKTOK_THRESHOLDS.AVERAGE) score = 0;
    else if (views >= TIKTOK_THRESHOLDS.POOR) score = -1;
    else score = -2;

    // Engagement multiplier (TikTok weights shares heavily)
    const engagementRate = views > 0 ? ((likes + comments + shares * 2) / views) * 100 : 0;
    if (engagementRate >= 10) score += 0.75;  // TikTok has higher engagement
    else if (engagementRate >= 5) score += 0.5;
    else if (engagementRate >= 2) score += 0.25;
    else if (engagementRate < 1) score -= 0.25;

    // First hour velocity bonus (critical for TikTok)
    if (firstHourViews !== null) {
        if (firstHourViews >= 500) score += 0.75;
        else if (firstHourViews >= TIKTOK_THRESHOLDS.FIRST_HOUR_TARGET) score += 0.5;
        else if (firstHourViews < 20) score -= 0.5;
    }

    // Share bonus (shares = algorithm gold on TikTok)
    if (shares > 0) {
        const shareRate = (shares / views) * 100;
        if (shareRate >= 1) score += 0.5;
        else if (shareRate >= 0.5) score += 0.25;
    }

    return {
        score: Math.max(-2, Math.min(2, score)),
        label: score >= 1.5 ? 'VIRAL' : score >= 0.5 ? 'GOOD' : score >= -0.5 ? 'AVERAGE' : score >= -1.5 ? 'POOR' : 'FLOP',
        metrics: { views, likes, comments, shares, engagementRate: engagementRate.toFixed(2), firstHourViews }
    };
};

/**
 * Update winning patterns from TikTok video data
 */
export const updateWinningPatterns = (videos, productionData = {}) => {
    const data = loadWinningPatterns();
    let newWinners = 0;
    let totalVideos = videos.length;
    let viralCount = 0;

    videos.forEach(video => {
        const views = video.views || video.stats?.views || 0;
        const scoreData = calculateExpectedValueScore(video);
        const patterns = extractPatterns(video);

        if (views >= TIKTOK_THRESHOLDS.VIRAL) viralCount++;

        // Check if this is a winner
        if (views >= TIKTOK_THRESHOLDS.AVERAGE) {
            const videoId = video.id || video.videoId;
            const existingWinner = data.winners.find(w => w.videoId === videoId);

            if (!existingWinner) {
                data.winners.push({
                    videoId: videoId,
                    caption: video.caption || video.title,
                    views: views,
                    likes: video.likes || video.stats?.likes || 0,
                    shares: video.shares || video.stats?.shares || 0,
                    score: scoreData.score,
                    scoreLabel: scoreData.label,
                    patterns: patterns,
                    production: productionData[videoId] || null,
                    publishedAt: video.publishedAt || video.createTime,
                    addedAt: new Date().toISOString()
                });
                newWinners++;
                console.log(`   🏆 TikTok winner: "${(video.caption || '').slice(0, 50)}..." (${views} views, score: ${scoreData.score})`);
            } else {
                existingWinner.views = views;
                existingWinner.likes = video.likes || video.stats?.likes || 0;
                existingWinner.shares = video.shares || video.stats?.shares || 0;
                existingWinner.score = scoreData.score;
                existingWinner.scoreLabel = scoreData.label;
                existingWinner.updatedAt = new Date().toISOString();
            }
        }

        // Update pattern statistics
        const updatePatternStats = (category, key, score) => {
            if (!key || key === 'unknown') return;
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

        // Track hashtag performance
        patterns.hashtags.forEach(tag => {
            updatePatternStats('hashtags', tag, scoreData.score);
        });

        // Track sound performance
        if (patterns.soundName) {
            updatePatternStats('sounds', patterns.soundName, scoreData.score);
        }
    });

    // Calculate viral rate
    if (totalVideos > 0) {
        data.viralRate = ((viralCount / totalVideos) * 100).toFixed(2);
    }

    // Sort winners and keep top 20
    data.winners.sort((a, b) => b.score - a.score);
    data.winners = data.winners.slice(0, 20);

    saveWinningPatterns(data);

    if (newWinners > 0) {
        console.log(`   📊 TikTok: ${newWinners} new winner(s), viral rate: ${data.viralRate}%`);
    }

    return data;
};

/**
 * Get top TikTok winners
 */
export const getTopWinners = (count = 3) => {
    const data = loadWinningPatterns();
    return data.winners.slice(0, count);
};

/**
 * Get best performing patterns
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
        bestHashtags: Object.entries(data.patterns.hashtags || {})
            .sort((a, b) => b[1].avgScore - a[1].avgScore)
            .slice(0, 5)
            .map(([tag]) => tag),
        bestSounds: Object.entries(data.patterns.sounds || {})
            .sort((a, b) => b[1].avgScore - a[1].avgScore)
            .slice(0, 3)
            .map(([sound]) => sound),
        viralRate: data.viralRate
    };
};

/**
 * Generate few-shot prompt from TikTok winners
 */
export const generateFewShotPrompt = () => {
    const winners = getTopWinners(3);
    const bestPatterns = getBestPatterns();

    if (winners.length === 0) {
        return '';
    }

    let prompt = `
--- TIKTOK WINNERS (EXPECTED VALUE Strategy: Optimize for viral potential) ---
Learn from these top-performing TikToks:

`;

    winners.forEach((w, i) => {
        prompt += `WINNER #${i + 1} (${w.views} views, score: ${w.score}):
Caption: "${(w.caption || '').slice(0, 100)}..."
Hook Style: ${w.patterns?.hookStyle || 'unknown'}
Niche: ${w.patterns?.niche || 'general'}
Hashtags: ${w.patterns?.hashtags?.slice(0, 5).join(' ') || 'none'}
---
`;
    });

    if (bestPatterns.bestHook) {
        prompt += `\nBEST HOOK STYLE: ${bestPatterns.bestHook[0]} (avg score: ${bestPatterns.bestHook[1].avgScore.toFixed(2)})`;
    }
    if (bestPatterns.bestHashtags.length > 0) {
        prompt += `\nTOP HASHTAGS: ${bestPatterns.bestHashtags.join(' ')}`;
    }
    if (bestPatterns.viralRate) {
        prompt += `\nVIRAL RATE: ${bestPatterns.viralRate}% of videos go viral`;
    }

    prompt += `

FOR TIKTOK: First 1 second is CRITICAL. Use pattern interrupts. Optimize for shares.
`;

    return prompt;
};

/**
 * Fetch TikTok video stats (requires TikTok API tokens)
 * Note: TikTok API access is limited, may need manual data entry
 */
export const fetchVideoStats = async () => {
    const tokens = loadTokens();

    if (!tokens || !tokens.access_token) {
        console.log('   ⚠️ TikTok API not connected. Add videos manually or connect API.');
        return { videos: [], summary: null };
    }

    try {
        // TikTok API v2 - Get user videos
        const response = await fetch('https://open.tiktokapis.com/v2/video/list/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                max_count: 20,
                fields: ['id', 'title', 'create_time', 'share_url', 'duration', 'view_count', 'like_count', 'comment_count', 'share_count']
            })
        });

        if (!response.ok) {
            throw new Error(`TikTok API error: ${response.status}`);
        }

        const data = await response.json();
        const videos = (data.data?.videos || []).map(v => ({
            videoId: v.id,
            caption: v.title,
            views: v.view_count,
            likes: v.like_count,
            comments: v.comment_count,
            shares: v.share_count,
            duration: v.duration,
            publishedAt: new Date(v.create_time * 1000).toISOString(),
            url: v.share_url
        }));

        const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
        const summary = {
            totalVideos: videos.length,
            totalViews,
            avgViewsPerVideo: videos.length > 0 ? Math.round(totalViews / videos.length) : 0,
            fetchedAt: new Date().toISOString()
        };

        console.log(`   ✅ TikTok: Fetched ${videos.length} videos, ${totalViews} total views`);

        return { videos, summary };

    } catch (error) {
        console.error('   ❌ TikTok API error:', error.message);
        return { videos: [], summary: null };
    }
};

/**
 * Manually add TikTok video data (when API not available)
 */
export const addVideoManually = (videoData) => {
    const data = loadWinningPatterns();
    const scoreData = calculateExpectedValueScore(videoData);
    const patterns = extractPatterns(videoData);

    const video = {
        videoId: videoData.videoId || `manual_${Date.now()}`,
        caption: videoData.caption,
        views: videoData.views,
        likes: videoData.likes || 0,
        comments: videoData.comments || 0,
        shares: videoData.shares || 0,
        score: scoreData.score,
        scoreLabel: scoreData.label,
        patterns: patterns,
        production: videoData.production || null,
        publishedAt: videoData.publishedAt || new Date().toISOString(),
        addedAt: new Date().toISOString(),
        source: 'manual'
    };

    // Add to winners if qualifies
    if (videoData.views >= TIKTOK_THRESHOLDS.AVERAGE) {
        data.winners.push(video);
        data.winners.sort((a, b) => b.score - a.score);
        data.winners = data.winners.slice(0, 20);
    }

    saveWinningPatterns(data);
    console.log(`   ✅ TikTok video added manually: ${videoData.views} views`);

    return data;
};

export default {
    loadWinningPatterns,
    calculateExpectedValueScore,
    updateWinningPatterns,
    getTopWinners,
    getBestPatterns,
    generateFewShotPrompt,
    fetchVideoStats,
    addVideoManually,
    TIKTOK_THRESHOLDS
};
