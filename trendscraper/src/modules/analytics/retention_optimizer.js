import fs from 'fs';
import path from 'path';
import dataAccess from '../../utils/dataAccess.js';

/**
 * RETENTION OPTIMIZER
 *
 * Focuses on watch time and completion rate optimization
 * Key insight: Views don't matter if nobody watches
 *
 * Tracks:
 * - Average View Duration (AVD)
 * - Completion rate by scene position
 * - Drop-off points
 * - Re-watch indicators
 * - Hook effectiveness (first 3 seconds)
 *
 * Feeds back to:
 * - Storyboard generation (scene pacing)
 * - Hook selection (which hooks retain)
 * - CTA placement (where to ask for action)
 */

const RETENTION_DATA_PATH = '/app/data/retention_analytics.json';

// Platform-specific retention benchmarks
const PLATFORM_BENCHMARKS = {
    youtube: {
        goodRetention: 60,   // 60%+ is good
        viralRetention: 80,  // 80%+ signals viral potential
        criticalDropOff: 20, // If 20%+ drop in first 3s = bad hook
        avgDuration: 50      // Target seconds
    },
    tiktok: {
        goodRetention: 70,   // TikTok needs higher completion
        viralRetention: 90,  // Near-full watches for viral
        criticalDropOff: 30, // TikTok users swipe FAST
        avgDuration: 30      // Shorter is better
    },
    instagram: {
        goodRetention: 65,
        viralRetention: 85,
        criticalDropOff: 25,
        avgDuration: 45
    },
    facebook: {
        goodRetention: 55,   // Lower bar, older audience
        viralRetention: 75,
        criticalDropOff: 20,
        avgDuration: 60
    }
};

/**
 * Load retention data
 */
const loadRetentionData = () => {
    // Use dataAccess for unified data access
    const data = dataAccess.readJsonFileSync('retention_analytics.json');
    if (data) return data;

    try {
        if (fs.existsSync(RETENTION_DATA_PATH)) {
            return JSON.parse(fs.readFileSync(RETENTION_DATA_PATH, 'utf8'));
        }
    } catch (err) {
        console.error('Failed to load retention data:', err.message);
    }
    return {
        videos: [],
        patterns: {
            hooks: {},
            scenePositions: {},
            durations: {},
            dropOffPoints: []
        },
        insights: [],
        lastUpdated: null
    };
};

/**
 * Save retention data
 */
const saveRetentionData = async (data) => {
    data.lastUpdated = new Date().toISOString();
    try {
        // Use dataAccess for unified data access
        await dataAccess.writeJsonFile('retention_analytics.json', data);
    } catch (err) {
        // Fallback to legacy path
        try {
            const dir = path.dirname(RETENTION_DATA_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(RETENTION_DATA_PATH, JSON.stringify(data, null, 2));
        } catch (writeErr) {
            console.error('Failed to save retention data:', writeErr.message);
        }
    }
};

/**
 * Track retention metrics for a video
 */
export const trackVideoRetention = (videoData) => {
    const data = loadRetentionData();

    const {
        videoId,
        platform,
        hookType,
        duration,
        avgWatchPercent,
        avgWatchTime,
        completionRate,
        views,
        retentionCurve = [], // Array of [timestamp, percentage] pairs
        niche
    } = videoData;

    // Store video data
    const videoRecord = {
        videoId,
        platform,
        hookType,
        duration,
        avgWatchPercent: avgWatchPercent || 0,
        avgWatchTime: avgWatchTime || 0,
        completionRate: completionRate || 0,
        views: views || 0,
        niche,
        timestamp: new Date().toISOString(),
        retentionCurve
    };

    data.videos.push(videoRecord);
    if (data.videos.length > 500) {
        data.videos = data.videos.slice(-500); // Keep last 500
    }

    // Update hook patterns
    if (hookType) {
        if (!data.patterns.hooks[hookType]) {
            data.patterns.hooks[hookType] = {
                attempts: 0,
                totalRetention: 0,
                avgRetention: 0,
                completions: 0,
                platforms: {}
            };
        }
        const hook = data.patterns.hooks[hookType];
        hook.attempts++;
        hook.totalRetention += avgWatchPercent || 0;
        hook.avgRetention = hook.totalRetention / hook.attempts;
        if (completionRate > 70) hook.completions++;
        hook.platforms[platform] = (hook.platforms[platform] || 0) + 1;
    }

    // Update duration patterns
    const durationBucket = Math.floor(duration / 10) * 10; // 10s buckets
    const durationKey = `${durationBucket}-${durationBucket + 10}s`;
    if (!data.patterns.durations[durationKey]) {
        data.patterns.durations[durationKey] = {
            attempts: 0,
            totalRetention: 0,
            avgRetention: 0,
            platforms: {}
        };
    }
    const durationData = data.patterns.durations[durationKey];
    durationData.attempts++;
    durationData.totalRetention += avgWatchPercent || 0;
    durationData.avgRetention = durationData.totalRetention / durationData.attempts;
    durationData.platforms[platform] = (durationData.platforms[platform] || 0) + 1;

    // Analyze retention curve for drop-off points
    if (retentionCurve && retentionCurve.length > 1) {
        const dropOffs = analyzeDropOffs(retentionCurve);
        dropOffs.forEach(dropOff => {
            data.patterns.dropOffPoints.push({
                ...dropOff,
                videoId,
                platform,
                hookType,
                timestamp: new Date().toISOString()
            });
        });
        // Keep last 200 drop-off records
        if (data.patterns.dropOffPoints.length > 200) {
            data.patterns.dropOffPoints = data.patterns.dropOffPoints.slice(-200);
        }
    }

    saveRetentionData(data);
    return videoRecord;
};

/**
 * Analyze retention curve for drop-off points
 */
const analyzeDropOffs = (retentionCurve) => {
    const dropOffs = [];

    for (let i = 1; i < retentionCurve.length; i++) {
        const prev = retentionCurve[i - 1];
        const curr = retentionCurve[i];

        const drop = prev[1] - curr[1]; // Percentage drop
        const timestamp = curr[0];

        // Significant drop = 10%+ in a single segment
        if (drop >= 10) {
            dropOffs.push({
                timestamp,
                dropPercent: drop,
                retentionAt: curr[1],
                severity: drop >= 20 ? 'critical' : 'significant'
            });
        }
    }

    return dropOffs;
};

/**
 * Get optimal video duration for a platform
 */
export const getOptimalDuration = (platform) => {
    const data = loadRetentionData();
    const durations = data.patterns.durations;

    // Filter for this platform
    const platformDurations = Object.entries(durations)
        .filter(([_, d]) => d.platforms[platform] >= 3) // Need 3+ samples
        .map(([key, d]) => ({
            range: key,
            avgRetention: d.avgRetention,
            attempts: d.platforms[platform]
        }))
        .sort((a, b) => b.avgRetention - a.avgRetention);

    if (platformDurations.length > 0) {
        return {
            recommended: platformDurations[0].range,
            avgRetention: platformDurations[0].avgRetention,
            alternatives: platformDurations.slice(1, 3),
            reason: 'learned_from_performance'
        };
    }

    // Fallback to platform defaults
    const benchmark = PLATFORM_BENCHMARKS[platform] || PLATFORM_BENCHMARKS.youtube;
    return {
        recommended: `${benchmark.avgDuration - 10}-${benchmark.avgDuration}s`,
        avgRetention: benchmark.goodRetention,
        alternatives: [],
        reason: 'platform_default'
    };
};

/**
 * Get best performing hooks by retention
 */
export const getBestRetentionHooks = (platform = null) => {
    const data = loadRetentionData();
    const hooks = data.patterns.hooks;

    let hookList = Object.entries(hooks);

    // Filter by platform if specified
    if (platform) {
        hookList = hookList.filter(([_, h]) => (h.platforms[platform] || 0) >= 2);
    }

    // Sort by average retention
    hookList = hookList
        .filter(([_, h]) => h.attempts >= 3) // Need enough data
        .map(([name, h]) => ({
            name,
            avgRetention: h.avgRetention,
            completionRate: h.completions / h.attempts * 100,
            attempts: h.attempts
        }))
        .sort((a, b) => b.avgRetention - a.avgRetention);

    return {
        best: hookList.slice(0, 3),
        worst: hookList.slice(-3).reverse(),
        total: hookList.length
    };
};

/**
 * Identify common drop-off points across videos
 */
export const getCommonDropOffs = (platform = null) => {
    const data = loadRetentionData();
    let dropOffs = data.patterns.dropOffPoints || [];

    if (platform) {
        dropOffs = dropOffs.filter(d => d.platform === platform);
    }

    // Group by timestamp bucket (5 second intervals)
    const buckets = {};
    dropOffs.forEach(d => {
        const bucket = Math.floor(d.timestamp / 5) * 5; // 5s buckets
        if (!buckets[bucket]) {
            buckets[bucket] = { count: 0, totalDrop: 0, critical: 0 };
        }
        buckets[bucket].count++;
        buckets[bucket].totalDrop += d.dropPercent;
        if (d.severity === 'critical') buckets[bucket].critical++;
    });

    // Find problematic time ranges
    const problematicRanges = Object.entries(buckets)
        .filter(([_, b]) => b.count >= 3) // Need pattern
        .map(([time, b]) => ({
            timeRange: `${time}-${parseInt(time) + 5}s`,
            frequency: b.count,
            avgDrop: b.totalDrop / b.count,
            criticalCount: b.critical
        }))
        .sort((a, b) => b.frequency - a.frequency);

    return {
        problematicRanges: problematicRanges.slice(0, 5),
        recommendation: problematicRanges.length > 0
            ? `Videos often lose viewers at ${problematicRanges[0].timeRange}. Consider adjusting pacing before this point.`
            : 'Not enough data to identify patterns yet.'
    };
};

/**
 * Get storyboard optimization recommendations
 */
export const getStoryboardRecommendations = (platform) => {
    const benchmark = PLATFORM_BENCHMARKS[platform] || PLATFORM_BENCHMARKS.youtube;
    const optimalDuration = getOptimalDuration(platform);
    const bestHooks = getBestRetentionHooks(platform);
    const dropOffs = getCommonDropOffs(platform);

    const recommendations = [];

    // Duration recommendation
    if (optimalDuration.reason === 'learned_from_performance') {
        recommendations.push({
            type: 'duration',
            priority: 'high',
            recommendation: `Target ${optimalDuration.recommended} duration (${optimalDuration.avgRetention.toFixed(0)}% retention)`
        });
    } else {
        recommendations.push({
            type: 'duration',
            priority: 'medium',
            recommendation: `Platform default: ~${benchmark.avgDuration}s videos`
        });
    }

    // Hook recommendation
    if (bestHooks.best.length > 0) {
        recommendations.push({
            type: 'hook',
            priority: 'high',
            recommendation: `Use "${bestHooks.best[0].name}" hooks (${bestHooks.best[0].avgRetention.toFixed(0)}% retention)`
        });
    }

    // Pacing recommendation from drop-offs
    if (dropOffs.problematicRanges.length > 0) {
        recommendations.push({
            type: 'pacing',
            priority: 'high',
            recommendation: dropOffs.recommendation
        });
    }

    // General platform-specific tips
    recommendations.push({
        type: 'general',
        priority: 'low',
        recommendation: `Target ${benchmark.goodRetention}%+ retention for good performance, ${benchmark.viralRetention}%+ for viral potential`
    });

    return {
        platform,
        recommendations,
        benchmarks: benchmark,
        optimalDuration,
        bestHooks: bestHooks.best.slice(0, 2),
        worstHooks: bestHooks.worst.slice(0, 2)
    };
};

/**
 * Calculate retention score for a video
 * Returns 0-100 score based on how well it retained viewers
 */
export const calculateRetentionScore = (videoMetrics, platform = 'youtube') => {
    const benchmark = PLATFORM_BENCHMARKS[platform] || PLATFORM_BENCHMARKS.youtube;

    const {
        avgWatchPercent = 0,
        completionRate = 0,
        firstThreeSecondRetention = 100 // If not available, assume 100%
    } = videoMetrics;

    // Component scores (0-100 each)
    let retentionScore = Math.min(100, (avgWatchPercent / benchmark.viralRetention) * 100);
    let completionScore = Math.min(100, (completionRate / 100) * 100);
    let hookScore = firstThreeSecondRetention >= (100 - benchmark.criticalDropOff) ? 100 : 50;

    // Weighted average
    // Hook is most important (40%), retention (35%), completion (25%)
    const finalScore = (hookScore * 0.4) + (retentionScore * 0.35) + (completionScore * 0.25);

    return {
        score: Math.round(finalScore),
        breakdown: {
            hook: Math.round(hookScore),
            retention: Math.round(retentionScore),
            completion: Math.round(completionScore)
        },
        rating: finalScore >= 80 ? 'excellent' :
                finalScore >= 60 ? 'good' :
                finalScore >= 40 ? 'average' : 'needs_improvement',
        suggestions: getSuggestions(hookScore, retentionScore, completionScore)
    };
};

/**
 * Get improvement suggestions based on scores
 */
const getSuggestions = (hookScore, retentionScore, completionScore) => {
    const suggestions = [];

    if (hookScore < 70) {
        suggestions.push('Hook is weak - try more pattern-interrupt opening');
    }
    if (retentionScore < 60) {
        suggestions.push('Mid-video drop-off - improve pacing or add more engaging content');
    }
    if (completionScore < 50) {
        suggestions.push('Low completion - video may be too long or CTA is weak');
    }

    if (suggestions.length === 0) {
        suggestions.push('Performance is good! Consider A/B testing variations to optimize further.');
    }

    return suggestions;
};

/**
 * Get retention analytics summary
 */
export const getRetentionSummary = () => {
    const data = loadRetentionData();

    const platformStats = {};
    const platforms = ['youtube', 'tiktok', 'instagram', 'facebook'];

    platforms.forEach(platform => {
        const platformVideos = data.videos.filter(v => v.platform === platform);
        if (platformVideos.length > 0) {
            const avgRetention = platformVideos.reduce((sum, v) => sum + (v.avgWatchPercent || 0), 0) / platformVideos.length;
            const avgCompletion = platformVideos.reduce((sum, v) => sum + (v.completionRate || 0), 0) / platformVideos.length;

            platformStats[platform] = {
                videos: platformVideos.length,
                avgRetention: avgRetention.toFixed(1),
                avgCompletion: avgCompletion.toFixed(1),
                benchmark: PLATFORM_BENCHMARKS[platform]
            };
        }
    });

    return {
        totalVideos: data.videos.length,
        platformStats,
        bestHooks: getBestRetentionHooks().best,
        commonDropOffs: getCommonDropOffs().problematicRanges,
        lastUpdated: data.lastUpdated
    };
};

export default {
    trackVideoRetention,
    getOptimalDuration,
    getBestRetentionHooks,
    getCommonDropOffs,
    getStoryboardRecommendations,
    calculateRetentionScore,
    getRetentionSummary,
    PLATFORM_BENCHMARKS
};
