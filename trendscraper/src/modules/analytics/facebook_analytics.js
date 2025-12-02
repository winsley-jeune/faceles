/**
 * Facebook Analytics Module - REPEATED GAME (TIT-FOR-TAT) STRATEGY
 *
 * Game Theory: Facebook rewards CONSISTENCY over virality
 * - Trust builds over time with regular, quality posts
 * - Algorithm favors accounts with steady engagement history
 * - "Tit-for-Tat": Give value consistently, audience reciprocates with engagement
 *
 * Key Metrics:
 * - Consistency Score: How regular are posts?
 * - Engagement Trend: Is engagement growing over time?
 * - Share Rate: Shares indicate trust (people share what they endorse)
 * - Comment Quality: Real comments vs reactions show deeper engagement
 * - Follower Retention: Are followers staying and engaging?
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Facebook-specific thresholds (organic reach is harder)
const FACEBOOK_THRESHOLDS = {
    VIRAL: 500,      // 500+ views is viral for organic FB Reels
    GOOD: 200,       // 200+ is solid
    AVERAGE: 50,     // 50-200 is average
    POOR: 20,        // Below 50 is poor

    // Consistency metrics
    MIN_POSTS_FOR_TRUST: 10,  // Need 10+ posts to build trust score
    IDEAL_POST_FREQUENCY: 1,   // 1 post per day is ideal
    MAX_GAP_DAYS: 3,           // Don't go 3+ days without posting

    // Engagement benchmarks
    SHARE_RATE_TARGET: 0.02,   // 2% share rate is excellent
    COMMENT_RATE_TARGET: 0.01  // 1% comment rate is good
};

// Pattern storage path
const PATTERNS_FILE = path.join(__dirname, '../../data/facebook_winning_patterns.json');

/**
 * Load or initialize winning patterns
 */
export const loadWinningPatterns = () => {
    try {
        if (fs.existsSync(PATTERNS_FILE)) {
            return JSON.parse(fs.readFileSync(PATTERNS_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('Error loading FB patterns:', err);
    }

    return {
        winners: [],           // Top performing videos
        patterns: {
            hooks: {},         // Hook style performance
            niches: {},        // Niche performance
            postTimes: {},     // Best times to post
            durations: {},     // Video length performance
            formats: {},       // Reel vs Story vs Post
            tones: {}          // Voice/content tone performance
        },
        consistency: {
            totalPosts: 0,
            postDates: [],
            avgEngagement: 0,
            engagementTrend: []  // Track engagement over time
        },
        trustScore: 0,         // 0-100 based on consistency
        lastUpdated: null
    };
};

/**
 * Save patterns to file
 */
const savePatterns = (patterns) => {
    try {
        const dir = path.dirname(PATTERNS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2));
    } catch (err) {
        console.error('Error saving FB patterns:', err);
    }
};

/**
 * Extract patterns from video metadata
 */
const extractPatterns = (video) => {
    const patterns = {
        hookStyle: 'unknown',
        niche: 'general',
        duration: 'short',
        format: 'reel',
        tone: 'neutral',
        postHour: new Date().getHours()
    };

    // Parse from title/description
    const title = (video.title || video.description || '').toLowerCase();

    // Hook detection
    if (title.includes('stop scrolling') || title.includes('wait')) {
        patterns.hookStyle = 'scroll_stopper';
    } else if (title.includes('you won\'t believe') || title.includes('shocking')) {
        patterns.hookStyle = 'curiosity';
    } else if (title.includes('this is why') || title.includes('here\'s how')) {
        patterns.hookStyle = 'educational';
    } else if (title.includes('story time') || title.includes('i was')) {
        patterns.hookStyle = 'storytelling';
    } else if (title.includes('number 1') || title.includes('#1')) {
        patterns.hookStyle = 'listicle';
    }

    // Niche detection
    const niches = ['money', 'psychology', 'motivation', 'business', 'lifestyle', 'tech', 'news', 'entertainment'];
    for (const niche of niches) {
        if (title.includes(niche) || (video.category || '').toLowerCase().includes(niche)) {
            patterns.niche = niche;
            break;
        }
    }

    // Duration categorization
    const duration = video.duration || 0;
    if (duration <= 15) patterns.duration = 'micro';      // 0-15s
    else if (duration <= 30) patterns.duration = 'short'; // 15-30s
    else if (duration <= 60) patterns.duration = 'medium';// 30-60s
    else patterns.duration = 'long';                      // 60s+

    // Format detection
    patterns.format = video.format || 'reel';

    // Tone detection
    if (title.includes('urgent') || title.includes('breaking')) {
        patterns.tone = 'urgent';
    } else if (title.includes('funny') || title.includes('lol')) {
        patterns.tone = 'humorous';
    } else if (title.includes('calm') || title.includes('relaxing')) {
        patterns.tone = 'calm';
    } else if (title.includes('secret') || title.includes('exclusive')) {
        patterns.tone = 'exclusive';
    }

    // Post time
    if (video.publishedAt) {
        patterns.postHour = new Date(video.publishedAt).getHours();
    }

    return patterns;
};

/**
 * Calculate Repeated Game Score
 * Rewards consistency and growing engagement over time
 *
 * Formula:
 * - Base score from views
 * - Consistency multiplier (regular posting = trust)
 * - Engagement trend bonus (growing = algorithm favor)
 * - Share rate bonus (shares = endorsement)
 */
export const calculateRepeatedGameScore = (video, patterns = null) => {
    const views = video.views || 0;
    const shares = video.shares || 0;
    const comments = video.comments || 0;
    const reactions = video.reactions || video.likes || 0;

    // Load patterns if not provided
    const allPatterns = patterns || loadWinningPatterns();

    // 1. Base score from views (-2 to 2)
    let baseScore;
    if (views >= FACEBOOK_THRESHOLDS.VIRAL) {
        baseScore = 2;
    } else if (views >= FACEBOOK_THRESHOLDS.GOOD) {
        baseScore = 1;
    } else if (views >= FACEBOOK_THRESHOLDS.AVERAGE) {
        baseScore = 0;
    } else if (views >= FACEBOOK_THRESHOLDS.POOR) {
        baseScore = -1;
    } else {
        baseScore = -2;
    }

    // 2. Share rate bonus (Facebook gold - shares = trust)
    const shareRate = views > 0 ? shares / views : 0;
    const shareBonus = shareRate >= FACEBOOK_THRESHOLDS.SHARE_RATE_TARGET ? 0.5 :
                       shareRate >= FACEBOOK_THRESHOLDS.SHARE_RATE_TARGET / 2 ? 0.25 : 0;

    // 3. Comment rate bonus (deeper engagement)
    const commentRate = views > 0 ? comments / views : 0;
    const commentBonus = commentRate >= FACEBOOK_THRESHOLDS.COMMENT_RATE_TARGET ? 0.3 :
                         commentRate >= FACEBOOK_THRESHOLDS.COMMENT_RATE_TARGET / 2 ? 0.15 : 0;

    // 4. Consistency multiplier (from trust score)
    const trustMultiplier = 1 + (allPatterns.trustScore / 200); // Up to 1.5x

    // 5. Engagement trend bonus
    let trendBonus = 0;
    const trend = allPatterns.consistency?.engagementTrend || [];
    if (trend.length >= 3) {
        const recentAvg = trend.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const olderAvg = trend.slice(-6, -3).reduce((a, b) => a + b, 0) / Math.max(1, trend.slice(-6, -3).length);
        if (recentAvg > olderAvg * 1.1) trendBonus = 0.3;  // 10% growth
        else if (recentAvg < olderAvg * 0.9) trendBonus = -0.3; // Declining
    }

    // Calculate final score
    const rawScore = (baseScore + shareBonus + commentBonus + trendBonus) * trustMultiplier;
    const finalScore = Math.max(-2, Math.min(2, rawScore));

    // Determine label
    let label;
    if (finalScore >= 1.5) label = 'VIRAL';
    else if (finalScore >= 0.5) label = 'GOOD';
    else if (finalScore >= -0.5) label = 'AVERAGE';
    else if (finalScore >= -1.5) label = 'POOR';
    else label = 'FLOP';

    return {
        score: Math.round(finalScore * 100) / 100,
        label,
        metrics: {
            views,
            shares,
            comments,
            reactions,
            shareRate: Math.round(shareRate * 10000) / 100,
            commentRate: Math.round(commentRate * 10000) / 100,
            trustMultiplier: Math.round(trustMultiplier * 100) / 100,
            trendBonus,
            baseScore
        }
    };
};

/**
 * Calculate Trust Score based on posting consistency
 * Tit-for-Tat: Regular value = earned trust
 */
export const calculateTrustScore = (patterns) => {
    const { postDates, totalPosts, engagementTrend } = patterns.consistency;

    if (totalPosts < FACEBOOK_THRESHOLDS.MIN_POSTS_FOR_TRUST) {
        // Not enough history - return partial score
        return Math.round((totalPosts / FACEBOOK_THRESHOLDS.MIN_POSTS_FOR_TRUST) * 30);
    }

    let score = 30; // Base 30 points for meeting minimum posts

    // Consistency bonus (up to 40 points)
    if (postDates.length >= 2) {
        const sortedDates = postDates.map(d => new Date(d).getTime()).sort((a, b) => a - b);
        let totalGaps = 0;
        let longGaps = 0;

        for (let i = 1; i < sortedDates.length; i++) {
            const gapDays = (sortedDates[i] - sortedDates[i-1]) / (1000 * 60 * 60 * 24);
            totalGaps += gapDays;
            if (gapDays > FACEBOOK_THRESHOLDS.MAX_GAP_DAYS) longGaps++;
        }

        const avgGap = totalGaps / (sortedDates.length - 1);

        // Perfect score for ~1 post/day
        if (avgGap <= FACEBOOK_THRESHOLDS.IDEAL_POST_FREQUENCY) {
            score += 40;
        } else if (avgGap <= 2) {
            score += 30;
        } else if (avgGap <= 3) {
            score += 20;
        } else {
            score += 10;
        }

        // Penalty for long gaps
        score -= longGaps * 5;
    }

    // Engagement growth bonus (up to 30 points)
    if (engagementTrend.length >= 5) {
        const firstHalf = engagementTrend.slice(0, Math.floor(engagementTrend.length / 2));
        const secondHalf = engagementTrend.slice(Math.floor(engagementTrend.length / 2));

        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        if (secondAvg > firstAvg * 1.2) {
            score += 30; // 20% growth
        } else if (secondAvg > firstAvg) {
            score += 20; // Any growth
        } else if (secondAvg > firstAvg * 0.8) {
            score += 10; // Stable
        }
        // No bonus for declining
    }

    return Math.max(0, Math.min(100, Math.round(score)));
};

/**
 * Update winning patterns with new video data
 */
export const updateWinningPatterns = (video, scoreResult) => {
    const patterns = loadWinningPatterns();
    const extracted = extractPatterns(video);

    // Update consistency tracking
    patterns.consistency.totalPosts++;
    patterns.consistency.postDates.push(video.publishedAt || new Date().toISOString());

    // Track engagement trend
    const engagement = (video.shares || 0) + (video.comments || 0) + (video.reactions || video.likes || 0);
    patterns.consistency.engagementTrend.push(engagement);

    // Keep last 30 engagement points
    if (patterns.consistency.engagementTrend.length > 30) {
        patterns.consistency.engagementTrend = patterns.consistency.engagementTrend.slice(-30);
    }

    // Recalculate trust score
    patterns.trustScore = calculateTrustScore(patterns);

    // Update pattern statistics
    const patternCategories = ['hooks', 'niches', 'durations', 'formats', 'tones', 'postTimes'];
    const patternValues = {
        hooks: extracted.hookStyle,
        niches: extracted.niche,
        durations: extracted.duration,
        formats: extracted.format,
        tones: extracted.tone,
        postTimes: `hour_${extracted.postHour}`
    };

    for (const category of patternCategories) {
        const value = patternValues[category];
        if (!patterns.patterns[category][value]) {
            patterns.patterns[category][value] = { count: 0, totalScore: 0, avgScore: 0 };
        }
        patterns.patterns[category][value].count++;
        patterns.patterns[category][value].totalScore += scoreResult.score;
        patterns.patterns[category][value].avgScore =
            patterns.patterns[category][value].totalScore / patterns.patterns[category][value].count;
    }

    // Store winners (score >= 1)
    if (scoreResult.score >= 1) {
        patterns.winners.push({
            videoId: video.id,
            title: video.title || video.description?.slice(0, 50),
            score: scoreResult.score,
            label: scoreResult.label,
            metrics: scoreResult.metrics,
            patterns: extracted,
            addedAt: new Date().toISOString()
        });

        // Keep top 10 winners
        patterns.winners.sort((a, b) => b.score - a.score);
        patterns.winners = patterns.winners.slice(0, 10);
    }

    patterns.lastUpdated = new Date().toISOString();
    savePatterns(patterns);

    return patterns;
};

/**
 * Generate few-shot prompt for Facebook content
 * Emphasizes consistency and trust-building content
 */
export const generateFewShotPrompt = () => {
    const patterns = loadWinningPatterns();

    let prompt = `## Facebook Content Strategy (Repeated Game - Build Trust)\n\n`;
    prompt += `**Trust Score:** ${patterns.trustScore}/100\n`;
    prompt += `**Total Posts:** ${patterns.consistency.totalPosts}\n\n`;

    // Trust-building guidance
    if (patterns.trustScore < 30) {
        prompt += `⚠️ LOW TRUST: Focus on consistent daily posting. Algorithm needs to see reliability.\n\n`;
    } else if (patterns.trustScore < 60) {
        prompt += `📈 BUILDING TRUST: Good progress! Maintain posting frequency and engagement.\n\n`;
    } else {
        prompt += `✅ HIGH TRUST: Algorithm favors this account. Experiment with broader reach content.\n\n`;
    }

    // Top performing examples
    if (patterns.winners.length > 0) {
        prompt += `### Top Performing Content (Use as Templates)\n\n`;
        patterns.winners.slice(0, 3).forEach((winner, i) => {
            prompt += `**${i + 1}. ${winner.title}** (Score: ${winner.score})\n`;
            prompt += `   - Hook: ${winner.patterns.hookStyle}\n`;
            prompt += `   - Niche: ${winner.patterns.niche}\n`;
            prompt += `   - Shares: ${winner.metrics.shares} (${winner.metrics.shareRate}%)\n\n`;
        });
    }

    // Best patterns
    prompt += `### Best Performing Patterns\n\n`;

    for (const [category, values] of Object.entries(patterns.patterns)) {
        const sorted = Object.entries(values)
            .filter(([_, stats]) => stats.count >= 2)
            .sort((a, b) => b[1].avgScore - a[1].avgScore);

        if (sorted.length > 0) {
            const [bestValue, bestStats] = sorted[0];
            prompt += `- **${category}:** ${bestValue} (avg score: ${bestStats.avgScore.toFixed(2)})\n`;
        }
    }

    // Engagement trend analysis
    const trend = patterns.consistency.engagementTrend;
    if (trend.length >= 5) {
        const recent = trend.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const older = trend.slice(-10, -5).reduce((a, b) => a + b, 0) / Math.max(1, trend.slice(-10, -5).length);

        prompt += `\n### Engagement Trend\n`;
        if (recent > older * 1.1) {
            prompt += `📈 GROWING: Recent engagement up ${Math.round((recent/older - 1) * 100)}% - algorithm is boosting content\n`;
        } else if (recent < older * 0.9) {
            prompt += `📉 DECLINING: Recent engagement down - increase posting frequency or refresh content style\n`;
        } else {
            prompt += `➡️ STABLE: Maintain current strategy\n`;
        }
    }

    prompt += `\n### Facebook-Specific Tips\n`;
    prompt += `- Shares are GOLD on Facebook - create content people want to share with friends\n`;
    prompt += `- Comments drive algorithm boost - end with questions or controversial takes\n`;
    prompt += `- Consistency > Virality - one post/day builds more trust than weekly viral attempts\n`;
    prompt += `- Stories complement Reels - use Stories for behind-the-scenes, Reels for main content\n`;

    return prompt;
};

/**
 * Fetch video stats from Facebook API
 */
export const fetchVideoStats = async (accessToken, videoId) => {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${videoId}?fields=id,title,description,views,shares,comments.summary(true),reactions.summary(true),created_time&access_token=${accessToken}`
        );

        if (!response.ok) {
            throw new Error(`Facebook API error: ${response.status}`);
        }

        const data = await response.json();

        return {
            id: data.id,
            title: data.title || data.description?.slice(0, 50),
            description: data.description,
            views: data.views || 0,
            shares: data.shares?.count || 0,
            comments: data.comments?.summary?.total_count || 0,
            reactions: data.reactions?.summary?.total_count || 0,
            publishedAt: data.created_time
        };
    } catch (err) {
        console.error('Error fetching FB video stats:', err);
        throw err;
    }
};

/**
 * Fetch all recent videos for analysis
 */
export const fetchRecentVideos = async (accessToken, pageId, limit = 25) => {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${pageId}/videos?fields=id,title,description,views,shares,comments.summary(true),reactions.summary(true),created_time&limit=${limit}&access_token=${accessToken}`
        );

        if (!response.ok) {
            throw new Error(`Facebook API error: ${response.status}`);
        }

        const data = await response.json();

        return (data.data || []).map(video => ({
            id: video.id,
            title: video.title || video.description?.slice(0, 50),
            description: video.description,
            views: video.views || 0,
            shares: video.shares?.count || 0,
            comments: video.comments?.summary?.total_count || 0,
            reactions: video.reactions?.summary?.total_count || 0,
            publishedAt: video.created_time
        }));
    } catch (err) {
        console.error('Error fetching FB videos:', err);
        throw err;
    }
};

/**
 * Full analysis of Facebook channel
 */
export const analyzeChannel = async (accessToken, pageId) => {
    const videos = await fetchRecentVideos(accessToken, pageId);
    const patterns = loadWinningPatterns();

    const results = [];

    for (const video of videos) {
        const scoreResult = calculateRepeatedGameScore(video, patterns);
        updateWinningPatterns(video, scoreResult);
        results.push({
            ...video,
            analysis: scoreResult
        });
    }

    // Return summary
    const avgScore = results.reduce((sum, r) => sum + r.analysis.score, 0) / results.length;
    const viral = results.filter(r => r.analysis.label === 'VIRAL').length;
    const good = results.filter(r => r.analysis.label === 'GOOD').length;

    return {
        totalVideos: results.length,
        averageScore: Math.round(avgScore * 100) / 100,
        viralCount: viral,
        goodCount: good,
        trustScore: patterns.trustScore,
        videos: results,
        fewShotPrompt: generateFewShotPrompt()
    };
};

/**
 * Add video manually (for testing or when API unavailable)
 */
export const addVideoManually = (videoData) => {
    const video = {
        id: videoData.id || `fb_manual_${Date.now()}`,
        title: videoData.title,
        description: videoData.description || videoData.title,
        views: videoData.views || 0,
        shares: videoData.shares || 0,
        comments: videoData.comments || 0,
        reactions: videoData.reactions || videoData.likes || 0,
        publishedAt: videoData.publishedAt || new Date().toISOString(),
        format: videoData.format || 'reel',
        category: videoData.category || 'general'
    };

    const scoreResult = calculateRepeatedGameScore(video);
    updateWinningPatterns(video, scoreResult);

    return {
        video,
        analysis: scoreResult,
        trustScore: loadWinningPatterns().trustScore
    };
};

export default {
    calculateRepeatedGameScore,
    calculateTrustScore,
    updateWinningPatterns,
    generateFewShotPrompt,
    fetchVideoStats,
    fetchRecentVideos,
    analyzeChannel,
    addVideoManually,
    loadWinningPatterns,
    FACEBOOK_THRESHOLDS
};
