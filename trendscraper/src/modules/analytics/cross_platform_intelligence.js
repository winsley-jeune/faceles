import fs from 'fs';
import path from 'path';
import dataAccess from '../../utils/dataAccess.js';

/**
 * CROSS-PLATFORM INTELLIGENCE
 *
 * Learns patterns that work across platforms
 * If something goes viral on one platform, test it on others
 *
 * Features:
 * 1. Pattern Crossover Detection - Find patterns that transfer
 * 2. Unified Viral Score - Normalize views across platforms
 * 3. Temporal Pattern Sharing - Timing that works everywhere
 * 4. Niche Transfer Learning - Topics that work on multiple platforms
 */

const CROSS_PLATFORM_PATH = '/app/data/cross_platform_intelligence.json';

// Platform normalization factors (relative average views)
// Used to compare performance across platforms with different scales
const PLATFORM_NORMALIZATION = {
    youtube: 1.0,      // Baseline
    tiktok: 2.5,       // TikTok typically gets more views
    instagram: 1.2,    // Instagram similar to YouTube
    facebook: 0.8      // Facebook typically lower reach
};

// Minimum views to consider a video "successful"
const PLATFORM_SUCCESS_THRESHOLD = {
    youtube: 1000,
    tiktok: 5000,
    instagram: 2000,
    facebook: 1000
};

/**
 * Load cross-platform intelligence data
 */
const loadCrossPlatformData = () => {
    // Use dataAccess for unified data access
    const data = dataAccess.readJsonFileSync('cross_platform_intelligence.json');
    if (data) return data;

    try {
        if (fs.existsSync(CROSS_PLATFORM_PATH)) {
            return JSON.parse(fs.readFileSync(CROSS_PLATFORM_PATH, 'utf8'));
        }
    } catch (err) {
        console.error('Failed to load cross-platform data:', err.message);
    }
    return {
        patterns: [],
        crossoverSuccesses: [],
        nichePerformance: {},
        temporalPatterns: {},
        unifiedScores: [],
        lastUpdated: null
    };
};

/**
 * Save cross-platform intelligence data
 */
const saveCrossPlatformData = async (data) => {
    data.lastUpdated = new Date().toISOString();
    try {
        // Use dataAccess for unified data access
        await dataAccess.writeJsonFile('cross_platform_intelligence.json', data);
    } catch (err) {
        // Fallback to legacy path
        try {
            const dir = path.dirname(CROSS_PLATFORM_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(CROSS_PLATFORM_PATH, JSON.stringify(data, null, 2));
        } catch (writeErr) {
            console.error('Failed to save cross-platform data:', writeErr.message);
        }
    }
};

/**
 * Calculate unified viral score (0-10 scale)
 * Normalizes views across platforms for comparison
 */
export const calculateUnifiedScore = (views, platform, avgChannelViews = 1000) => {
    const normFactor = PLATFORM_NORMALIZATION[platform] || 1.0;
    const successThreshold = PLATFORM_SUCCESS_THRESHOLD[platform] || 1000;

    // Normalize views
    const normalizedViews = views / normFactor;

    // Calculate relative performance (vs channel average)
    const relativePerformance = views / avgChannelViews;

    // Calculate absolute performance (vs platform success threshold)
    const absolutePerformance = views / successThreshold;

    // Combined score (0-10)
    // Uses log scale to handle viral outliers
    const logScore = Math.log10(Math.max(normalizedViews, 1)) / Math.log10(10000000) * 10;
    const relativeScore = Math.min(10, relativePerformance);
    const absoluteScore = Math.min(10, absolutePerformance * 2);

    // Weighted average
    const unifiedScore = (logScore * 0.3) + (relativeScore * 0.4) + (absoluteScore * 0.3);

    return {
        score: Math.round(Math.min(10, Math.max(0, unifiedScore)) * 10) / 10,
        normalizedViews,
        relativePerformance: relativePerformance.toFixed(2) + 'x',
        rating: unifiedScore >= 8 ? 'viral' :
                unifiedScore >= 6 ? 'excellent' :
                unifiedScore >= 4 ? 'good' :
                unifiedScore >= 2 ? 'average' : 'below_average'
    };
};

/**
 * Record video performance for cross-platform learning
 */
export const recordCrossPlatformPerformance = (videoData) => {
    const {
        videoId,
        platform,
        topic,
        niche,
        hookType,
        visualTheme,
        duration,
        views,
        retention,
        avgChannelViews = 1000,
        postedAt
    } = videoData;

    const data = loadCrossPlatformData();

    // Calculate unified score
    const unifiedScoreData = calculateUnifiedScore(views, platform, avgChannelViews);

    // Record pattern
    const pattern = {
        videoId,
        platform,
        topic: normalizeTopicForComparison(topic),
        niche,
        hookType,
        visualTheme,
        duration,
        views,
        retention,
        unifiedScore: unifiedScoreData.score,
        rating: unifiedScoreData.rating,
        hour: postedAt ? new Date(postedAt).getHours() : null,
        dayOfWeek: postedAt ? new Date(postedAt).getDay() : null,
        recordedAt: new Date().toISOString()
    };

    data.patterns.push(pattern);
    if (data.patterns.length > 1000) {
        data.patterns = data.patterns.slice(-1000);
    }

    // Track niche performance
    if (!data.nichePerformance[niche]) {
        data.nichePerformance[niche] = {
            platforms: {},
            totalVideos: 0,
            avgScore: 0
        };
    }
    const nicheData = data.nichePerformance[niche];
    nicheData.totalVideos++;
    nicheData.avgScore = ((nicheData.avgScore * (nicheData.totalVideos - 1)) + unifiedScoreData.score) / nicheData.totalVideos;

    if (!nicheData.platforms[platform]) {
        nicheData.platforms[platform] = { videos: 0, totalScore: 0, avgScore: 0 };
    }
    nicheData.platforms[platform].videos++;
    nicheData.platforms[platform].totalScore += unifiedScoreData.score;
    nicheData.platforms[platform].avgScore = nicheData.platforms[platform].totalScore / nicheData.platforms[platform].videos;

    // Track temporal patterns if time info available
    if (pattern.hour !== null) {
        const timeKey = `${pattern.hour}:00`;
        if (!data.temporalPatterns[timeKey]) {
            data.temporalPatterns[timeKey] = { videos: 0, totalScore: 0, platforms: {} };
        }
        data.temporalPatterns[timeKey].videos++;
        data.temporalPatterns[timeKey].totalScore += unifiedScoreData.score;
        data.temporalPatterns[timeKey].platforms[platform] = (data.temporalPatterns[timeKey].platforms[platform] || 0) + 1;
    }

    // Add to unified scores for trend analysis
    data.unifiedScores.push({
        score: unifiedScoreData.score,
        platform,
        niche,
        timestamp: new Date().toISOString()
    });
    if (data.unifiedScores.length > 500) {
        data.unifiedScores = data.unifiedScores.slice(-500);
    }

    saveCrossPlatformData(data);

    // Check for crossover opportunities
    if (unifiedScoreData.score >= 6) {
        detectCrossoverOpportunity(pattern, data);
    }

    return {
        ...unifiedScoreData,
        pattern
    };
};

/**
 * Normalize topic text for comparison across platforms
 */
const normalizeTopicForComparison = (topic) => {
    if (!topic) return '';

    // Remove platform-specific prefixes/hashtags
    let normalized = topic.toLowerCase()
        .replace(/^(pov:|storytime:|hot take:|unpopular opinion:)/gi, '')
        .replace(/#\w+/g, '') // Remove hashtags
        .trim();

    // Extract key words (nouns, verbs)
    const keyWords = normalized.split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 5);

    return keyWords.join(' ');
};

/**
 * Detect if a successful pattern should be tested on other platforms
 */
const detectCrossoverOpportunity = (pattern, data) => {
    // Find similar successful patterns on other platforms
    const similarPatterns = data.patterns.filter(p =>
        p.platform !== pattern.platform &&
        p.niche === pattern.niche &&
        p.unifiedScore >= 5 &&
        areSimilarTopics(p.topic, pattern.topic)
    );

    if (similarPatterns.length > 0) {
        // Pattern already works on other platforms!
        const successfulPlatforms = [...new Set(similarPatterns.map(p => p.platform))];

        data.crossoverSuccesses.push({
            sourcePattern: pattern,
            successfulOn: successfulPlatforms,
            detectedAt: new Date().toISOString()
        });

        if (data.crossoverSuccesses.length > 100) {
            data.crossoverSuccesses = data.crossoverSuccesses.slice(-100);
        }

        saveCrossPlatformData(data);

        console.log(`🌐 Cross-platform winner detected!`);
        console.log(`   Topic pattern works on: ${[pattern.platform, ...successfulPlatforms].join(', ')}`);
    }
};

/**
 * Check if two topics are similar enough to be considered the same pattern
 */
const areSimilarTopics = (topic1, topic2) => {
    if (!topic1 || !topic2) return false;

    const words1 = new Set(topic1.split(/\s+/));
    const words2 = new Set(topic2.split(/\s+/));

    // Calculate Jaccard similarity
    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;

    const similarity = intersection / union;
    return similarity >= 0.4; // 40% word overlap
};

/**
 * Get cross-platform recommendations for a niche
 */
export const getCrossPlatformRecommendations = (niche) => {
    const data = loadCrossPlatformData();

    const nicheData = data.nichePerformance[niche];
    if (!nicheData) {
        return {
            niche,
            recommendation: 'Not enough data for this niche yet',
            platforms: {}
        };
    }

    // Sort platforms by average score for this niche
    const platformRanking = Object.entries(nicheData.platforms)
        .filter(([_, p]) => p.videos >= 3)
        .map(([platform, p]) => ({
            platform,
            avgScore: p.avgScore,
            videos: p.videos
        }))
        .sort((a, b) => b.avgScore - a.avgScore);

    // Find crossover successes for this niche
    const crossoverPatterns = data.crossoverSuccesses
        .filter(c => c.sourcePattern.niche === niche)
        .slice(-5);

    return {
        niche,
        overallScore: nicheData.avgScore.toFixed(1),
        totalVideos: nicheData.totalVideos,
        bestPlatforms: platformRanking.slice(0, 2),
        worstPlatforms: platformRanking.slice(-2).reverse(),
        crossoverSuccesses: crossoverPatterns.length,
        recommendation: platformRanking.length > 0
            ? `"${niche}" performs best on ${platformRanking[0].platform} (score: ${platformRanking[0].avgScore.toFixed(1)})`
            : 'Continue experimenting across platforms'
    };
};

/**
 * Get best posting times based on cross-platform data
 */
export const getBestPostingTimes = (platform = null) => {
    const data = loadCrossPlatformData();

    let timePatterns = Object.entries(data.temporalPatterns);

    // Filter by platform if specified
    if (platform) {
        timePatterns = timePatterns.filter(([_, t]) =>
            (t.platforms[platform] || 0) >= 2
        );
    }

    // Calculate average score per time
    const timeScores = timePatterns
        .filter(([_, t]) => t.videos >= 3)
        .map(([time, t]) => ({
            time,
            avgScore: t.totalScore / t.videos,
            videos: t.videos
        }))
        .sort((a, b) => b.avgScore - a.avgScore);

    return {
        bestTimes: timeScores.slice(0, 3),
        worstTimes: timeScores.slice(-3).reverse(),
        recommendation: timeScores.length > 0
            ? `Best posting time: ${timeScores[0].time} (score: ${timeScores[0].avgScore.toFixed(1)})`
            : 'Not enough data to determine optimal posting times'
    };
};

/**
 * Find patterns that work on multiple platforms
 */
export const getUniversalWinners = () => {
    const data = loadCrossPlatformData();

    // Group patterns by normalized topic
    const topicGroups = {};
    data.patterns.forEach(p => {
        if (p.unifiedScore < 5) return; // Only consider successful videos

        const key = `${p.niche}:${p.topic}`;
        if (!topicGroups[key]) {
            topicGroups[key] = {
                niche: p.niche,
                topic: p.topic,
                platforms: new Set(),
                avgScore: 0,
                videos: []
            };
        }
        topicGroups[key].platforms.add(p.platform);
        topicGroups[key].videos.push(p);
    });

    // Find patterns successful on 2+ platforms
    const universalWinners = Object.values(topicGroups)
        .filter(g => g.platforms.size >= 2)
        .map(g => {
            const avgScore = g.videos.reduce((sum, v) => sum + v.unifiedScore, 0) / g.videos.length;
            return {
                niche: g.niche,
                pattern: g.topic,
                platforms: [...g.platforms],
                avgScore,
                videoCount: g.videos.length
            };
        })
        .sort((a, b) => b.avgScore - a.avgScore);

    return {
        count: universalWinners.length,
        topPatterns: universalWinners.slice(0, 10),
        recommendation: universalWinners.length > 0
            ? `Found ${universalWinners.length} patterns that work across platforms!`
            : 'Continue creating content to find universal winners'
    };
};

/**
 * Suggest which platform to try a topic on based on crossover data
 */
export const suggestPlatformForTopic = (niche, topic) => {
    const data = loadCrossPlatformData();
    const normalizedTopic = normalizeTopicForComparison(topic);

    // Find similar successful patterns
    const similarSuccesses = data.patterns.filter(p =>
        p.unifiedScore >= 5 &&
        (p.niche === niche || areSimilarTopics(p.topic, normalizedTopic))
    );

    if (similarSuccesses.length === 0) {
        return {
            suggestion: 'No similar patterns found - try YouTube first (largest reach)',
            confidence: 'low',
            basedOn: 0
        };
    }

    // Count successes by platform
    const platformCounts = {};
    similarSuccesses.forEach(p => {
        platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
    });

    const sortedPlatforms = Object.entries(platformCounts)
        .sort((a, b) => b[1] - a[1]);

    const bestPlatform = sortedPlatforms[0][0];
    const count = sortedPlatforms[0][1];

    return {
        suggestion: bestPlatform,
        confidence: count >= 5 ? 'high' : count >= 3 ? 'medium' : 'low',
        basedOn: count,
        alternatives: sortedPlatforms.slice(1, 3).map(([p]) => p)
    };
};

/**
 * Get intelligence summary
 */
export const getCrossPlatformSummary = () => {
    const data = loadCrossPlatformData();

    const platformStats = {};
    const platforms = ['youtube', 'tiktok', 'instagram', 'facebook'];

    platforms.forEach(platform => {
        const platformPatterns = data.patterns.filter(p => p.platform === platform);
        if (platformPatterns.length > 0) {
            platformStats[platform] = {
                videos: platformPatterns.length,
                avgScore: (platformPatterns.reduce((sum, p) => sum + p.unifiedScore, 0) / platformPatterns.length).toFixed(1)
            };
        }
    });

    const universalWinners = getUniversalWinners();

    return {
        totalPatterns: data.patterns.length,
        crossoverSuccesses: data.crossoverSuccesses.length,
        universalWinners: universalWinners.count,
        platformStats,
        bestTimes: getBestPostingTimes().bestTimes,
        topNiches: Object.entries(data.nichePerformance)
            .filter(([_, n]) => n.totalVideos >= 5)
            .map(([niche, n]) => ({ niche, score: n.avgScore, videos: n.totalVideos }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5),
        lastUpdated: data.lastUpdated
    };
};

export default {
    calculateUnifiedScore,
    recordCrossPlatformPerformance,
    getCrossPlatformRecommendations,
    getBestPostingTimes,
    getUniversalWinners,
    suggestPlatformForTopic,
    getCrossPlatformSummary,
    PLATFORM_NORMALIZATION,
    PLATFORM_SUCCESS_THRESHOLD
};
