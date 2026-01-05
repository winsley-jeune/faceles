/**
 * PERFORMANCE WEIGHTS SYSTEM
 *
 * The brain of the viral optimization system.
 * Tracks performance of ALL content variables and weights future selections.
 *
 * KEY PRINCIPLES:
 * 1. Winners get 3x probability in selection
 * 2. Auto-kill patterns with <10% success after 10 attempts
 * 3. Platform-specific weights (what works on TikTok may not work on YouTube)
 * 4. Rolling 30-day windows to stay current
 * 5. Weighted random selection (not pure random)
 */

import dataService from '../../services/dataService.js';

// ============================================================
// DEFAULT WEIGHTS STRUCTURE
// ============================================================

const DEFAULT_WEIGHTS = {
    version: '2.0.0',
    lastUpdated: null,

    // Platform-specific variable performance
    platforms: {
        youtube: { variables: {}, hooks: {}, templates: {}, themes: {}, durations: {} },
        tiktok: { variables: {}, hooks: {}, templates: {}, themes: {}, durations: {} },
        instagram: { variables: {}, hooks: {}, templates: {}, themes: {}, durations: {} },
        facebook: { variables: {}, hooks: {}, templates: {}, themes: {}, durations: {} }
    },

    // Cross-platform aggregate
    global: {
        variables: {},
        hooks: {},
        templates: {},
        themes: {}
    },

    // Kill list - patterns that consistently fail
    killed: {
        youtube: [],
        tiktok: [],
        instagram: [],
        facebook: [],
        global: []
    },

    // Winning combinations discovered
    winningCombos: [],

    // A/B test tracking
    experiments: {}
};

// ============================================================
// THRESHOLDS & CONFIG
// ============================================================

const CONFIG = {
    // Weight multipliers
    WINNER_MULTIPLIER: 3,       // Winners get 3x selection probability
    VIRAL_MULTIPLIER: 5,        // Viral hits get 5x probability
    FLOP_PENALTY: 0.3,          // Flops get 0.3x probability

    // Performance thresholds
    MIN_ATTEMPTS_FOR_KILL: 10,  // Need 10 attempts before killing a pattern
    KILL_THRESHOLD: 0.10,       // Kill if <10% success rate
    WINNER_THRESHOLD_MULTIPLIER: 1.5,  // 1.5x channel avg = winner
    VIRAL_THRESHOLD_MULTIPLIER: 3,     // 3x channel avg = viral

    // Time windows
    ROLLING_WINDOW_DAYS: 30,    // Use last 30 days for weight calculation
    DECAY_FACTOR: 0.95,         // Older data decays by 5% per week

    // Weight bounds
    MIN_WEIGHT: 0.1,            // Minimum selection weight
    MAX_WEIGHT: 10,             // Maximum selection weight
    BASE_WEIGHT: 1,             // Starting weight for new items

    // Auto-expansion
    EXPAND_THRESHOLD: 5,        // Expand winning variables after 5 wins
    MAX_VARIATIONS: 50          // Maximum variations per variable type
};

// ============================================================
// CORE FUNCTIONS
// ============================================================

/**
 * Load performance weights for user
 */
export const loadWeights = async (userId) => {
    try {
        const data = await dataService.weights.getPerformanceWeights(userId);
        if (data) {
            return { ...DEFAULT_WEIGHTS, ...data };
        }
    } catch (err) {
        console.error('Failed to load performance weights:', err.message);
    }
    return { ...DEFAULT_WEIGHTS };
};

/**
 * Save performance weights for user
 */
const saveWeights = async (userId, weights) => {
    try {
        weights.lastUpdated = new Date().toISOString();
        await dataService.weights.savePerformanceWeights(userId, weights);
    } catch (err) {
        console.error('Failed to save performance weights:', err.message);
    }
};

/**
 * Calculate the current weight for an item based on performance
 */
const calculateWeight = (stats, channelAvg) => {
    if (!stats || stats.attempts === 0) return CONFIG.BASE_WEIGHT;

    const winnerThreshold = channelAvg * CONFIG.WINNER_THRESHOLD_MULTIPLIER;
    const viralThreshold = channelAvg * CONFIG.VIRAL_THRESHOLD_MULTIPLIER;

    // Calculate success metrics
    const winRate = stats.wins / stats.attempts;
    const viralRate = stats.viralHits / stats.attempts;
    const avgViewsWhenUsed = stats.totalViews / stats.attempts;

    // Base weight from win rate
    let weight = CONFIG.BASE_WEIGHT;

    // Boost for high win rate
    if (winRate >= 0.5) {
        weight *= CONFIG.WINNER_MULTIPLIER;
    } else if (winRate >= 0.3) {
        weight *= 1.5;
    } else if (winRate < CONFIG.KILL_THRESHOLD && stats.attempts >= CONFIG.MIN_ATTEMPTS_FOR_KILL) {
        weight *= CONFIG.FLOP_PENALTY;
    }

    // Additional boost for viral hits
    if (viralRate >= 0.2) {
        weight *= CONFIG.VIRAL_MULTIPLIER;
    } else if (viralRate >= 0.1) {
        weight *= 2;
    }

    // Bonus for consistently high views
    if (avgViewsWhenUsed >= viralThreshold) {
        weight *= 1.5;
    } else if (avgViewsWhenUsed >= winnerThreshold) {
        weight *= 1.2;
    }

    // Apply time decay based on last success
    if (stats.lastSuccess) {
        const daysSinceSuccess = (Date.now() - new Date(stats.lastSuccess).getTime()) / (1000 * 60 * 60 * 24);
        const weeks = Math.floor(daysSinceSuccess / 7);
        weight *= Math.pow(CONFIG.DECAY_FACTOR, weeks);
    }

    // Clamp to bounds
    return Math.max(CONFIG.MIN_WEIGHT, Math.min(CONFIG.MAX_WEIGHT, weight));
};

// ============================================================
// TRACKING FUNCTIONS
// ============================================================

/**
 * Track usage of a variable (person, action, outcome, etc.)
 */
export const trackVariableUsage = async (userId, platform, variableType, variableValue, performance, channelAvg) => {
    const weights = await loadWeights(userId);
    const platformData = weights.platforms[platform] || { variables: {} };

    if (!platformData.variables[variableType]) {
        platformData.variables[variableType] = {};
    }

    const varStats = platformData.variables[variableType][variableValue] || {
        value: variableValue,
        attempts: 0,
        wins: 0,
        viralHits: 0,
        totalViews: 0,
        maxViews: 0,
        lastUsed: null,
        lastSuccess: null,
        createdAt: new Date().toISOString()
    };

    const views = performance?.views || 0;
    const winnerThreshold = channelAvg * CONFIG.WINNER_THRESHOLD_MULTIPLIER;
    const viralThreshold = channelAvg * CONFIG.VIRAL_THRESHOLD_MULTIPLIER;

    varStats.attempts++;
    varStats.totalViews += views;
    varStats.lastUsed = new Date().toISOString();

    if (views > varStats.maxViews) {
        varStats.maxViews = views;
    }

    if (views >= winnerThreshold) {
        varStats.wins++;
        varStats.lastSuccess = new Date().toISOString();
    }

    if (views >= viralThreshold) {
        varStats.viralHits++;
    }

    // Calculate new weight
    varStats.weight = calculateWeight(varStats, channelAvg);

    platformData.variables[variableType][variableValue] = varStats;
    weights.platforms[platform] = platformData;

    // Also update global
    if (!weights.global.variables[variableType]) {
        weights.global.variables[variableType] = {};
    }
    const globalStats = weights.global.variables[variableType][variableValue] || { ...varStats };
    globalStats.attempts++;
    globalStats.totalViews += views;
    if (views >= winnerThreshold) globalStats.wins++;
    if (views >= viralThreshold) globalStats.viralHits++;
    globalStats.weight = calculateWeight(globalStats, channelAvg);
    weights.global.variables[variableType][variableValue] = globalStats;

    await saveWeights(userId, weights);
    return varStats;
};

/**
 * Track hook pattern performance
 */
export const trackHookPerformance = async (userId, platform, hookType, performance, channelAvg) => {
    const weights = await loadWeights(userId);
    const platformData = weights.platforms[platform] || { hooks: {} };

    if (!platformData.hooks) platformData.hooks = {};

    const hookStats = platformData.hooks[hookType] || {
        name: hookType,
        attempts: 0,
        wins: 0,
        viralHits: 0,
        totalViews: 0,
        maxViews: 0,
        examples: [],
        lastUsed: null,
        lastSuccess: null,
        createdAt: new Date().toISOString()
    };

    const views = performance?.views || 0;
    const topic = performance?.topic || '';
    const winnerThreshold = channelAvg * CONFIG.WINNER_THRESHOLD_MULTIPLIER;
    const viralThreshold = channelAvg * CONFIG.VIRAL_THRESHOLD_MULTIPLIER;

    hookStats.attempts++;
    hookStats.totalViews += views;
    hookStats.lastUsed = new Date().toISOString();

    if (views > hookStats.maxViews) {
        hookStats.maxViews = views;
    }

    if (views >= winnerThreshold) {
        hookStats.wins++;
        hookStats.lastSuccess = new Date().toISOString();
        hookStats.examples.push({ topic, views, date: new Date().toISOString() });
        // Keep only top 10 examples
        hookStats.examples = hookStats.examples
            .sort((a, b) => b.views - a.views)
            .slice(0, 10);
    }

    if (views >= viralThreshold) {
        hookStats.viralHits++;
    }

    // Calculate weight
    hookStats.weight = calculateWeight(hookStats, channelAvg);

    // Check if should be killed
    if (hookStats.attempts >= CONFIG.MIN_ATTEMPTS_FOR_KILL) {
        const successRate = hookStats.wins / hookStats.attempts;
        if (successRate < CONFIG.KILL_THRESHOLD) {
            if (!weights.killed[platform].includes(hookType)) {
                weights.killed[platform].push(hookType);
                console.log(`   [KILL] Hook "${hookType}" killed on ${platform} (${Math.round(successRate * 100)}% success rate)`);
            }
        }
    }

    platformData.hooks[hookType] = hookStats;
    weights.platforms[platform] = platformData;
    await saveWeights(userId, weights);

    return hookStats;
};

/**
 * Track template performance
 */
export const trackTemplatePerformance = async (userId, platform, templateId, performance, channelAvg) => {
    const weights = await loadWeights(userId);
    const platformData = weights.platforms[platform] || { templates: {} };

    if (!platformData.templates) platformData.templates = {};

    const templateStats = platformData.templates[templateId] || {
        id: templateId,
        attempts: 0,
        wins: 0,
        viralHits: 0,
        totalViews: 0,
        maxViews: 0,
        createdAt: new Date().toISOString()
    };

    const views = performance?.views || 0;
    const winnerThreshold = channelAvg * CONFIG.WINNER_THRESHOLD_MULTIPLIER;
    const viralThreshold = channelAvg * CONFIG.VIRAL_THRESHOLD_MULTIPLIER;

    templateStats.attempts++;
    templateStats.totalViews += views;

    if (views > templateStats.maxViews) templateStats.maxViews = views;
    if (views >= winnerThreshold) templateStats.wins++;
    if (views >= viralThreshold) templateStats.viralHits++;

    templateStats.weight = calculateWeight(templateStats, channelAvg);

    platformData.templates[templateId] = templateStats;
    weights.platforms[platform] = platformData;
    await saveWeights(userId, weights);

    return templateStats;
};

/**
 * Track visual theme performance
 */
export const trackThemePerformance = async (userId, platform, theme, performance, channelAvg) => {
    const weights = await loadWeights(userId);
    const platformData = weights.platforms[platform] || { themes: {} };

    if (!platformData.themes) platformData.themes = {};

    const themeStats = platformData.themes[theme] || {
        name: theme,
        attempts: 0,
        wins: 0,
        viralHits: 0,
        totalViews: 0,
        avgCompletionRate: 0,
        completionSamples: 0,
        createdAt: new Date().toISOString()
    };

    const views = performance?.views || 0;
    const completionRate = performance?.completionRate || 0;
    const winnerThreshold = channelAvg * CONFIG.WINNER_THRESHOLD_MULTIPLIER;
    const viralThreshold = channelAvg * CONFIG.VIRAL_THRESHOLD_MULTIPLIER;

    themeStats.attempts++;
    themeStats.totalViews += views;

    if (completionRate > 0) {
        // Running average of completion rate
        themeStats.avgCompletionRate = (
            (themeStats.avgCompletionRate * themeStats.completionSamples + completionRate) /
            (themeStats.completionSamples + 1)
        );
        themeStats.completionSamples++;
    }

    if (views >= winnerThreshold) themeStats.wins++;
    if (views >= viralThreshold) themeStats.viralHits++;

    themeStats.weight = calculateWeight(themeStats, channelAvg);

    platformData.themes[theme] = themeStats;
    weights.platforms[platform] = platformData;
    await saveWeights(userId, weights);

    return themeStats;
};

/**
 * Track video duration performance
 */
export const trackDurationPerformance = async (userId, platform, durationBucket, performance, channelAvg) => {
    const weights = await loadWeights(userId);
    const platformData = weights.platforms[platform] || { durations: {} };

    if (!platformData.durations) platformData.durations = {};

    const durationStats = platformData.durations[durationBucket] || {
        bucket: durationBucket,
        attempts: 0,
        wins: 0,
        viralHits: 0,
        totalViews: 0,
        avgCompletionRate: 0,
        completionSamples: 0,
        createdAt: new Date().toISOString()
    };

    const views = performance?.views || 0;
    const completionRate = performance?.completionRate || 0;
    const winnerThreshold = channelAvg * CONFIG.WINNER_THRESHOLD_MULTIPLIER;
    const viralThreshold = channelAvg * CONFIG.VIRAL_THRESHOLD_MULTIPLIER;

    durationStats.attempts++;
    durationStats.totalViews += views;

    if (completionRate > 0) {
        durationStats.avgCompletionRate = (
            (durationStats.avgCompletionRate * durationStats.completionSamples + completionRate) /
            (durationStats.completionSamples + 1)
        );
        durationStats.completionSamples++;
    }

    if (views >= winnerThreshold) durationStats.wins++;
    if (views >= viralThreshold) durationStats.viralHits++;

    durationStats.weight = calculateWeight(durationStats, channelAvg);

    platformData.durations[durationBucket] = durationStats;
    weights.platforms[platform] = platformData;
    await saveWeights(userId, weights);

    return durationStats;
};

// ============================================================
// WEIGHTED SELECTION FUNCTIONS
// ============================================================

/**
 * Select an item from array using performance weights
 * This is the KEY function that replaces Math.random()
 */
export const weightedSelect = async (userId, items, platform, category, channelAvg = 1000) => {
    if (!items || items.length === 0) return null;

    const weights = await loadWeights(userId);
    const platformData = weights.platforms[platform] || {};
    const categoryData = platformData[category] || {};
    const killedItems = weights.killed[platform] || [];

    // Filter out killed items
    const aliveItems = items.filter(item => {
        const itemKey = typeof item === 'string' ? item : item.name || item.id || item;
        return !killedItems.includes(itemKey);
    });

    if (aliveItems.length === 0) {
        // All items killed, reset and try again
        console.log(`   [RESET] All ${category} items killed on ${platform}, resetting...`);
        weights.killed[platform] = [];
        await saveWeights(userId, weights);
        return items[Math.floor(Math.random() * items.length)];
    }

    // Calculate weights for each item
    const itemWeights = aliveItems.map(item => {
        const itemKey = typeof item === 'string' ? item : item.name || item.id || item;
        const stats = categoryData[itemKey];
        const weight = stats?.weight || CONFIG.BASE_WEIGHT;
        return { item, weight };
    });

    // Calculate total weight
    const totalWeight = itemWeights.reduce((sum, iw) => sum + iw.weight, 0);

    // Weighted random selection
    let random = Math.random() * totalWeight;
    for (const iw of itemWeights) {
        random -= iw.weight;
        if (random <= 0) {
            return iw.item;
        }
    }

    // Fallback
    return aliveItems[aliveItems.length - 1];
};

/**
 * Select a variable value using weights
 */
export const selectWeightedVariable = async (userId, variableType, values, platform = 'youtube', channelAvg = 1000) => {
    const weights = await loadWeights(userId);
    const platformData = weights.platforms[platform]?.variables?.[variableType] || {};

    // Calculate weights for each value
    const itemWeights = values.map(value => {
        const stats = platformData[value];
        const weight = stats?.weight || CONFIG.BASE_WEIGHT;
        return { value, weight };
    });

    // Calculate total weight
    const totalWeight = itemWeights.reduce((sum, iw) => sum + iw.weight, 0);

    // Weighted random selection
    let random = Math.random() * totalWeight;
    for (const iw of itemWeights) {
        random -= iw.weight;
        if (random <= 0) {
            return iw.value;
        }
    }

    // Fallback
    return values[Math.floor(Math.random() * values.length)];
};

/**
 * Select best hook pattern for platform
 */
export const selectBestHook = async (userId, hookPatterns, platform = 'youtube') => {
    const weights = await loadWeights(userId);
    const platformHooks = weights.platforms[platform]?.hooks || {};
    const killedHooks = weights.killed[platform] || [];

    // Get hook names
    const hookNames = Object.keys(hookPatterns).filter(h => !killedHooks.includes(h));

    if (hookNames.length === 0) {
        // Reset killed hooks if all are killed
        weights.killed[platform] = [];
        await saveWeights(userId, weights);
        return Object.keys(hookPatterns)[0];
    }

    // Sort by weight (descending)
    const sortedHooks = hookNames
        .map(name => ({
            name,
            weight: platformHooks[name]?.weight || CONFIG.BASE_WEIGHT,
            stats: platformHooks[name]
        }))
        .sort((a, b) => b.weight - a.weight);

    // 80% chance to pick from top 3, 20% chance to explore
    if (Math.random() < 0.8 && sortedHooks.length >= 3) {
        const topHooks = sortedHooks.slice(0, 3);
        const totalWeight = topHooks.reduce((sum, h) => sum + h.weight, 0);
        let random = Math.random() * totalWeight;
        for (const h of topHooks) {
            random -= h.weight;
            if (random <= 0) return h.name;
        }
        return topHooks[0].name;
    }

    // Exploration: weighted selection from all
    return await weightedSelect(userId, hookNames, platform, 'hooks');
};

// ============================================================
// ANALYTICS & REPORTING
// ============================================================

/**
 * Get performance summary for a platform
 */
export const getPlatformSummary = async (userId, platform) => {
    const weights = await loadWeights(userId);
    const platformData = weights.platforms[platform] || {};

    const summary = {
        platform,
        hooks: Object.entries(platformData.hooks || {})
            .map(([name, stats]) => ({
                name,
                weight: stats.weight,
                winRate: stats.attempts > 0 ? Math.round((stats.wins / stats.attempts) * 100) : 0,
                viralRate: stats.attempts > 0 ? Math.round((stats.viralHits / stats.attempts) * 100) : 0,
                attempts: stats.attempts,
                maxViews: stats.maxViews
            }))
            .sort((a, b) => b.weight - a.weight),

        topVariables: {},
        killedPatterns: weights.killed[platform] || [],
        lastUpdated: weights.lastUpdated
    };

    // Get top variables per type
    for (const [varType, varData] of Object.entries(platformData.variables || {})) {
        summary.topVariables[varType] = Object.entries(varData)
            .map(([value, stats]) => ({ value, weight: stats.weight, wins: stats.wins }))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 5);
    }

    return summary;
};

/**
 * Get all killed patterns across platforms
 */
export const getKilledPatterns = async (userId) => {
    const weights = await loadWeights(userId);
    return weights.killed;
};

/**
 * Check if a pattern is killed on a platform
 */
export const isKilled = async (userId, pattern, platform = 'youtube') => {
    const weights = await loadWeights(userId);
    return (weights.killed[platform] || []).includes(pattern);
};

/**
 * Revive a killed pattern (for A/B testing or manual override)
 */
export const revivePattern = async (userId, pattern, platform = 'youtube') => {
    const weights = await loadWeights(userId);
    if (!weights.killed[platform]) weights.killed[platform] = [];

    const index = weights.killed[platform].indexOf(pattern);
    if (index > -1) {
        weights.killed[platform].splice(index, 1);
        console.log(`   [REVIVE] Pattern "${pattern}" revived on ${platform}`);
        await saveWeights(userId, weights);
        return true;
    }
    return false;
};

/**
 * Record a winning combination for future reference
 */
export const recordWinningCombo = async (userId, combo, performance) => {
    const weights = await loadWeights(userId);

    weights.winningCombos.push({
        ...combo,
        views: performance?.views || 0,
        recordedAt: new Date().toISOString()
    });

    // Keep only top 100 combos by views
    weights.winningCombos = weights.winningCombos
        .sort((a, b) => b.views - a.views)
        .slice(0, 100);

    await saveWeights(userId, weights);
};

/**
 * Get winning combinations for inspiration
 */
export const getWinningCombos = async (userId, limit = 10) => {
    const weights = await loadWeights(userId);
    return weights.winningCombos.slice(0, limit);
};

// ============================================================
// BATCH UPDATE FUNCTION
// ============================================================

/**
 * Update weights from video performance data (batch update)
 * Call this after fetching analytics
 */
export const updateFromAnalytics = async (userId, platform, videos, channelAvg) => {
    console.log(`   Updating weights for ${platform} from ${videos.length} videos...`);

    let updated = 0;

    for (const video of videos) {
        const views = video.stats?.views || 0;
        const title = video.title || '';
        const topic = video.topic || title;

        // Detect patterns in the video
        const patterns = detectPatternsInTitle(title);

        // Track hook performance
        if (patterns.hookType) {
            await trackHookPerformance(userId, platform, patterns.hookType, { views, topic }, channelAvg);
            updated++;
        }

        // Track emotion
        if (patterns.emotion) {
            await trackVariableUsage(userId, platform, 'emotion', patterns.emotion, { views }, channelAvg);
        }

        // Track structure
        if (patterns.structure) {
            await trackVariableUsage(userId, platform, 'structure', patterns.structure, { views }, channelAvg);
        }
    }

    console.log(`   Updated ${updated} pattern weights for ${platform}`);
    return updated;
};

/**
 * Detect patterns in a video title
 */
const detectPatternsInTitle = (title) => {
    const titleLower = title.toLowerCase();

    // Hook type detection
    let hookType = null;
    if (/secret|hide|hidden|don'?t.*know/.test(titleLower)) hookType = 'secrets-exposed';
    else if (/broke.*rules?|rule.*break|fired|promoted/.test(titleLower)) hookType = 'rule-breaking';
    else if (/gaslight|manipulat|trick|psych/.test(titleLower)) hookType = 'manipulation-awareness';
    else if (/ceo|boss|manager|employee|work/.test(titleLower)) hookType = 'workplace-secrets';
    else if (/revenge|karma|got back|caught|exposed/.test(titleLower)) hookType = 'revenge-karma';
    else if (/hustle|passive income|side hustle|sigma/.test(titleLower)) hookType = 'stupid-hustle';

    // Emotion detection
    let emotion = 'curiosity';
    if (/!|shocking|insane|crazy/.test(titleLower)) emotion = 'shock';
    else if (/funny|fail|hilarious/.test(titleLower)) emotion = 'humor';
    else if (/angry|unfair|steal|scam/.test(titleLower)) emotion = 'outrage';
    else if (/secret|hide|mystery/.test(titleLower)) emotion = 'curiosity';

    // Structure detection
    let structure = 'story';
    if (/\d+\s+(ways?|things?|tricks?|secrets?)/.test(titleLower)) structure = 'list';
    else if (/reveals?|exposes?/.test(titleLower)) structure = 'revelation';
    else if (/→|instead|but|got/.test(titleLower)) structure = 'twist';

    return { hookType, emotion, structure };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Core
    loadWeights,
    CONFIG,

    // Tracking
    trackVariableUsage,
    trackHookPerformance,
    trackTemplatePerformance,
    trackThemePerformance,
    trackDurationPerformance,

    // Selection (REPLACES Math.random())
    weightedSelect,
    selectWeightedVariable,
    selectBestHook,

    // Analytics
    getPlatformSummary,
    getKilledPatterns,
    isKilled,
    revivePattern,
    recordWinningCombo,
    getWinningCombos,

    // Batch update
    updateFromAnalytics
};
