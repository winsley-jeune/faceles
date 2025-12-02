/**
 * Instagram Analytics Module - NASH EQUILIBRIUM STRATEGY
 *
 * Game Theory: Balance between follower engagement and new viewer acquisition
 * - Too much follower content = Limited growth
 * - Too much viral bait = Lose loyal followers
 * - Nash Equilibrium = Optimal balance where neither pure strategy beats mixed
 *
 * Key Metrics:
 * - Follower vs Non-Follower ratio: Who's watching?
 * - Save Rate: Saves indicate high-value content (algorithm gold)
 * - Share Rate: Shares = new audience reach
 * - Profile Visits: New viewers considering following
 * - Follower Conversion: Non-followers who become followers
 *
 * Strategy: 70% follower-friendly content, 30% reach-optimized content
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Instagram-specific thresholds
const INSTAGRAM_THRESHOLDS = {
    VIRAL: 5000,     // 5000+ views for viral Reel
    GOOD: 1000,      // 1000+ is solid
    AVERAGE: 300,    // 300-1000 is average
    POOR: 100,       // Below 300 is poor

    // Engagement benchmarks (Instagram-specific)
    SAVE_RATE_TARGET: 0.03,    // 3% save rate is excellent
    SHARE_RATE_TARGET: 0.02,   // 2% share rate is great
    PROFILE_VISIT_TARGET: 0.05, // 5% profile visits = interested viewers

    // Nash Equilibrium targets
    OPTIMAL_FOLLOWER_RATIO: 0.7,  // 70% followers, 30% new viewers
    CONVERSION_TARGET: 0.1         // 10% of non-followers should follow
};

// Pattern storage path
const PATTERNS_FILE = path.join(__dirname, '../../data/instagram_winning_patterns.json');

/**
 * Load or initialize winning patterns
 */
export const loadWinningPatterns = () => {
    try {
        if (fs.existsSync(PATTERNS_FILE)) {
            return JSON.parse(fs.readFileSync(PATTERNS_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('Error loading IG patterns:', err);
    }

    return {
        winners: [],           // Top performing videos
        patterns: {
            hooks: {},         // Hook style performance
            niches: {},        // Niche performance
            hashtags: {},      // Hashtag performance
            aesthetics: {},    // Visual style performance
            musicTypes: {},    // Music/audio type performance
            postTimes: {},     // Best times to post
            durations: {},     // Video length performance
            captionStyles: {}  // Caption style performance
        },
        equilibrium: {
            followerContentCount: 0,   // Content aimed at followers
            reachContentCount: 0,      // Content aimed at new viewers
            avgFollowerEngagement: 0,
            avgReachEngagement: 0,
            currentRatio: 0.5,         // Current follower/reach content ratio
            optimalRatio: 0.7          // Target ratio (adjusts over time)
        },
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
        console.error('Error saving IG patterns:', err);
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
        aesthetic: 'standard',
        musicType: 'trending',
        hashtags: [],
        captionStyle: 'standard',
        postHour: new Date().getHours(),
        contentType: 'balanced'  // 'follower', 'reach', or 'balanced'
    };

    // Parse from caption/title
    const caption = (video.caption || video.title || '').toLowerCase();

    // Hook detection
    if (caption.includes('watch till the end') || caption.includes('wait for it')) {
        patterns.hookStyle = 'anticipation';
    } else if (caption.includes('pov:') || caption.includes('pov ')) {
        patterns.hookStyle = 'pov';
    } else if (caption.includes('this is your sign') || caption.includes('reminder')) {
        patterns.hookStyle = 'affirmation';
    } else if (caption.includes('nobody talks about') || caption.includes('nobody knows')) {
        patterns.hookStyle = 'insider';
    } else if (caption.includes('tutorial') || caption.includes('how to')) {
        patterns.hookStyle = 'educational';
    } else if (caption.match(/^\d+\s+(tips?|ways?|things?)/)) {
        patterns.hookStyle = 'listicle';
    }

    // Niche detection
    const niches = ['money', 'psychology', 'motivation', 'fitness', 'lifestyle', 'beauty', 'fashion', 'tech', 'food', 'travel'];
    for (const niche of niches) {
        if (caption.includes(niche) || (video.category || '').toLowerCase().includes(niche)) {
            patterns.niche = niche;
            break;
        }
    }

    // Hashtag extraction
    const hashtagMatches = caption.match(/#\w+/g) || [];
    patterns.hashtags = hashtagMatches.slice(0, 10);

    // Duration categorization
    const duration = video.duration || 0;
    if (duration <= 7) patterns.duration = 'micro';       // 0-7s
    else if (duration <= 15) patterns.duration = 'short'; // 7-15s
    else if (duration <= 30) patterns.duration = 'medium';// 15-30s
    else if (duration <= 60) patterns.duration = 'long';  // 30-60s
    else patterns.duration = 'extended';                  // 60s+

    // Aesthetic detection
    if (video.aesthetic) {
        patterns.aesthetic = video.aesthetic;
    } else if (caption.includes('aesthetic') || caption.includes('minimal')) {
        patterns.aesthetic = 'minimalist';
    } else if (caption.includes('dark') || caption.includes('moody')) {
        patterns.aesthetic = 'dark';
    } else if (caption.includes('bright') || caption.includes('colorful')) {
        patterns.aesthetic = 'vibrant';
    }

    // Caption style
    if (caption.length < 50) {
        patterns.captionStyle = 'minimal';
    } else if (caption.length > 500) {
        patterns.captionStyle = 'story';
    } else if (hashtagMatches.length > 15) {
        patterns.captionStyle = 'hashtag_heavy';
    } else {
        patterns.captionStyle = 'standard';
    }

    // Content type (follower vs reach focus)
    // Follower content: personal, behind-scenes, community-focused
    // Reach content: trendy, shareable, broad appeal
    const followerKeywords = ['thank you', 'you guys', 'community', 'personal', 'update', 'announcement'];
    const reachKeywords = ['viral', 'trending', 'share this', 'must watch', 'everyone needs'];

    const hasFollowerFocus = followerKeywords.some(kw => caption.includes(kw));
    const hasReachFocus = reachKeywords.some(kw => caption.includes(kw));

    if (hasFollowerFocus && !hasReachFocus) {
        patterns.contentType = 'follower';
    } else if (hasReachFocus && !hasFollowerFocus) {
        patterns.contentType = 'reach';
    } else {
        patterns.contentType = 'balanced';
    }

    // Post time
    if (video.publishedAt) {
        patterns.postHour = new Date(video.publishedAt).getHours();
    }

    return patterns;
};

/**
 * Calculate Nash Equilibrium Score
 * Balances follower engagement with reach potential
 *
 * Formula:
 * - Base score from views
 * - Save rate bonus (high-value indicator)
 * - Share rate bonus (reach indicator)
 * - Follower balance bonus (optimal mix)
 * - Profile visit conversion bonus
 */
export const calculateNashEquilibriumScore = (video, patterns = null) => {
    const views = video.views || video.plays || 0;
    const likes = video.likes || 0;
    const comments = video.comments || 0;
    const saves = video.saves || 0;
    const shares = video.shares || 0;
    const profileVisits = video.profileVisits || 0;
    const followerReach = video.followerReach || 0;
    const nonFollowerReach = video.nonFollowerReach || 0;

    // Load patterns if not provided
    const allPatterns = patterns || loadWinningPatterns();

    // 1. Base score from views (-2 to 2)
    let baseScore;
    if (views >= INSTAGRAM_THRESHOLDS.VIRAL) {
        baseScore = 2;
    } else if (views >= INSTAGRAM_THRESHOLDS.GOOD) {
        baseScore = 1;
    } else if (views >= INSTAGRAM_THRESHOLDS.AVERAGE) {
        baseScore = 0;
    } else if (views >= INSTAGRAM_THRESHOLDS.POOR) {
        baseScore = -1;
    } else {
        baseScore = -2;
    }

    // 2. Save rate bonus (Instagram gold - saves = algorithm boost)
    const saveRate = views > 0 ? saves / views : 0;
    const saveBonus = saveRate >= INSTAGRAM_THRESHOLDS.SAVE_RATE_TARGET ? 0.5 :
                      saveRate >= INSTAGRAM_THRESHOLDS.SAVE_RATE_TARGET / 2 ? 0.25 : 0;

    // 3. Share rate bonus (reach expansion)
    const shareRate = views > 0 ? shares / views : 0;
    const shareBonus = shareRate >= INSTAGRAM_THRESHOLDS.SHARE_RATE_TARGET ? 0.4 :
                       shareRate >= INSTAGRAM_THRESHOLDS.SHARE_RATE_TARGET / 2 ? 0.2 : 0;

    // 4. Nash Equilibrium bonus - optimal follower/non-follower balance
    let equilibriumBonus = 0;
    const totalReach = followerReach + nonFollowerReach;
    if (totalReach > 0) {
        const followerRatio = followerReach / totalReach;
        const deviation = Math.abs(followerRatio - INSTAGRAM_THRESHOLDS.OPTIMAL_FOLLOWER_RATIO);

        // Closer to optimal ratio = higher bonus
        if (deviation < 0.1) equilibriumBonus = 0.3;       // Within 10% of optimal
        else if (deviation < 0.2) equilibriumBonus = 0.15; // Within 20% of optimal
        else equilibriumBonus = -0.1;                       // Too far from optimal
    }

    // 5. Profile visit conversion bonus
    const profileVisitRate = views > 0 ? profileVisits / views : 0;
    const conversionBonus = profileVisitRate >= INSTAGRAM_THRESHOLDS.PROFILE_VISIT_TARGET ? 0.3 :
                            profileVisitRate >= INSTAGRAM_THRESHOLDS.PROFILE_VISIT_TARGET / 2 ? 0.15 : 0;

    // Calculate final score
    const rawScore = baseScore + saveBonus + shareBonus + equilibriumBonus + conversionBonus;
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
            likes,
            comments,
            saves,
            shares,
            profileVisits,
            saveRate: Math.round(saveRate * 10000) / 100,
            shareRate: Math.round(shareRate * 10000) / 100,
            profileVisitRate: Math.round(profileVisitRate * 10000) / 100,
            followerReach,
            nonFollowerReach,
            followerRatio: totalReach > 0 ? Math.round((followerReach / totalReach) * 100) : null,
            equilibriumBonus,
            baseScore
        }
    };
};

/**
 * Calculate optimal content ratio based on performance data
 * Adjusts the Nash Equilibrium point over time
 */
export const calculateOptimalRatio = (patterns) => {
    const { followerContentCount, reachContentCount, avgFollowerEngagement, avgReachEngagement } = patterns.equilibrium;

    const totalContent = followerContentCount + reachContentCount;

    // Need enough data
    if (totalContent < 10) {
        return INSTAGRAM_THRESHOLDS.OPTIMAL_FOLLOWER_RATIO; // Default 70/30
    }

    // Compare engagement per content type
    const relativeFollowerValue = avgFollowerEngagement / (avgFollowerEngagement + avgReachEngagement + 1);
    const relativeReachValue = avgReachEngagement / (avgFollowerEngagement + avgReachEngagement + 1);

    // Shift ratio toward better-performing type, but stay in bounds
    let optimalRatio = 0.5 + (relativeFollowerValue - relativeReachValue);
    optimalRatio = Math.max(0.4, Math.min(0.8, optimalRatio)); // Keep between 40-80% follower content

    return Math.round(optimalRatio * 100) / 100;
};

/**
 * Update winning patterns with new video data
 */
export const updateWinningPatterns = (video, scoreResult) => {
    const patterns = loadWinningPatterns();
    const extracted = extractPatterns(video);

    // Update equilibrium tracking
    const engagement = (video.likes || 0) + (video.comments || 0) + (video.saves || 0) * 2 + (video.shares || 0) * 2;

    if (extracted.contentType === 'follower') {
        patterns.equilibrium.followerContentCount++;
        const oldTotal = patterns.equilibrium.avgFollowerEngagement * (patterns.equilibrium.followerContentCount - 1);
        patterns.equilibrium.avgFollowerEngagement = (oldTotal + engagement) / patterns.equilibrium.followerContentCount;
    } else if (extracted.contentType === 'reach') {
        patterns.equilibrium.reachContentCount++;
        const oldTotal = patterns.equilibrium.avgReachEngagement * (patterns.equilibrium.reachContentCount - 1);
        patterns.equilibrium.avgReachEngagement = (oldTotal + engagement) / patterns.equilibrium.reachContentCount;
    }

    // Recalculate optimal ratio
    const totalContent = patterns.equilibrium.followerContentCount + patterns.equilibrium.reachContentCount;
    if (totalContent > 0) {
        patterns.equilibrium.currentRatio = patterns.equilibrium.followerContentCount / totalContent;
    }
    patterns.equilibrium.optimalRatio = calculateOptimalRatio(patterns);

    // Update pattern statistics
    const patternCategories = ['hooks', 'niches', 'durations', 'aesthetics', 'musicTypes', 'captionStyles', 'postTimes'];
    const patternValues = {
        hooks: extracted.hookStyle,
        niches: extracted.niche,
        durations: extracted.duration,
        aesthetics: extracted.aesthetic,
        musicTypes: extracted.musicType,
        captionStyles: extracted.captionStyle,
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

    // Track hashtag performance individually
    for (const hashtag of extracted.hashtags) {
        if (!patterns.patterns.hashtags[hashtag]) {
            patterns.patterns.hashtags[hashtag] = { count: 0, totalScore: 0, avgScore: 0 };
        }
        patterns.patterns.hashtags[hashtag].count++;
        patterns.patterns.hashtags[hashtag].totalScore += scoreResult.score;
        patterns.patterns.hashtags[hashtag].avgScore =
            patterns.patterns.hashtags[hashtag].totalScore / patterns.patterns.hashtags[hashtag].count;
    }

    // Store winners (score >= 1)
    if (scoreResult.score >= 1) {
        patterns.winners.push({
            videoId: video.id,
            title: video.caption?.slice(0, 50) || video.title,
            score: scoreResult.score,
            label: scoreResult.label,
            metrics: scoreResult.metrics,
            patterns: extracted,
            contentType: extracted.contentType,
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
 * Generate few-shot prompt for Instagram content
 * Emphasizes the Nash Equilibrium balance
 */
export const generateFewShotPrompt = () => {
    const patterns = loadWinningPatterns();

    let prompt = `## Instagram Content Strategy (Nash Equilibrium - Balance Follower & Reach)\n\n`;

    // Equilibrium status
    const eq = patterns.equilibrium;
    prompt += `### Current Content Balance\n`;
    prompt += `- Follower Content: ${eq.followerContentCount} posts (avg engagement: ${Math.round(eq.avgFollowerEngagement)})\n`;
    prompt += `- Reach Content: ${eq.reachContentCount} posts (avg engagement: ${Math.round(eq.avgReachEngagement)})\n`;
    prompt += `- Current Ratio: ${Math.round(eq.currentRatio * 100)}% follower-focused\n`;
    prompt += `- **Optimal Ratio:** ${Math.round(eq.optimalRatio * 100)}% follower / ${Math.round((1 - eq.optimalRatio) * 100)}% reach\n\n`;

    // Recommendation based on current state
    if (eq.currentRatio < eq.optimalRatio - 0.1) {
        prompt += `⚠️ RECOMMENDATION: Create more follower-focused content. Balance is skewed toward reach.\n\n`;
    } else if (eq.currentRatio > eq.optimalRatio + 0.1) {
        prompt += `⚠️ RECOMMENDATION: Create more reach-focused content. Balance is skewed toward followers.\n\n`;
    } else {
        prompt += `✅ EQUILIBRIUM: Content balance is optimal. Maintain current mix.\n\n`;
    }

    // Top performing examples
    if (patterns.winners.length > 0) {
        prompt += `### Top Performing Content\n\n`;

        // Show both types if available
        const followerWinners = patterns.winners.filter(w => w.contentType === 'follower');
        const reachWinners = patterns.winners.filter(w => w.contentType === 'reach');

        if (followerWinners.length > 0) {
            prompt += `**Best Follower Content:**\n`;
            followerWinners.slice(0, 2).forEach((winner, i) => {
                prompt += `${i + 1}. ${winner.title} (Score: ${winner.score})\n`;
                prompt += `   - Hook: ${winner.patterns.hookStyle}, Saves: ${winner.metrics.saveRate}%\n`;
            });
            prompt += `\n`;
        }

        if (reachWinners.length > 0) {
            prompt += `**Best Reach Content:**\n`;
            reachWinners.slice(0, 2).forEach((winner, i) => {
                prompt += `${i + 1}. ${winner.title} (Score: ${winner.score})\n`;
                prompt += `   - Hook: ${winner.patterns.hookStyle}, Shares: ${winner.metrics.shareRate}%\n`;
            });
            prompt += `\n`;
        }
    }

    // Best patterns
    prompt += `### Best Performing Patterns\n\n`;

    for (const [category, values] of Object.entries(patterns.patterns)) {
        if (category === 'hashtags') continue; // Handle separately
        const sorted = Object.entries(values)
            .filter(([_, stats]) => stats.count >= 2)
            .sort((a, b) => b[1].avgScore - a[1].avgScore);

        if (sorted.length > 0) {
            const [bestValue, bestStats] = sorted[0];
            prompt += `- **${category}:** ${bestValue} (avg score: ${bestStats.avgScore.toFixed(2)})\n`;
        }
    }

    // Top hashtags
    const topHashtags = Object.entries(patterns.patterns.hashtags)
        .filter(([_, stats]) => stats.count >= 2)
        .sort((a, b) => b[1].avgScore - a[1].avgScore)
        .slice(0, 10);

    if (topHashtags.length > 0) {
        prompt += `\n### Top Performing Hashtags\n`;
        prompt += topHashtags.map(([tag, stats]) =>
            `${tag} (used ${stats.count}x, avg: ${stats.avgScore.toFixed(2)})`
        ).join(', ') + '\n';
    }

    prompt += `\n### Instagram-Specific Tips\n`;
    prompt += `- Saves are GOLD on Instagram - create "save-worthy" content (tutorials, tips, quotes)\n`;
    prompt += `- First 3 seconds determine watch time - hook immediately\n`;
    prompt += `- Reels reach more non-followers; Stories engage existing followers\n`;
    prompt += `- Profile visits indicate interest - optimize bio for conversion\n`;
    prompt += `- Balance is key: Pure reach content burns followers; pure follower content limits growth\n`;

    return prompt;
};

/**
 * Fetch video stats from Instagram API
 */
export const fetchVideoStats = async (accessToken, mediaId) => {
    try {
        const response = await fetch(
            `https://graph.instagram.com/${mediaId}?fields=id,caption,media_type,thumbnail_url,timestamp,like_count,comments_count&access_token=${accessToken}`
        );

        if (!response.ok) {
            throw new Error(`Instagram API error: ${response.status}`);
        }

        const data = await response.json();

        // Get insights (requires business account)
        let insights = {};
        try {
            const insightsResponse = await fetch(
                `https://graph.instagram.com/${mediaId}/insights?metric=plays,reach,saved,shares,profile_visits&access_token=${accessToken}`
            );
            if (insightsResponse.ok) {
                const insightsData = await insightsResponse.json();
                for (const metric of insightsData.data || []) {
                    insights[metric.name] = metric.values[0]?.value || 0;
                }
            }
        } catch (e) {
            console.log('Could not fetch insights (may require business account)');
        }

        return {
            id: data.id,
            caption: data.caption,
            mediaType: data.media_type,
            thumbnail: data.thumbnail_url,
            publishedAt: data.timestamp,
            likes: data.like_count || 0,
            comments: data.comments_count || 0,
            views: insights.plays || 0,
            saves: insights.saved || 0,
            shares: insights.shares || 0,
            profileVisits: insights.profile_visits || 0,
            reach: insights.reach || 0
        };
    } catch (err) {
        console.error('Error fetching IG video stats:', err);
        throw err;
    }
};

/**
 * Fetch all recent media for analysis
 */
export const fetchRecentMedia = async (accessToken, limit = 25) => {
    try {
        const response = await fetch(
            `https://graph.instagram.com/me/media?fields=id,caption,media_type,thumbnail_url,timestamp,like_count,comments_count&limit=${limit}&access_token=${accessToken}`
        );

        if (!response.ok) {
            throw new Error(`Instagram API error: ${response.status}`);
        }

        const data = await response.json();
        const media = [];

        for (const item of data.data || []) {
            // Only process video content (Reels)
            if (item.media_type === 'VIDEO' || item.media_type === 'REELS') {
                media.push({
                    id: item.id,
                    caption: item.caption,
                    mediaType: item.media_type,
                    thumbnail: item.thumbnail_url,
                    publishedAt: item.timestamp,
                    likes: item.like_count || 0,
                    comments: item.comments_count || 0
                });
            }
        }

        return media;
    } catch (err) {
        console.error('Error fetching IG media:', err);
        throw err;
    }
};

/**
 * Full analysis of Instagram account
 */
export const analyzeAccount = async (accessToken) => {
    const media = await fetchRecentMedia(accessToken);
    const patterns = loadWinningPatterns();

    const results = [];

    for (const item of media) {
        // Try to get detailed stats for each
        try {
            const detailed = await fetchVideoStats(accessToken, item.id);
            const scoreResult = calculateNashEquilibriumScore(detailed, patterns);
            updateWinningPatterns(detailed, scoreResult);
            results.push({
                ...detailed,
                analysis: scoreResult
            });
        } catch (e) {
            // Use basic data if insights unavailable
            const scoreResult = calculateNashEquilibriumScore(item, patterns);
            updateWinningPatterns(item, scoreResult);
            results.push({
                ...item,
                analysis: scoreResult
            });
        }
    }

    // Return summary
    const avgScore = results.length > 0 ?
        results.reduce((sum, r) => sum + r.analysis.score, 0) / results.length : 0;
    const viral = results.filter(r => r.analysis.label === 'VIRAL').length;
    const good = results.filter(r => r.analysis.label === 'GOOD').length;

    const updatedPatterns = loadWinningPatterns();

    return {
        totalMedia: results.length,
        averageScore: Math.round(avgScore * 100) / 100,
        viralCount: viral,
        goodCount: good,
        equilibrium: updatedPatterns.equilibrium,
        media: results,
        fewShotPrompt: generateFewShotPrompt()
    };
};

/**
 * Add video manually (for testing or when API unavailable)
 */
export const addVideoManually = (videoData) => {
    const video = {
        id: videoData.id || `ig_manual_${Date.now()}`,
        caption: videoData.caption || videoData.title,
        mediaType: 'REELS',
        publishedAt: videoData.publishedAt || new Date().toISOString(),
        likes: videoData.likes || 0,
        comments: videoData.comments || 0,
        views: videoData.views || videoData.plays || 0,
        saves: videoData.saves || 0,
        shares: videoData.shares || 0,
        profileVisits: videoData.profileVisits || 0,
        followerReach: videoData.followerReach || 0,
        nonFollowerReach: videoData.nonFollowerReach || 0,
        duration: videoData.duration || 30,
        category: videoData.category || 'general',
        aesthetic: videoData.aesthetic || 'standard'
    };

    const scoreResult = calculateNashEquilibriumScore(video);
    updateWinningPatterns(video, scoreResult);

    return {
        video,
        analysis: scoreResult,
        equilibrium: loadWinningPatterns().equilibrium
    };
};

/**
 * Get content recommendation based on current equilibrium
 */
export const getContentRecommendation = () => {
    const patterns = loadWinningPatterns();
    const eq = patterns.equilibrium;

    if (eq.currentRatio < eq.optimalRatio - 0.1) {
        return {
            recommendation: 'FOLLOWER_CONTENT',
            message: 'Create content that resonates with your existing followers. Focus on community, updates, and personal content.',
            suggestedHooks: ['POV', 'thank you', 'update', 'announcement']
        };
    } else if (eq.currentRatio > eq.optimalRatio + 0.1) {
        return {
            recommendation: 'REACH_CONTENT',
            message: 'Create shareable, trending content to reach new viewers. Focus on broad appeal and viral potential.',
            suggestedHooks: ['wait for it', 'viral', 'trending', 'share this']
        };
    } else {
        return {
            recommendation: 'BALANCED',
            message: 'Content mix is optimal. Continue with current strategy.',
            suggestedHooks: Object.entries(patterns.patterns.hooks)
                .sort((a, b) => b[1].avgScore - a[1].avgScore)
                .slice(0, 3)
                .map(([hook]) => hook)
        };
    }
};

export default {
    calculateNashEquilibriumScore,
    calculateOptimalRatio,
    updateWinningPatterns,
    generateFewShotPrompt,
    fetchVideoStats,
    fetchRecentMedia,
    analyzeAccount,
    addVideoManually,
    getContentRecommendation,
    loadWinningPatterns,
    INSTAGRAM_THRESHOLDS
};
