import dataService from '../../services/dataService.js';

/**
 * EXPLORATION CONFIG
 *
 * Controls the balance between:
 * - EXPLOIT: Use proven patterns from viral intelligence
 * - EXPLORE: Try new experimental content (including stupid_hustle)
 *
 * This unified config applies across all platforms and generators.
 */

// ============================================================
// DEFAULT CONFIGURATION
// ============================================================

const DEFAULT_CONFIG = {
    // GLOBAL SETTINGS
    global: {
        exploration_rate: 0.30,        // 30% of ALL content is experimental
        stupid_hustle_rate: 0.30,      // 30% of exploration is stupid_hustle
        enabled: true                   // Master switch for exploration
    },

    // PER-PLATFORM SETTINGS (override global if set)
    platforms: {
        youtube: {
            exploit_rate: 0.70,         // 70% proven patterns
            explore_rate: 0.30,         // 30% experimental
            strategy: 'minimax',        // Minimize drop-off, maximize completion
            exploration_types: {
                stupid_hustle: 0.30,    // 30% of exploration = stupid hustle
                controversial: 0.30,    // 30% = controversial takes
                experimental: 0.20,     // 20% = completely new formats
                trending: 0.20          // 20% = trend-jacking
            }
        },
        facebook: {
            exploit_rate: 0.80,         // 80% proven (FB rewards consistency)
            explore_rate: 0.20,         // 20% experimental
            strategy: 'tit-for-tat',    // Trust-building through consistency
            exploration_types: {
                stupid_hustle: 0.20,    // Less chaos on FB (older audience)
                controversial: 0.30,
                shareable: 0.30,        // Shareable wisdom
                debate: 0.20            // Debate starters
            }
        },
        instagram: {
            exploit_rate: 0.70,         // 70% follower content
            explore_rate: 0.30,         // 30% reach content
            strategy: 'nash-equilibrium',
            exploration_types: {
                stupid_hustle: 0.25,
                controversial: 0.25,
                trending: 0.30,         // IG loves trends
                aesthetic: 0.20         // Aesthetic experiments
            }
        },
        tiktok: {
            exploit_rate: 0.50,         // 50% proven patterns
            explore_rate: 0.50,         // 50% experimental (TikTok is a lottery)
            strategy: 'expected-value',
            exploration_types: {
                stupid_hustle: 0.35,    // TikTok loves chaos
                controversial: 0.30,
                shock: 0.20,            // Shock hooks
                story: 0.15             // Story hooks
            }
        }
    },

    // TONE DISTRIBUTION (for variation engine)
    tone_distribution: {
        safe: 0.30,                     // 30% safe/educational
        edgy: 0.40,                     // 40% edgy/provocative
        controversial: 0.30             // 30% controversial/outrage
    },

    // VARIATION ENGINE SETTINGS
    variations: {
        per_winner: 10,                 // Generate 10 variations per winner
        exploration_topics: 5,          // Plus 5 pure exploration topics
        exploit_explore_ratio: {
            exploit: 0.66,              // 66% based on winners
            explore: 0.34               // 34% pure exploration
        }
    },

    // AUTO-ADJUSTMENT SETTINGS
    auto_adjust: {
        enabled: true,
        check_interval_hours: 24,       // Check performance daily
        increase_exploration_if: {
            viral_rate_below: 0.05,     // If < 5% go viral, try more exploration
            avg_views_declining: true    // If views declining, try new things
        },
        decrease_exploration_if: {
            viral_rate_above: 0.15,     // If > 15% go viral, stick with what works
            avg_views_growing: true      // If views growing, exploit more
        },
        min_exploration: 0.10,          // Never go below 10% exploration
        max_exploration: 0.60           // Never go above 60% exploration
    },

    // STUPID HUSTLE SPECIFIC SETTINGS
    stupid_hustle: {
        enabled: true,
        max_per_day: 3,                 // Max 3 stupid hustle videos per day
        platforms: ['tiktok', 'instagram', 'youtube', 'facebook'],
        escalation_levels: {
            mild: 0.40,                 // 40% mild chaos
            medium: 0.35,               // 35% medium chaos
            extreme: 0.25               // 25% maximum chaos
        }
    },

    // METADATA
    lastUpdated: null,
    version: '1.0.0'
};

// ============================================================
// CONFIG MANAGEMENT
// ============================================================

/**
 * Load exploration config for user
 */
export const loadConfig = async (userId) => {
    try {
        const config = await dataService.exploration.getConfig(userId);
        if (config) {
            return deepMerge(DEFAULT_CONFIG, config);
        }
    } catch (err) {
        console.error('Failed to load exploration config:', err.message);
    }

    // Save defaults if no config exists
    await saveConfig(userId, DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
};

/**
 * Save exploration config for user
 */
export const saveConfig = async (userId, config) => {
    config.lastUpdated = new Date().toISOString();

    try {
        await dataService.explorationConfig.saveExplorationConfig(userId, config);
        return true;
    } catch (err) {
        console.error('Failed to save exploration config:', err.message);
        return false;
    }
};

/**
 * Deep merge utility
 */
const deepMerge = (target, source) => {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        // Arrays should be replaced, not merged
        if (Array.isArray(source[key])) {
            result[key] = [...source[key]];
        } else if (source[key] instanceof Object && key in target && target[key] instanceof Object && !Array.isArray(target[key])) {
            result[key] = deepMerge(target[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
};

// ============================================================
// EXPLORATION DECISION FUNCTIONS
// ============================================================

/**
 * Decide if this content should be exploration or exploitation
 * @param {string} userId - User ID
 * @param {string} platform - youtube, facebook, instagram, tiktok
 * @returns {object} { isExploration: boolean, type: string, reason: string }
 */
export const shouldExplore = async (userId, platform = 'youtube') => {
    const config = await loadConfig(userId);

    if (!config.global.enabled) {
        return { isExploration: false, type: 'exploit', reason: 'Exploration disabled globally' };
    }

    const platformConfig = config.platforms[platform] || config.platforms.youtube;
    const exploreRate = platformConfig.explore_rate || config.global.exploration_rate;

    // Random decision based on explore rate
    const roll = Math.random();
    const isExploration = roll < exploreRate;

    if (isExploration) {
        // Decide WHAT TYPE of exploration
        const explorationType = selectExplorationType(platformConfig.exploration_types);
        return {
            isExploration: true,
            type: explorationType,
            reason: `Exploration roll: ${(roll * 100).toFixed(1)}% < ${(exploreRate * 100)}% threshold`,
            explorationRate: exploreRate
        };
    }

    return {
        isExploration: false,
        type: 'exploit',
        reason: `Exploitation roll: ${(roll * 100).toFixed(1)}% >= ${(exploreRate * 100)}% threshold`,
        explorationRate: exploreRate
    };
};

/**
 * Select exploration type based on weighted distribution
 */
const selectExplorationType = (types) => {
    if (!types) return 'experimental';

    const entries = Object.entries(types);
    const total = entries.reduce((sum, [_, weight]) => sum + weight, 0);
    let roll = Math.random() * total;

    for (const [type, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return type;
    }

    return entries[0][0]; // Fallback to first type
};

/**
 * Should this be a stupid_hustle topic?
 * @param {string} userId - User ID
 * @param {string} platform
 * @returns {object}
 */
export const shouldBeStupidHustle = async (userId, platform = 'youtube') => {
    const config = await loadConfig(userId);

    if (!config.stupid_hustle.enabled) {
        return { isStupidHustle: false, reason: 'Stupid hustle disabled' };
    }

    if (!config.stupid_hustle.platforms.includes(platform)) {
        return { isStupidHustle: false, reason: `Stupid hustle not enabled for ${platform}` };
    }

    // First check if we're in exploration mode
    const explorationDecision = await shouldExplore(userId, platform);

    if (!explorationDecision.isExploration) {
        return { isStupidHustle: false, reason: 'Not in exploration mode' };
    }

    // Check if exploration type is stupid_hustle
    if (explorationDecision.type === 'stupid_hustle') {
        // Select escalation level
        const level = selectEscalationLevel(config.stupid_hustle.escalation_levels);
        return {
            isStupidHustle: true,
            escalationLevel: level,
            reason: `Stupid hustle selected (${level} chaos level)`
        };
    }

    return { isStupidHustle: false, reason: `Exploration type is ${explorationDecision.type}` };
};

/**
 * Select stupid hustle escalation level
 */
const selectEscalationLevel = (levels) => {
    const entries = Object.entries(levels);
    let roll = Math.random();

    for (const [level, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return level;
    }

    return 'mild';
};

/**
 * Get tone distribution for variation engine
 */
export const getToneDistribution = async (userId) => {
    const config = await loadConfig(userId);
    return config.tone_distribution;
};

/**
 * Get platform-specific configuration
 */
export const getPlatformConfig = async (userId, platform) => {
    const config = await loadConfig(userId);
    return config.platforms[platform] || config.platforms.youtube;
};

/**
 * Get variation engine settings
 */
export const getVariationSettings = async (userId) => {
    const config = await loadConfig(userId);
    return config.variations;
};

/**
 * Update a specific setting
 */
export const updateSetting = async (userId, path, value) => {
    const config = await loadConfig(userId);

    // Navigate to the setting and update it
    const keys = path.split('.');
    let current = config;

    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    await saveConfig(userId, config);

    return config;
};

/**
 * Reset to defaults
 */
export const resetToDefaults = async (userId) => {
    await saveConfig(userId, DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
};

// ============================================================
// AUTO-ADJUSTMENT (Called periodically)
// ============================================================

/**
 * Auto-adjust exploration rate based on performance
 * @param {string} userId - User ID
 * @param {object} performanceData - { viralRate, avgViews, trend }
 */
export const autoAdjustExploration = async (userId, performanceData) => {
    const config = await loadConfig(userId);

    if (!config.auto_adjust.enabled) {
        return { adjusted: false, reason: 'Auto-adjust disabled' };
    }

    const { viralRate, avgViews, trend } = performanceData;
    const currentRate = config.global.exploration_rate;
    let newRate = currentRate;
    let reason = '';

    // Check if we should increase exploration
    if (viralRate < config.auto_adjust.increase_exploration_if.viral_rate_below) {
        newRate = Math.min(currentRate + 0.05, config.auto_adjust.max_exploration);
        reason = `Viral rate ${(viralRate * 100).toFixed(1)}% below threshold, increasing exploration`;
    }
    else if (trend === 'declining' && config.auto_adjust.increase_exploration_if.avg_views_declining) {
        newRate = Math.min(currentRate + 0.05, config.auto_adjust.max_exploration);
        reason = 'Views declining, increasing exploration';
    }
    // Check if we should decrease exploration
    else if (viralRate > config.auto_adjust.decrease_exploration_if.viral_rate_above) {
        newRate = Math.max(currentRate - 0.05, config.auto_adjust.min_exploration);
        reason = `Viral rate ${(viralRate * 100).toFixed(1)}% above threshold, decreasing exploration`;
    }
    else if (trend === 'growing' && config.auto_adjust.decrease_exploration_if.avg_views_growing) {
        newRate = Math.max(currentRate - 0.05, config.auto_adjust.min_exploration);
        reason = 'Views growing, exploiting what works';
    }

    if (newRate !== currentRate) {
        config.global.exploration_rate = newRate;
        await saveConfig(userId, config);

        console.log(`🎚️ Exploration rate adjusted: ${(currentRate * 100)}% → ${(newRate * 100)}%`);
        console.log(`   Reason: ${reason}`);

        return {
            adjusted: true,
            oldRate: currentRate,
            newRate: newRate,
            reason
        };
    }

    return { adjusted: false, reason: 'No adjustment needed' };
};

// ============================================================
// SUMMARY FUNCTIONS
// ============================================================

/**
 * Get a summary of current exploration settings
 */
export const getSummary = async (userId) => {
    const config = await loadConfig(userId);

    return {
        global: {
            exploration_rate: `${(config.global.exploration_rate * 100)}%`,
            stupid_hustle_rate: `${(config.global.stupid_hustle_rate * 100)}% of exploration`,
            enabled: config.global.enabled
        },
        platforms: Object.entries(config.platforms).map(([platform, cfg]) => ({
            platform,
            exploit: `${(cfg.exploit_rate * 100)}%`,
            explore: `${(cfg.explore_rate * 100)}%`,
            strategy: cfg.strategy
        })),
        toneDistribution: {
            safe: `${(config.tone_distribution.safe * 100)}%`,
            edgy: `${(config.tone_distribution.edgy * 100)}%`,
            controversial: `${(config.tone_distribution.controversial * 100)}%`
        },
        stupidHustle: {
            enabled: config.stupid_hustle.enabled,
            maxPerDay: config.stupid_hustle.max_per_day,
            platforms: config.stupid_hustle.platforms
        },
        autoAdjust: config.auto_adjust.enabled
    };
};

/**
 * Exploration decision for a platform. Wraps shouldExplore() and also exposes the
 * `isExploring` alias that callers (e.g. smart_youtube_generator) rely on.
 */
export const getExplorationDecision = async (userId, platform = 'youtube') => {
    const decision = await shouldExplore(userId, platform);
    return { ...decision, isExploring: decision.isExploration };
};

export default {
    loadConfig,
    saveConfig,
    shouldExplore,
    getExplorationDecision,
    shouldBeStupidHustle,
    getToneDistribution,
    getPlatformConfig,
    getVariationSettings,
    updateSetting,
    resetToDefaults,
    autoAdjustExploration,
    getSummary,
    DEFAULT_CONFIG
};
