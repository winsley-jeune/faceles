/**
 * Cross-Platform Analytics Engine - MULTI-ARMED BANDIT STRATEGY
 *
 * Game Theory: Optimal exploration vs exploitation across all platforms
 * - Each platform is an "arm" with unknown reward distribution
 * - Use UCB1 (Upper Confidence Bound) to balance trying new approaches vs using proven winners
 *
 * Strategy: 30% Exploration (try new patterns) / 70% Exploitation (use winners)
 *
 * Key Features:
 * - Aggregates patterns from all 4 platforms
 * - Identifies "Universal Winners" that work everywhere
 * - Platform-specific optimizations for each channel
 * - Generates unified few-shot prompts for content generation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import platform-specific analytics
import * as youtubeAnalytics from './youtube_analytics.js';
import * as tiktokAnalytics from './tiktok_analytics.js';
import * as facebookAnalytics from './facebook_analytics.js';
import * as instagramAnalytics from './instagram_analytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cross-platform pattern storage
const UNIFIED_PATTERNS_FILE = path.join(__dirname, '../../data/winning_patterns.json');

// Multi-Armed Bandit parameters
const MAB_CONFIG = {
    EXPLORATION_RATE: 0.3,    // 30% try new things
    EXPLOITATION_RATE: 0.7,   // 70% use proven winners
    MIN_SAMPLES_FOR_CONFIDENCE: 3,  // Need 3+ samples before trusting a pattern
    UCB_CONSTANT: 1.5,        // UCB exploration bonus factor
    DECAY_FACTOR: 0.95        // Old data decays over time
};

/**
 * Load or initialize unified winning patterns
 */
export const loadWinningPatterns = () => {
    try {
        if (fs.existsSync(UNIFIED_PATTERNS_FILE)) {
            return JSON.parse(fs.readFileSync(UNIFIED_PATTERNS_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('Error loading unified patterns:', err);
    }

    return {
        // Universal winners that work across platforms
        universalWinners: [],

        // Aggregated pattern performance
        patterns: {
            hooks: {},
            niches: {},
            durations: {},
            tones: {},
            visualStyles: {},
            postTimes: {}
        },

        // Platform-specific best practices
        platformInsights: {
            youtube: { bestPatterns: [], avgScore: 0, totalVideos: 0 },
            tiktok: { bestPatterns: [], avgScore: 0, totalVideos: 0 },
            facebook: { bestPatterns: [], avgScore: 0, totalVideos: 0 },
            instagram: { bestPatterns: [], avgScore: 0, totalVideos: 0 }
        },

        // Multi-Armed Bandit state
        mabState: {
            totalPulls: 0,
            explorationPulls: 0,
            exploitationPulls: 0,
            armStats: {}  // Pattern -> {pulls, totalReward, avgReward, ucbScore}
        },

        // Content generation preferences (fed to AI)
        contentPreferences: {
            preferredHooks: [],
            preferredNiches: [],
            preferredDurations: {},
            preferredTones: [],
            avoidPatterns: []
        },

        lastUpdated: null
    };
};

/**
 * Save patterns to file
 */
const savePatterns = (patterns) => {
    try {
        const dir = path.dirname(UNIFIED_PATTERNS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(UNIFIED_PATTERNS_FILE, JSON.stringify(patterns, null, 2));
    } catch (err) {
        console.error('Error saving unified patterns:', err);
    }
};

/**
 * Calculate UCB1 score for a pattern (exploration vs exploitation balance)
 * UCB1 = average_reward + C * sqrt(ln(total_pulls) / arm_pulls)
 */
const calculateUCBScore = (armStats, totalPulls) => {
    if (armStats.pulls === 0) {
        return Infinity; // Always explore unvisited arms first
    }

    const explorationBonus = MAB_CONFIG.UCB_CONSTANT *
        Math.sqrt(Math.log(totalPulls) / armStats.pulls);

    return armStats.avgReward + explorationBonus;
};

/**
 * Update Multi-Armed Bandit state with new observation
 */
const updateMABState = (patterns, patternKey, reward) => {
    const mab = patterns.mabState;
    mab.totalPulls++;

    if (!mab.armStats[patternKey]) {
        mab.armStats[patternKey] = {
            pulls: 0,
            totalReward: 0,
            avgReward: 0,
            ucbScore: Infinity
        };
    }

    const arm = mab.armStats[patternKey];
    arm.pulls++;
    arm.totalReward += reward;
    arm.avgReward = arm.totalReward / arm.pulls;
    arm.ucbScore = calculateUCBScore(arm, mab.totalPulls);

    return patterns;
};

/**
 * Get best pattern to use (exploitation) or random pattern (exploration)
 */
export const selectPattern = (category, patterns = null) => {
    const allPatterns = patterns || loadWinningPatterns();
    const mab = allPatterns.mabState;
    const categoryPatterns = allPatterns.patterns[category] || {};

    // Exploration vs Exploitation decision
    const shouldExplore = Math.random() < MAB_CONFIG.EXPLORATION_RATE;

    if (shouldExplore) {
        mab.explorationPulls++;
        // Return random pattern or suggest trying something new
        const patternKeys = Object.keys(categoryPatterns);
        if (patternKeys.length === 0) {
            return { pattern: null, mode: 'explore', reason: 'No data yet - try anything' };
        }

        // Prefer patterns with fewer samples (need more data)
        const underSampled = patternKeys.filter(
            k => (mab.armStats[`${category}:${k}`]?.pulls || 0) < MAB_CONFIG.MIN_SAMPLES_FOR_CONFIDENCE
        );

        if (underSampled.length > 0) {
            const selected = underSampled[Math.floor(Math.random() * underSampled.length)];
            return { pattern: selected, mode: 'explore', reason: 'Needs more data' };
        }

        // Random exploration
        const selected = patternKeys[Math.floor(Math.random() * patternKeys.length)];
        return { pattern: selected, mode: 'explore', reason: 'Random exploration' };
    } else {
        mab.exploitationPulls++;
        // Use UCB1 to find best pattern
        let bestPattern = null;
        let bestUCB = -Infinity;

        for (const [pattern, stats] of Object.entries(categoryPatterns)) {
            const armKey = `${category}:${pattern}`;
            const armStats = mab.armStats[armKey] || { pulls: 0, avgReward: 0, ucbScore: Infinity };
            const ucb = calculateUCBScore(armStats, mab.totalPulls || 1);

            if (ucb > bestUCB) {
                bestUCB = ucb;
                bestPattern = pattern;
            }
        }

        return {
            pattern: bestPattern,
            mode: 'exploit',
            reason: `Best performing (UCB: ${bestUCB.toFixed(2)})`
        };
    }
};

/**
 * Aggregate patterns from all platforms
 */
export const aggregateAllPlatforms = async () => {
    const unified = loadWinningPatterns();

    // Load from each platform
    const platforms = {
        youtube: youtubeAnalytics.loadWinningPatterns?.() || { patterns: {}, winners: [] },
        tiktok: tiktokAnalytics.loadWinningPatterns?.() || { patterns: {}, winners: [] },
        facebook: facebookAnalytics.loadWinningPatterns?.() || { patterns: {}, winners: [] },
        instagram: instagramAnalytics.loadWinningPatterns?.() || { patterns: {}, winners: [] }
    };

    // Merge pattern statistics
    const categories = ['hooks', 'niches', 'durations', 'tones', 'postTimes'];

    for (const category of categories) {
        // Map platform-specific category names
        const categoryMapping = {
            hooks: 'hooks',
            niches: 'niches',
            durations: 'durations',
            tones: 'tones',
            postTimes: 'postTimes'
        };

        for (const [platform, data] of Object.entries(platforms)) {
            const platformPatterns = data.patterns?.[categoryMapping[category]] || {};

            for (const [pattern, stats] of Object.entries(platformPatterns)) {
                if (!unified.patterns[category][pattern]) {
                    unified.patterns[category][pattern] = {
                        platforms: {},
                        totalCount: 0,
                        avgScore: 0,
                        universalScore: 0
                    };
                }

                const p = unified.patterns[category][pattern];
                p.platforms[platform] = stats;
                p.totalCount += stats.count || 0;

                // Update MAB state
                const armKey = `${category}:${pattern}`;
                updateMABState(unified, armKey, stats.avgScore || 0);
            }
        }

        // Calculate universal scores (works across platforms)
        for (const [pattern, data] of Object.entries(unified.patterns[category])) {
            const platformCount = Object.keys(data.platforms).length;
            const scores = Object.values(data.platforms).map(p => p.avgScore || 0);
            const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

            // Universal score bonus for patterns that work on multiple platforms
            const universalBonus = platformCount >= 3 ? 0.5 : platformCount >= 2 ? 0.25 : 0;
            data.avgScore = avgScore;
            data.universalScore = avgScore + universalBonus;
        }
    }

    // Update platform insights
    for (const [platform, data] of Object.entries(platforms)) {
        const insights = unified.platformInsights[platform];
        insights.totalVideos = data.winners?.length || 0;

        // Get best patterns for this platform
        insights.bestPatterns = [];
        for (const category of categories) {
            const platformPatterns = data.patterns?.[category] || {};
            const sorted = Object.entries(platformPatterns)
                .filter(([_, s]) => s.count >= 2)
                .sort((a, b) => (b[1].avgScore || 0) - (a[1].avgScore || 0));

            if (sorted.length > 0) {
                insights.bestPatterns.push({
                    category,
                    pattern: sorted[0][0],
                    score: sorted[0][1].avgScore
                });
            }
        }
    }

    // Find universal winners (appear on 3+ platforms with good scores)
    unified.universalWinners = [];
    for (const category of categories) {
        for (const [pattern, data] of Object.entries(unified.patterns[category])) {
            const platformCount = Object.keys(data.platforms).length;
            if (platformCount >= 3 && data.avgScore >= 0.5) {
                unified.universalWinners.push({
                    category,
                    pattern,
                    platforms: Object.keys(data.platforms),
                    avgScore: data.avgScore,
                    universalScore: data.universalScore
                });
            }
        }
    }

    // Sort by universal score
    unified.universalWinners.sort((a, b) => b.universalScore - a.universalScore);
    unified.universalWinners = unified.universalWinners.slice(0, 20);

    // Update content preferences
    updateContentPreferences(unified);

    unified.lastUpdated = new Date().toISOString();
    savePatterns(unified);

    return unified;
};

/**
 * Update content generation preferences based on patterns
 */
const updateContentPreferences = (patterns) => {
    const prefs = patterns.contentPreferences;

    // Get top patterns by category
    for (const category of ['hooks', 'niches', 'durations', 'tones']) {
        const sorted = Object.entries(patterns.patterns[category] || {})
            .filter(([_, d]) => d.totalCount >= MAB_CONFIG.MIN_SAMPLES_FOR_CONFIDENCE)
            .sort((a, b) => b[1].universalScore - a[1].universalScore);

        if (category === 'hooks') {
            prefs.preferredHooks = sorted.slice(0, 5).map(([p]) => p);
        } else if (category === 'niches') {
            prefs.preferredNiches = sorted.slice(0, 5).map(([p]) => p);
        } else if (category === 'tones') {
            prefs.preferredTones = sorted.slice(0, 3).map(([p]) => p);
        } else if (category === 'durations') {
            prefs.preferredDurations = {};
            for (const [duration, data] of sorted.slice(0, 3)) {
                // Find which platforms prefer which duration
                prefs.preferredDurations[duration] = {
                    score: data.universalScore,
                    platforms: Object.keys(data.platforms)
                };
            }
        }
    }

    // Identify patterns to avoid (negative scores)
    prefs.avoidPatterns = [];
    for (const [category, data] of Object.entries(patterns.patterns)) {
        for (const [pattern, stats] of Object.entries(data)) {
            if (stats.avgScore < -0.5 && stats.totalCount >= MAB_CONFIG.MIN_SAMPLES_FOR_CONFIDENCE) {
                prefs.avoidPatterns.push({
                    category,
                    pattern,
                    avgScore: stats.avgScore
                });
            }
        }
    }
};

/**
 * Generate unified few-shot prompt for content generation
 * This is the main output used by storyboard/image/voice generators
 */
export const generateUnifiedPrompt = () => {
    const patterns = loadWinningPatterns();

    let prompt = `## Content Generation Guidelines (Cross-Platform Optimized)\n\n`;
    prompt += `*Last updated: ${patterns.lastUpdated || 'Never'}*\n\n`;

    // MAB stats
    const mab = patterns.mabState;
    prompt += `### Strategy Balance\n`;
    prompt += `- Total content pieces analyzed: ${mab.totalPulls}\n`;
    prompt += `- Exploration rate: ${mab.totalPulls > 0 ? Math.round(mab.explorationPulls / mab.totalPulls * 100) : 30}%\n`;
    prompt += `- Exploitation rate: ${mab.totalPulls > 0 ? Math.round(mab.exploitationPulls / mab.totalPulls * 100) : 70}%\n\n`;

    // Universal winners
    if (patterns.universalWinners.length > 0) {
        prompt += `### Universal Winners (Work on 3+ platforms)\n\n`;
        for (const winner of patterns.universalWinners.slice(0, 5)) {
            prompt += `- **${winner.category}:** ${winner.pattern} (score: ${winner.avgScore.toFixed(2)}, platforms: ${winner.platforms.join(', ')})\n`;
        }
        prompt += `\n`;
    }

    // Content preferences
    const prefs = patterns.contentPreferences;

    prompt += `### Recommended Content Patterns\n\n`;

    if (prefs.preferredHooks.length > 0) {
        prompt += `**Hooks that work:** ${prefs.preferredHooks.join(', ')}\n`;
    }

    if (prefs.preferredNiches.length > 0) {
        prompt += `**Best niches:** ${prefs.preferredNiches.join(', ')}\n`;
    }

    if (prefs.preferredTones.length > 0) {
        prompt += `**Effective tones:** ${prefs.preferredTones.join(', ')}\n`;
    }

    if (Object.keys(prefs.preferredDurations).length > 0) {
        prompt += `**Duration preferences:**\n`;
        for (const [duration, data] of Object.entries(prefs.preferredDurations)) {
            prompt += `  - ${duration}: score ${data.score.toFixed(2)} (${data.platforms.join(', ')})\n`;
        }
    }

    // Patterns to avoid
    if (prefs.avoidPatterns.length > 0) {
        prompt += `\n### Patterns to Avoid\n`;
        for (const avoid of prefs.avoidPatterns.slice(0, 5)) {
            prompt += `- **${avoid.category}:** ${avoid.pattern} (avg score: ${avoid.avgScore.toFixed(2)})\n`;
        }
    }

    // Platform-specific tips
    prompt += `\n### Platform-Specific Optimization\n\n`;

    for (const [platform, insights] of Object.entries(patterns.platformInsights)) {
        if (insights.totalVideos > 0 || insights.bestPatterns.length > 0) {
            prompt += `**${platform.charAt(0).toUpperCase() + platform.slice(1)}:** `;
            if (insights.bestPatterns.length > 0) {
                const best = insights.bestPatterns[0];
                prompt += `Best ${best.category}: ${best.pattern}\n`;
            } else {
                prompt += `(gathering data)\n`;
            }
        }
    }

    // Strategy reminder
    prompt += `\n### Content Creation Strategy\n`;
    prompt += `- 70% of content should use PROVEN PATTERNS from above\n`;
    prompt += `- 30% of content should EXPERIMENT with new approaches\n`;
    prompt += `- Always track what works - this data improves over time\n`;
    prompt += `- Universal winners are your safest bet for cross-posting\n`;

    return prompt;
};

/**
 * Get platform-specific prompt
 */
export const getPlatformPrompt = (platform) => {
    switch (platform) {
        case 'youtube':
            return youtubeAnalytics.generateFewShotPrompt?.() || '';
        case 'tiktok':
            return tiktokAnalytics.generateFewShotPrompt?.() || '';
        case 'facebook':
            return facebookAnalytics.generateFewShotPrompt?.() || '';
        case 'instagram':
            return instagramAnalytics.generateFewShotPrompt?.() || '';
        default:
            return generateUnifiedPrompt();
    }
};

/**
 * Record a new content piece result
 * Called after posting content to update patterns
 */
export const recordResult = (contentData, platformResults) => {
    const patterns = loadWinningPatterns();

    // Update each platform's analytics
    for (const [platform, result] of Object.entries(platformResults)) {
        const { video, score } = result;

        // Extract patterns from video
        const hookStyle = video.hookStyle || 'unknown';
        const niche = video.niche || 'general';
        const duration = video.duration || 'short';
        const tone = video.tone || 'neutral';

        // Update unified patterns
        for (const [category, value] of Object.entries({
            hooks: hookStyle,
            niches: niche,
            durations: duration,
            tones: tone
        })) {
            if (!patterns.patterns[category][value]) {
                patterns.patterns[category][value] = {
                    platforms: {},
                    totalCount: 0,
                    avgScore: 0,
                    universalScore: 0
                };
            }

            const p = patterns.patterns[category][value];
            if (!p.platforms[platform]) {
                p.platforms[platform] = { count: 0, totalScore: 0, avgScore: 0 };
            }

            p.platforms[platform].count++;
            p.platforms[platform].totalScore += score;
            p.platforms[platform].avgScore = p.platforms[platform].totalScore / p.platforms[platform].count;
            p.totalCount++;

            // Recalculate universal score
            const scores = Object.values(p.platforms).map(pl => pl.avgScore);
            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            const platformBonus = Object.keys(p.platforms).length >= 3 ? 0.5 :
                                  Object.keys(p.platforms).length >= 2 ? 0.25 : 0;
            p.avgScore = avgScore;
            p.universalScore = avgScore + platformBonus;

            // Update MAB
            updateMABState(patterns, `${category}:${value}`, score);
        }
    }

    updateContentPreferences(patterns);
    patterns.lastUpdated = new Date().toISOString();
    savePatterns(patterns);

    return patterns;
};

/**
 * Get content recommendation for next post
 */
export const getContentRecommendation = (targetPlatforms = ['youtube', 'tiktok', 'facebook', 'instagram']) => {
    const patterns = loadWinningPatterns();

    const recommendation = {
        strategy: Math.random() < MAB_CONFIG.EXPLORATION_RATE ? 'EXPLORE' : 'EXPLOIT',
        suggestedPatterns: {},
        platformSpecific: {},
        confidence: 'low'
    };

    // Get pattern recommendations for each category
    for (const category of ['hooks', 'niches', 'durations', 'tones']) {
        const selection = selectPattern(category, patterns);
        recommendation.suggestedPatterns[category] = selection;
    }

    // Platform-specific recommendations
    for (const platform of targetPlatforms) {
        if (platform === 'instagram') {
            recommendation.platformSpecific[platform] = instagramAnalytics.getContentRecommendation?.() || null;
        } else {
            recommendation.platformSpecific[platform] = {
                bestPatterns: patterns.platformInsights[platform]?.bestPatterns || []
            };
        }
    }

    // Calculate confidence based on data amount
    const totalSamples = patterns.mabState.totalPulls || 0;
    if (totalSamples >= 50) {
        recommendation.confidence = 'high';
    } else if (totalSamples >= 20) {
        recommendation.confidence = 'medium';
    } else {
        recommendation.confidence = 'low';
    }

    return recommendation;
};

/**
 * Full cross-platform analysis
 */
export const runFullAnalysis = async (tokens = {}) => {
    // Aggregate from all platforms
    const unified = await aggregateAllPlatforms();

    return {
        patterns: unified,
        unifiedPrompt: generateUnifiedPrompt(),
        platformPrompts: {
            youtube: getPlatformPrompt('youtube'),
            tiktok: getPlatformPrompt('tiktok'),
            facebook: getPlatformPrompt('facebook'),
            instagram: getPlatformPrompt('instagram')
        },
        recommendation: getContentRecommendation(),
        universalWinners: unified.universalWinners,
        mabStats: unified.mabState
    };
};

export default {
    loadWinningPatterns,
    aggregateAllPlatforms,
    generateUnifiedPrompt,
    getPlatformPrompt,
    recordResult,
    getContentRecommendation,
    selectPattern,
    runFullAnalysis,
    MAB_CONFIG
};
