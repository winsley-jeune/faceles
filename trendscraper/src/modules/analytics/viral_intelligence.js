import { GoogleGenerativeAI } from '@google/generative-ai';
import dataService from '../../services/dataService.js';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ============================================================
// AI EMOTION ANALYSIS
// ============================================================

/**
 * Load cached emotion analysis for user
 */
const loadEmotionCache = async (userId) => {
    try {
        const cache = await dataService.viralIntelligence.getEmotionCache(userId);
        return cache || {};
    } catch (err) {
        console.error('Failed to load emotion cache:', err.message);
        return {};
    }
};

/**
 * Save emotion cache for user
 */
const saveEmotionCache = async (userId, cache) => {
    try {
        await dataService.viralIntelligence.saveEmotionCache(userId, cache);
    } catch (err) {
        console.error('Failed to save emotion cache:', err.message);
    }
};

/**
 * AI-powered batch emotion analysis using Gemini
 * Analyzes multiple video titles at once for efficiency
 */
export const analyzeEmotionsWithAI = async (userId, videos) => {
    if (!videos || videos.length === 0) return {};

    const cache = await loadEmotionCache(userId);
    const results = {};
    const uncachedVideos = [];

    // Check cache first
    for (const video of videos) {
        const cacheKey = video.videoId || video.id || video.title;
        if (cache[cacheKey]) {
            results[cacheKey] = cache[cacheKey];
        } else {
            uncachedVideos.push(video);
        }
    }

    // If all cached, return early
    if (uncachedVideos.length === 0) {
        console.log('   📦 All emotions loaded from cache');
        return results;
    }

    console.log(`   🤖 Analyzing ${uncachedVideos.length} titles with AI (${videos.length - uncachedVideos.length} cached)...`);

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Batch titles for analysis (max 20 at a time)
        const batchSize = 20;
        for (let i = 0; i < uncachedVideos.length; i += batchSize) {
            const batch = uncachedVideos.slice(i, i + batchSize);
            const titlesText = batch.map((v, idx) => `${idx + 1}. "${v.title}"`).join('\n');

            const prompt = `Analyze these viral video titles and classify the PRIMARY emotion each evokes in viewers.

EMOTIONS (pick exactly one per title):
- shock: Surprises, disbelief, "wait what?!" moments
- curiosity: Makes you want to know more, secrets, mysteries
- outrage: Anger, injustice, rule-breaking, scandal
- humor: Funny, fails, awkward, embarrassing
- fear: Danger, warnings, scary, creepy
- inspiration: Motivating, success stories, life-changing
- fomo: Fear of missing out, exclusive, limited, trending
- relatability: "This is so me", everyday struggles, common experiences

TITLES:
${titlesText}

Respond ONLY with valid JSON array, no explanation:
[{"index": 1, "emotion": "outrage", "confidence": 0.9, "reason": "rule-breaking scandal"}, ...]`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            // Parse JSON from response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const analyses = JSON.parse(jsonMatch[0]);

                for (const analysis of analyses) {
                    const video = batch[analysis.index - 1];
                    if (video) {
                        const cacheKey = video.videoId || video.id || video.title;
                        const emotionData = {
                            emotion: analysis.emotion,
                            confidence: analysis.confidence,
                            reason: analysis.reason,
                            analyzedAt: new Date().toISOString()
                        };
                        results[cacheKey] = emotionData;
                        cache[cacheKey] = emotionData;
                    }
                }
            }
        }

        // Save updated cache
        await saveEmotionCache(userId, cache);
        console.log(`   ✅ AI emotion analysis complete`);

    } catch (err) {
        console.error('   ⚠️ AI emotion analysis failed:', err.message);
        // Fallback: return regex-based emotions for uncached
        for (const video of uncachedVideos) {
            const cacheKey = video.videoId || video.id || video.title;
            results[cacheKey] = {
                emotion: getRegexEmotion(video.title),
                confidence: 0.5,
                reason: 'fallback-regex',
                analyzedAt: new Date().toISOString()
            };
        }
    }

    return results;
};

/**
 * Fallback regex-based emotion detection
 */
const getRegexEmotion = (title) => {
    if (/shocking|insane|unbelievable|crazy|omg|wtf|😲|🤯|😱/i.test(title)) return 'shock';
    if (/🤣|😂|funny|fail|hilarious|awkward|embarrass|cringe/i.test(title)) return 'humor';
    if (/😡|angry|unfair|steal|scam|cheat|lie|fraud|exposed|caught|fired|broke.*rule/i.test(title)) return 'outrage';
    if (/🤫|secret|hide|hidden|mystery|discover|reveal|truth|don'?t.*know/i.test(title)) return 'curiosity';
    if (/danger|warning|urgent|beware|risk|scary|creepy/i.test(title)) return 'fear';
    if (/inspir|motivat|success|achieve|amazing|incredible|transform/i.test(title)) return 'inspiration';
    if (/miss.*out|exclusive|limited|trending|everyone|viral/i.test(title)) return 'fomo';
    if (/relatable|same|me when|pov|every.*ever/i.test(title)) return 'relatability';
    return 'curiosity'; // Default to curiosity instead of neutral
};

/**
 * VIRAL INTELLIGENCE SYSTEM
 *
 * Smarter content strategy based on:
 * 1. Velocity (views per hour in first 48h)
 * 2. Outlier detection (3x+ above average)
 * 3. Pattern extraction from outliers
 * 4. Auto-kill failing patterns
 */

// ============================================================
// VIRAL THRESHOLDS
// ============================================================

const THRESHOLDS = {
    // Velocity tiers (views per hour in first 48 hours)
    VELOCITY_VIRAL: 100,      // 100+ views/hour = viral potential
    VELOCITY_GOOD: 30,        // 30+ views/hour = performing well
    VELOCITY_AVERAGE: 10,     // 10+ views/hour = average
    VELOCITY_POOR: 5,         // Below 5 = underperforming

    // Outlier multiplier (compared to channel average)
    OUTLIER_THRESHOLD: 3,     // 3x above average = outlier
    SUPER_OUTLIER: 5,         // 5x above average = super outlier

    // Kill threshold
    PATTERN_KILL_AFTER: 5,    // Kill pattern after 5 attempts with 0 winners
    MIN_VIEWS_FOR_WINNER: 500,

    // Time windows
    VELOCITY_WINDOW_HOURS: 48,
    FRESH_VIDEO_DAYS: 7
};

// ============================================================
// CORE CALCULATIONS
// ============================================================

/**
 * Calculate view velocity (views per hour)
 */
export const calculateVelocity = (views, hoursLive) => {
    if (hoursLive <= 0) return 0;
    return Math.round((views / hoursLive) * 100) / 100;
};

/**
 * Calculate viral score
 * VIRAL_SCORE = Velocity × Engagement × Outlier Multiplier
 */
export const calculateViralScore = (video, channelAvgViews) => {
    const views = video.stats?.views || 0;
    const likes = video.stats?.likes || 0;
    const comments = video.stats?.comments || 0;
    const daysLive = video.daysSincePublished || 1;
    const hoursLive = Math.min(daysLive * 24, THRESHOLDS.VELOCITY_WINDOW_HOURS);

    // Velocity component
    const velocity = calculateVelocity(views, hoursLive);
    const velocityScore = Math.min(velocity / THRESHOLDS.VELOCITY_VIRAL, 2); // Cap at 2x

    // Engagement component
    const engagementRate = views > 0 ? ((likes + comments * 2) / views) * 100 : 0;
    const engagementScore = Math.min(engagementRate / 5, 2); // 5% = 1, cap at 2x

    // Outlier component
    const outlierMultiplier = channelAvgViews > 0 ? views / channelAvgViews : 1;
    const outlierScore = Math.min(outlierMultiplier / THRESHOLDS.OUTLIER_THRESHOLD, 3); // Cap at 3x

    // Final viral score (0-10 scale)
    const rawScore = (velocityScore * 3) + (engagementScore * 2) + (outlierScore * 5);
    const viralScore = Math.round(Math.min(rawScore, 10) * 10) / 10;

    return {
        viralScore,
        velocity,
        velocityScore: Math.round(velocityScore * 100) / 100,
        engagementRate: Math.round(engagementRate * 100) / 100,
        engagementScore: Math.round(engagementScore * 100) / 100,
        outlierMultiplier: Math.round(outlierMultiplier * 100) / 100,
        outlierScore: Math.round(outlierScore * 100) / 100,
        isOutlier: outlierMultiplier >= THRESHOLDS.OUTLIER_THRESHOLD,
        isSuperOutlier: outlierMultiplier >= THRESHOLDS.SUPER_OUTLIER,
        label: getViralLabel(viralScore)
    };
};

const getViralLabel = (score) => {
    if (score >= 8) return 'VIRAL';
    if (score >= 6) return 'HOT';
    if (score >= 4) return 'GOOD';
    if (score >= 2) return 'AVERAGE';
    return 'WEAK';
};

// ============================================================
// PATTERN EXTRACTION
// ============================================================

/**
 * Extract the winning pattern from a video
 */
export const extractWinningPattern = (video) => {
    const title = video.title || '';

    // Hook type detection
    let hookType = 'unknown';
    if (/secret|hide|hidden|don'?t want you to know/i.test(title)) hookType = 'secrets';
    else if (/broke.*rules?|rule.*break|fired|promoted/i.test(title)) hookType = 'rule-breaking';
    else if (/gaslight|manipulat|trick|psych/i.test(title)) hookType = 'psychology';
    else if (/\d+%|\d+ (ways?|things?|secrets?)/i.test(title)) hookType = 'listicle';
    else if (/truth|real|actually|shocking/i.test(title)) hookType = 'truth-reveal';
    else if (/ceo|boss|manager|employee|work/i.test(title)) hookType = 'workplace';

    // Emotion detection
    let emotion = 'neutral';
    if (/!|😲|🤯|😱/i.test(title)) emotion = 'shock';
    else if (/🤣|😂|funny|fail/i.test(title)) emotion = 'humor';
    else if (/😡|angry|unfair|steal/i.test(title)) emotion = 'outrage';
    else if (/🤫|secret|hide/i.test(title)) emotion = 'curiosity';

    // Structure detection
    let structure = 'story';
    if (/\d+\s+(ways?|things?|tricks?|secrets?|habits?)/i.test(title)) structure = 'list';
    else if (/reveals?|exposes?/i.test(title)) structure = 'revelation';
    else if (/→|instead|but|got/i.test(title)) structure = 'twist';

    // NEW: Domain/Theme Detection - Extract the subject matter
    let domain = 'general';
    let subDomain = null;

    // Restaurant/Food Service domain
    if (/restaurant|server|waiter|waitress|chef|kitchen|menu|food service|diner|cafe|bartender/i.test(title)) {
        domain = 'restaurant';
        subDomain = 'food-service';
    }
    // Retail/Customer Service domain
    else if (/customer|sale|retail|store|shopping|cashier|discount|shopper|buyer|refund/i.test(title)) {
        domain = 'customer-service';
        subDomain = 'retail';
    }
    // Office/Coworker domain
    else if (/coworker|colleague|office|cubicle|meeting|desk|team|department/i.test(title)) {
        domain = 'workplace';
        subDomain = 'office';
    }
    // Corporate/Management domain
    else if (/boss|manager|ceo|employee|fired|promoted|hr|workplace|supervisor|exec/i.test(title)) {
        domain = 'workplace';
        subDomain = 'corporate';
    }
    // Finance/Money domain
    else if (/money|finance|bank|rich|wealth|savings|millionaire|invest|broke|salary|wage|pay/i.test(title)) {
        domain = 'finance';
    }
    // Psychology/Manipulation domain
    else if (/gaslight|manipulat|psych|mind|trick|brain|toxic|narcissist/i.test(title)) {
        domain = 'psychology';
    }
    // Business/Sales domain
    else if (/sales|business|client|deal|pitch|commission|quota/i.test(title)) {
        domain = 'business';
        subDomain = 'sales';
    }

    // Extract key character types
    const characters = [];
    if (/coworker|colleague/i.test(title)) characters.push('coworker');
    if (/boss|manager|supervisor/i.test(title)) characters.push('boss');
    if (/customer|client|shopper/i.test(title)) characters.push('customer');
    if (/employee|worker/i.test(title)) characters.push('employee');
    if (/ceo|executive/i.test(title)) characters.push('ceo');

    // Extract key action verbs (what happened in the story)
    const actions = [];
    if (/steal|stole|stolen/i.test(title)) actions.push('steal');
    if (/fired|terminated/i.test(title)) actions.push('fired');
    if (/promoted|promotion/i.test(title)) actions.push('promoted');
    if (/quit|resigned/i.test(title)) actions.push('quit');
    if (/caught|exposed/i.test(title)) actions.push('caught');
    if (/gave|gifted|offered/i.test(title)) actions.push('gave');

    // Title patterns
    const patterns = {
        hasEmoji: /[\u{1F600}-\u{1F9FF}]/u.test(title),
        hasCaps: /\b[A-Z]{2,}\b/.test(title),
        hasNumbers: /\d/.test(title),
        hasQuestion: /\?/.test(title),
        hasExclamation: /!/.test(title),
        wordCount: title.split(/\s+/).length,
        firstWord: title.split(/\s+/)[0]?.toUpperCase()
    };

    // Duration bucket
    let durationBucket = 'medium';
    if (video.duration) {
        const match = video.duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
        if (match) {
            const seconds = (parseInt(match[1] || 0) * 60) + parseInt(match[2] || 0);
            if (seconds <= 30) durationBucket = 'short';
            else if (seconds <= 60) durationBucket = 'medium';
            else if (seconds <= 90) durationBucket = 'long';
            else durationBucket = 'extra-long';
        }
    }

    return {
        hookType,
        emotion,
        structure,
        domain,          // NEW: What subject matter (restaurant, workplace, finance, etc.)
        subDomain,       // NEW: Specific sub-category (food-service, office, retail, etc.)
        characters,      // NEW: Key character types (coworker, boss, customer, etc.)
        actions,         // NEW: Key actions (steal, fired, promoted, etc.)
        durationBucket,
        patterns,
        title: title.substring(0, 60)
    };
};

// ============================================================
// OUTLIER ANALYSIS
// ============================================================

/**
 * Analyze videos and identify outliers
 * @param {Array} videos - Videos to analyze
 * @param {Object} emotionMap - Pre-analyzed AI emotions (optional)
 */
export const analyzeForOutliers = (videos, emotionMap = null) => {
    if (!videos || videos.length === 0) {
        return { outliers: [], superOutliers: [], avgViews: 0, patterns: {} };
    }

    // Calculate channel average
    const totalViews = videos.reduce((sum, v) => sum + (v.stats?.views || 0), 0);
    const avgViews = Math.round(totalViews / videos.length);

    // Score all videos with AI emotions if available
    const scoredVideos = videos.map(video => {
        const cacheKey = video.videoId || video.id || video.title;
        const aiEmotion = emotionMap?.[cacheKey];
        const pattern = extractWinningPattern(video);

        // Override regex emotion with AI emotion if available
        if (aiEmotion) {
            pattern.emotion = aiEmotion.emotion;
            pattern.emotionConfidence = aiEmotion.confidence;
            pattern.emotionReason = aiEmotion.reason;
        }

        return {
            ...video,
            viral: calculateViralScore(video, avgViews),
            pattern
        };
    });

    // Sort by viral score
    scoredVideos.sort((a, b) => b.viral.viralScore - a.viral.viralScore);

    // Identify outliers
    const outliers = scoredVideos.filter(v => v.viral.isOutlier);
    const superOutliers = scoredVideos.filter(v => v.viral.isSuperOutlier);

    // Extract patterns from outliers - NOW WITH DOMAIN TRACKING
    const winningPatterns = {};
    const domainStats = {};  // NEW: Track domain performance

    outliers.forEach(v => {
        const key = `${v.pattern.hookType}_${v.pattern.emotion}`;
        if (!winningPatterns[key]) {
            winningPatterns[key] = {
                hookType: v.pattern.hookType,
                emotion: v.pattern.emotion,
                structure: v.pattern.structure,
                count: 0,
                totalViews: 0,
                avgViralScore: 0,
                examples: []
            };
        }
        winningPatterns[key].count++;
        winningPatterns[key].totalViews += v.stats?.views || 0;
        winningPatterns[key].examples.push({
            title: v.title,
            views: v.stats?.views || 0,
            viralScore: v.viral.viralScore,
            emotionConfidence: v.pattern.emotionConfidence
        });

        // NEW: Track domain patterns
        const domain = v.pattern.domain || 'general';
        if (!domainStats[domain]) {
            domainStats[domain] = {
                domain: domain,
                subDomains: new Set(),
                count: 0,
                totalViews: 0,
                avgViralScore: 0,
                characters: new Set(),
                actions: new Set(),
                examples: []
            };
        }
        domainStats[domain].count++;
        domainStats[domain].totalViews += v.stats?.views || 0;
        if (v.pattern.subDomain) domainStats[domain].subDomains.add(v.pattern.subDomain);
        if (v.pattern.characters) v.pattern.characters.forEach(c => domainStats[domain].characters.add(c));
        if (v.pattern.actions) v.pattern.actions.forEach(a => domainStats[domain].actions.add(a));
        domainStats[domain].examples.push({
            title: v.title,
            views: v.stats?.views || 0,
            viralScore: v.viral.viralScore
        });
    });

    // Calculate avg viral score per pattern
    Object.keys(winningPatterns).forEach(key => {
        const p = winningPatterns[key];
        p.avgViralScore = Math.round((p.examples.reduce((sum, e) => sum + e.viralScore, 0) / p.count) * 10) / 10;
    });

    // Calculate avg viral score per domain and convert Sets to Arrays
    Object.keys(domainStats).forEach(domain => {
        const d = domainStats[domain];
        d.avgViralScore = Math.round((d.examples.reduce((sum, e) => sum + e.viralScore, 0) / d.count) * 10) / 10;
        d.avgViews = Math.round(d.totalViews / d.count);
        // Convert Sets to Arrays for JSON serialization
        d.subDomains = Array.from(d.subDomains);
        d.characters = Array.from(d.characters);
        d.actions = Array.from(d.actions);
    });

    // Sort patterns by performance
    const sortedPatterns = Object.entries(winningPatterns)
        .map(([key, data]) => ({ key, ...data }))
        .sort((a, b) => b.avgViralScore - a.avgViralScore);

    // Sort domains by performance (views and viral score)
    const sortedDomains = Object.entries(domainStats)
        .map(([domain, data]) => data)
        .sort((a, b) => {
            // Primary: avg viral score
            if (b.avgViralScore !== a.avgViralScore) return b.avgViralScore - a.avgViralScore;
            // Secondary: total views
            return b.totalViews - a.totalViews;
        });

    return {
        avgViews,
        totalVideos: videos.length,
        outliers: outliers.slice(0, 10),
        superOutliers: superOutliers.slice(0, 5),
        outlierCount: outliers.length,
        topVideos: scoredVideos.slice(0, 10),
        winningPatterns: sortedPatterns,
        bestPattern: sortedPatterns[0] || null,
        domainStats: sortedDomains,           // NEW: Domain performance data
        bestDomain: sortedDomains[0] || null, // NEW: Top performing domain
        usedAIEmotions: !!emotionMap
    };
};

// ============================================================
// PATTERN TRACKING & AUTO-KILL
// ============================================================

/**
 * Load viral intelligence data for user
 */
export const loadViralData = async (userId) => {
    try {
        const data = await dataService.viralIntelligence.getViralIntelligence(userId);
        if (data) return data;
    } catch (err) {
        console.error('Failed to load viral data:', err.message);
    }
    return {
        patternAttempts: {},
        killedPatterns: [],
        winningPatterns: [],
        lastAnalysis: null
    };
};

/**
 * Save viral intelligence data for user
 */
const saveViralData = async (userId, data) => {
    try {
        data.lastUpdated = new Date().toISOString();
        await dataService.viralIntelligence.saveViralIntelligence(userId, data);
    } catch (err) {
        console.error('Failed to save viral data:', err.message);
    }
};

/**
 * Track a pattern attempt
 */
export const trackPatternAttempt = async (userId, pattern, videoResult) => {
    const data = await loadViralData(userId);
    const key = `${pattern.hookType}_${pattern.niche || 'general'}`;

    if (!data.patternAttempts[key]) {
        data.patternAttempts[key] = {
            pattern: key,
            attempts: 0,
            winners: 0,
            totalViews: 0,
            lastAttempt: null
        };
    }

    data.patternAttempts[key].attempts++;
    data.patternAttempts[key].totalViews += videoResult.views || 0;
    data.patternAttempts[key].lastAttempt = new Date().toISOString();

    if ((videoResult.views || 0) >= THRESHOLDS.MIN_VIEWS_FOR_WINNER) {
        data.patternAttempts[key].winners++;
    }

    // Check if pattern should be killed
    const attempt = data.patternAttempts[key];
    if (attempt.attempts >= THRESHOLDS.PATTERN_KILL_AFTER && attempt.winners === 0) {
        if (!data.killedPatterns.includes(key)) {
            data.killedPatterns.push(key);
            console.log(`   ☠️ Pattern "${key}" killed after ${attempt.attempts} attempts with 0 winners`);
        }
    }

    await saveViralData(userId, data);
    return data.patternAttempts[key];
};

/**
 * Check if a pattern is killed
 */
export const isPatternKilled = async (userId, hookType, niche = 'general') => {
    const data = await loadViralData(userId);
    const key = `${hookType}_${niche}`;
    return data.killedPatterns.includes(key);
};

/**
 * Get recommended pattern based on viral intelligence
 */
export const getRecommendedPattern = async (userId, analysis) => {
    const data = await loadViralData(userId);

    // If we have winning patterns from analysis, use the best one
    if (analysis?.bestPattern) {
        const key = `${analysis.bestPattern.hookType}_${analysis.bestPattern.emotion}`;
        if (!data.killedPatterns.includes(key)) {
            return {
                hookType: analysis.bestPattern.hookType,
                emotion: analysis.bestPattern.emotion,
                structure: analysis.bestPattern.structure,
                reason: `Top performer with ${analysis.bestPattern.avgViralScore} viral score`,
                examples: analysis.bestPattern.examples.slice(0, 3)
            };
        }
    }

    // Fallback to patterns with best win rate
    const activePatterns = Object.entries(data.patternAttempts)
        .filter(([key]) => !data.killedPatterns.includes(key))
        .map(([key, stats]) => ({
            key,
            ...stats,
            winRate: stats.attempts > 0 ? stats.winners / stats.attempts : 0
        }))
        .filter(p => p.attempts >= 2) // At least 2 attempts
        .sort((a, b) => b.winRate - a.winRate);

    if (activePatterns.length > 0) {
        const best = activePatterns[0];
        const [hookType, niche] = best.key.split('_');
        return {
            hookType,
            niche,
            reason: `${Math.round(best.winRate * 100)}% win rate (${best.winners}/${best.attempts})`,
            stats: best
        };
    }

    // Default recommendation
    return {
        hookType: 'secrets',
        emotion: 'curiosity',
        structure: 'revelation',
        reason: 'Default starter pattern'
    };
};

// ============================================================
// MAIN ANALYSIS FUNCTION
// ============================================================

/**
 * Run full viral intelligence analysis with AI emotion detection
 */
export const runViralAnalysis = async (userId, videos, useAIEmotions = true) => {
    console.log('🧠 Running Viral Intelligence Analysis...');

    // Run AI emotion analysis first
    let emotionMap = null;
    if (useAIEmotions && videos.length > 0) {
        emotionMap = await analyzeEmotionsWithAI(userId, videos);
    }

    const analysis = analyzeForOutliers(videos, emotionMap);

    console.log(`   📊 Channel Average: ${analysis.avgViews} views`);
    console.log(`   🚀 Outliers Found: ${analysis.outlierCount} videos (${THRESHOLDS.OUTLIER_THRESHOLD}x+ above avg)`);
    if (analysis.usedAIEmotions) {
        console.log(`   🤖 AI Emotions: Enabled`)
    }

    if (analysis.superOutliers.length > 0) {
        console.log('   ⭐ Super Outliers:');
        analysis.superOutliers.forEach((v, i) => {
            console.log(`      ${i + 1}. "${v.title.substring(0, 40)}..." - ${v.stats?.views} views (${v.viral.outlierMultiplier}x)`);
        });
    }

    if (analysis.bestPattern) {
        console.log(`   🎯 Best Pattern: ${analysis.bestPattern.hookType} + ${analysis.bestPattern.emotion}`);
        console.log(`      Avg Viral Score: ${analysis.bestPattern.avgViralScore}`);
    }

    // Get recommendation
    const recommendation = await getRecommendedPattern(userId, analysis);

    // Save analysis
    const data = await loadViralData(userId);
    data.lastAnalysis = {
        timestamp: new Date().toISOString(),
        avgViews: analysis.avgViews,
        outlierCount: analysis.outlierCount,
        bestPattern: analysis.bestPattern,
        recommendation
    };
    await saveViralData(userId, data);

    return {
        ...analysis,
        recommendation,
        thresholds: THRESHOLDS
    };
};

export default {
    calculateVelocity,
    calculateViralScore,
    extractWinningPattern,
    analyzeForOutliers,
    runViralAnalysis,
    analyzeEmotionsWithAI,
    trackPatternAttempt,
    isPatternKilled,
    getRecommendedPattern,
    loadViralData,
    THRESHOLDS
};
