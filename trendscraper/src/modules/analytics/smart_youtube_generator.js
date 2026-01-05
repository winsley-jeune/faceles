import { GoogleGenerativeAI } from "@google/generative-ai";
import youtubeAnalytics from './youtube_analytics.js';
import explorationConfig from './exploration_config.js';
import performanceWeights from './performance_weights.js';
import dataService from '../../services/dataService.js';

/**
 * SMART YOUTUBE TOPIC GENERATOR
 *
 * Uses "Minimax" Strategy:
 * - Minimize early drop-off (first 3 seconds = life or death)
 * - Maximize watch time completion (algorithm rewards retention)
 * - Professional, polished content expected
 * - Balance education + entertainment
 * - CTR (Click-Through Rate) matters more than pure virality
 *
 * Key Metrics:
 * - Average View Duration (AVD) - most important
 * - Watch Time - feeds recommendations
 * - CTR - hook effectiveness
 * - Completion Rate - signals quality
 */

// ============================================================
// YOUTUBE-SPECIFIC HOOK PATTERNS (Minimax Optimization)
// ============================================================

const YT_HOOK_PATTERNS = {
    // HIGH RETENTION HOOKS (Maximize watch time)
    'curiosity-gap': {
        retentionScore: 0.9,
        ctrScore: 0.8,
        keywords: ['secret', 'hidden', 'nobody knows', 'finally revealed'],
        emotionalAppeal: 'curiosity',
        description: 'Creates information gap viewers need to fill',
        templates: [
            'The {topic} secret nobody talks about',
            'Why {common_belief} is completely wrong',
            'I finally discovered why {mystery}',
            'What they don\'t want you to know about {topic}'
        ]
    },
    'transformation-hook': {
        retentionScore: 0.85,
        ctrScore: 0.75,
        keywords: ['changed', 'transformed', 'never the same', 'breakthrough'],
        emotionalAppeal: 'aspiration',
        description: 'Promise of transformation keeps viewers watching',
        templates: [
            'This {topic} method changed everything for me',
            'How I went from {bad_state} to {good_state}',
            'The {topic} transformation nobody expected',
            'After this, you\'ll never see {topic} the same way'
        ]
    },
    'problem-agitate-solve': {
        retentionScore: 0.85,
        ctrScore: 0.7,
        keywords: ['struggling', 'frustrated', 'finally', 'solution'],
        emotionalAppeal: 'relief',
        description: 'Classic PAS framework for retention',
        templates: [
            'Tired of {problem}? Here\'s what actually works',
            'I was struggling with {problem} until I discovered this',
            'The {topic} solution that finally worked',
            'Stop wasting time on {ineffective_method}'
        ]
    },

    // MEDIUM-HIGH RETENTION (Balanced approach)
    'insider-knowledge': {
        retentionScore: 0.8,
        ctrScore: 0.85,
        keywords: ['pro', 'expert', 'insider', 'industry'],
        emotionalAppeal: 'exclusivity',
        description: 'Makes viewer feel they\'re getting exclusive info',
        templates: [
            '{expert_type} explains {topic} in {timeframe}',
            'What {industry} insiders know about {topic}',
            'Pro {topic} tips they don\'t teach you',
            'The {topic} trick every {expert_type} uses'
        ]
    },
    'myth-buster': {
        retentionScore: 0.75,
        ctrScore: 0.8,
        keywords: ['myth', 'wrong', 'lie', 'truth'],
        emotionalAppeal: 'revelation',
        description: 'Challenges beliefs, keeps viewers to see proof',
        templates: [
            'The biggest {topic} myth exposed',
            'Everything you know about {topic} is wrong',
            'This {topic} advice is actually harmful',
            'Why {common_practice} is a complete waste'
        ]
    },
    'educational-value': {
        retentionScore: 0.75,
        ctrScore: 0.7,
        keywords: ['learn', 'understand', 'explained', 'guide'],
        emotionalAppeal: 'value',
        description: 'Clear value proposition for watch time',
        templates: [
            '{topic} explained in {timeframe}',
            'Learn {topic} faster than 99% of people',
            'The complete guide to {topic}',
            'Understanding {topic}: what matters most'
        ]
    },

    // STORYTELLING HOOKS (High retention through narrative)
    'story-arc': {
        retentionScore: 0.9,
        ctrScore: 0.75,
        keywords: ['story', 'happened', 'journey', 'experience'],
        emotionalAppeal: 'narrative',
        description: 'Story structure forces completion',
        templates: [
            'What happened when I tried {experiment}',
            'The {topic} journey that surprised everyone',
            'I tested {method} for {timeframe} - here\'s what happened',
            'The day {unexpected_event} changed my view on {topic}'
        ]
    },
    'conflict-resolution': {
        retentionScore: 0.85,
        ctrScore: 0.7,
        keywords: ['mistake', 'failed', 'fixed', 'recovered'],
        emotionalAppeal: 'redemption',
        description: 'Viewers stay to see the resolution',
        templates: [
            'My biggest {topic} mistake (and how I fixed it)',
            'I failed at {topic} until I realized this',
            'The {topic} disaster that taught me everything',
            'How I recovered from my {topic} failure'
        ]
    }
};

// YouTube-optimized topic variables
const YT_TOPIC_VARIABLES = {
    topic: ['productivity', 'money', 'career', 'health', 'mindset', 'business', 'technology', 'psychology'],
    common_belief: [
        'working harder leads to success',
        'you need talent to succeed',
        'morning routines matter most',
        'multitasking is efficient'
    ],
    mystery: [
        'successful people think differently',
        'some people never seem stressed',
        'experts make it look easy',
        'top performers stay consistent'
    ],
    bad_state: ['burned out', 'stuck', 'confused', 'overwhelmed'],
    good_state: ['thriving', 'confident', 'focused', 'achieving goals'],
    problem: [
        'procrastination',
        'lack of focus',
        'feeling stuck',
        'information overload',
        'decision fatigue'
    ],
    ineffective_method: [
        'willpower alone',
        'working longer hours',
        'copying others',
        'following generic advice'
    ],
    expert_type: ['psychologist', 'CEO', 'researcher', 'coach', 'scientist'],
    industry: ['tech', 'finance', 'consulting', 'healthcare', 'startup'],
    timeframe: ['60 seconds', '2 minutes', '30 seconds', 'under a minute'],
    common_practice: [
        'setting goals the traditional way',
        'following morning routine advice',
        'trying to stay motivated',
        'reading self-help books'
    ],
    experiment: [
        'waking up at 5am for 30 days',
        'the 2-minute rule',
        'eliminating all distractions',
        'saying no to everything'
    ],
    method: [
        'the Pomodoro technique',
        'time blocking',
        'deep work',
        'the 80/20 rule'
    ],
    unexpected_event: [
        'I got fired',
        'I failed publicly',
        'everything fell apart',
        'my plan completely changed'
    ]
};

// ============================================================
// TOPIC GENERATION FUNCTIONS
// ============================================================

/**
 * Get recent topics to avoid duplicates (user-scoped)
 */
export const getRecentTopics = async (userId, limit = 20) => {
    try {
        const topics = await dataService.topics.getTopics(userId, 'youtube', { limit });
        return topics.map(t => t.topic);
    } catch (err) {
        console.error('Failed to load recent YouTube topics:', err.message);
        return [];
    }
};

/**
 * Fill a template with WEIGHTED random variables
 * Uses performance_weights.js instead of pure Math.random()
 */
const fillTemplate = async (userId, template) => {
    let result = template;
    const usedVariables = {};
    const varPattern = /\{(\w+)\}/g;
    let match;

    varPattern.lastIndex = 0;

    while ((match = varPattern.exec(template)) !== null) {
        const varName = match[1];
        const options = YT_TOPIC_VARIABLES[varName];
        if (options && options.length > 0) {
            const value = await performanceWeights.selectWeightedVariable(userId, varName, options, 'youtube');
            result = result.replace(`{${varName}}`, value);
            usedVariables[varName] = value;
        }
    }

    return { topic: result, usedVariables };
};

/**
 * MINIMAX STRATEGY: Select hook that minimizes drop-off, maximizes retention
 *
 * Key insight: YouTube rewards COMPLETION more than clicks
 * - High CTR + Low Retention = Algorithm punishes
 * - Medium CTR + High Retention = Algorithm rewards
 *
 * We weight retention MORE than CTR (unlike clickbait strategies)
 */
const selectHookByMinimax = async (userId, niche, channelStats = null) => {
    const weights = await performanceWeights.loadWeights(userId);
    const youtubeHooks = weights.platforms?.youtube?.hooks || {};
    const killedHooks = weights.killed?.youtube || [];

    // Filter out killed hooks
    const aliveHooks = Object.entries(YT_HOOK_PATTERNS)
        .filter(([name]) => !killedHooks.includes(name));

    if (aliveHooks.length === 0) {
        console.log('   [RESET] All YouTube hooks killed, resetting...');
        return { name: 'curiosity-gap', ...YT_HOOK_PATTERNS['curiosity-gap'] };
    }

    // Calculate Minimax score for each hook
    const hookScores = aliveHooks.map(([name, hook]) => {
        const stats = youtubeHooks[name] || {
            attempts: 0,
            avgViewDuration: 0,
            avgWatchPercent: 0,
            totalViews: 0,
            avgCTR: 0
        };

        // Base scores from hook definition
        let retentionScore = hook.retentionScore || 0.7;
        let ctrScore = hook.ctrScore || 0.7;

        // Blend with actual performance data if available
        if (stats.attempts >= 3) {
            // Normalize watch percent to 0-1 scale
            const actualRetention = stats.avgWatchPercent / 100;
            retentionScore = (retentionScore + actualRetention) / 2;

            // CTR is usually 2-10%, normalize to 0-1
            const actualCTR = Math.min(stats.avgCTR / 10, 1);
            ctrScore = (ctrScore + actualCTR) / 2;
        }

        // MINIMAX FORMULA:
        // Weight retention 70%, CTR 30% (YouTube rewards completion)
        // Minimize "regret" = (1 - retention)
        // Maximize "value" = retention × 0.7 + ctr × 0.3
        const minimaxScore = (retentionScore * 0.7) + (ctrScore * 0.3);

        // Apply performance weight
        const performanceWeight = stats.weight || performanceWeights.CONFIG.BASE_WEIGHT;

        return {
            name,
            hook,
            retentionScore,
            ctrScore,
            minimaxScore,
            performanceWeight,
            combinedScore: minimaxScore * performanceWeight,
            stats
        };
    });

    // Sort by combined minimax score
    hookScores.sort((a, b) => b.combinedScore - a.combinedScore);

    // Exploration strategy
    const exploration = explorationConfig.getExplorationDecision('youtube');

    if (exploration.isExploring) {
        // 30% pick from bottom half for exploration
        if (Math.random() < 0.3 && hookScores.length > 3) {
            const halfPoint = Math.floor(hookScores.length / 2);
            const explorationIndex = halfPoint + Math.floor(Math.random() * (hookScores.length - halfPoint));
            const selected = hookScores[explorationIndex];
            console.log(`   🔬 Minimax Exploration: ${selected.name} (retention: ${(selected.retentionScore * 100).toFixed(0)}%)`);
            return { name: selected.name, ...selected.hook };
        }
    }

    // 80% from top 3 hooks weighted by minimax score, 20% random
    if (Math.random() < 0.8 && hookScores.length >= 3) {
        const top3 = hookScores.slice(0, 3);
        const totalScore = top3.reduce((sum, h) => sum + h.combinedScore, 0);
        let rand = Math.random() * totalScore;

        for (const h of top3) {
            rand -= h.combinedScore;
            if (rand <= 0) {
                console.log(`   📊 Minimax Selected: ${h.name} (retention: ${(h.retentionScore * 100).toFixed(0)}%, CTR: ${(h.ctrScore * 100).toFixed(0)}%)`);
                return { name: h.name, ...h.hook };
            }
        }
        return { name: top3[0].name, ...top3[0].hook };
    }

    // Random fallback
    const randomIndex = Math.floor(Math.random() * hookScores.length);
    return { name: hookScores[randomIndex].name, ...hookScores[randomIndex].hook };
};

/**
 * Generate topic using templates (fast, fallback)
 * Returns metadata for tracking
 */
const generateFromTemplate = async (userId, hook) => {
    const templateIndex = Math.floor(Math.random() * hook.templates.length);
    const template = hook.templates[templateIndex];
    const hookName = hook.name || 'unknown';
    const templateId = `yt_${hookName}_template_${templateIndex}`;

    const result = await fillTemplate(userId, template);

    return {
        topic: result.topic,
        templateId,
        hookName,
        usedVariables: result.usedVariables
    };
};

/**
 * Generate AI-enhanced topic for YouTube
 */
const generateWithAI = async (userId, niche, hook, recentTopics = []) => {
    if (!process.env.GEMINI_API_KEY) {
        console.log('   ⚠️ No Gemini API key, using template');
        return null;
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Get winning patterns
        let winningPatterns = '';
        try {
            const analytics = await youtubeAnalytics.getAnalyticsSummary(userId);
            if (analytics?.topVideos?.length > 0) {
                winningPatterns = `
TOP PERFORMING YOUTUBE VIDEOS (learn from these):
${analytics.topVideos.slice(0, 5).map((v, i) =>
    `${i + 1}. "${v.title}" - ${v.views} views, ${v.avgViewDuration || 0}s avg watch time`
).join('\n')}
                `;
            }
        } catch (e) {
            // No analytics yet
        }

        const prompt = `
Generate ONE YouTube Shorts topic for the "${niche}" niche.

HOOK STYLE: ${hook.emotionalAppeal}
${hook.description}

${winningPatterns}

AVOID THESE RECENT TOPICS:
${recentTopics.slice(0, 10).join('\n')}

YOUTUBE SHORTS REQUIREMENTS:
1. Hook must grab attention in first 3 seconds
2. Promise clear value viewers can learn
3. Professional, polished tone (not TikTok casual)
4. Topic should naturally lead to 45-60 second explanation
5. Must be educational AND entertaining

OUTPUT: Just the topic title, nothing else.
The topic should match this style: "${hook.templates[0]}"
        `;

        const result = await model.generateContent(prompt);
        const topic = result.response.text().trim().replace(/["\n]/g, '').slice(0, 150);

        if (topic && topic.length > 15 && !recentTopics.includes(topic)) {
            return topic;
        }
    } catch (err) {
        console.log(`   ⚠️ AI generation failed: ${err.message}`);
    }

    return null;
};

/**
 * Main YouTube topic generator with Minimax strategy (user-scoped)
 */
export const generateSmartYouTubeTopic = async (userId, niche = 'general', options = {}) => {
    console.log('\n🎬 [YouTube Smart Generator - Minimax Strategy]');
    console.log(`   User: ${userId}`);
    console.log(`   Niche: ${niche}`);

    // Get channel stats if available
    let channelStats = null;
    try {
        const analytics = await youtubeAnalytics.getAnalyticsSummary(userId);
        if (analytics) {
            channelStats = {
                avgViews: analytics.avgViews || 500,
                avgRetention: analytics.avgWatchPercent || 50,
                totalVideos: analytics.totalVideos || 0
            };
            console.log(`   📊 Channel stats: ${channelStats.avgViews} avg views, ${channelStats.avgRetention}% retention`);
        }
    } catch (e) {
        console.log('   ℹ️ No YouTube analytics yet');
    }

    // Exploration decision
    const exploration = await explorationConfig.getExplorationDecision(userId, 'youtube');
    console.log(`   🎲 Strategy: ${exploration.isExploring ? 'EXPLORE (trying new hooks)' : 'EXPLOIT (using proven winners)'}`);

    // Select hook using Minimax strategy
    const hook = await selectHookByMinimax(userId, niche, channelStats);
    console.log(`   🎯 Hook pattern: ${hook.name} (${hook.emotionalAppeal})`);

    // Get recent topics to avoid duplicates
    const recentTopics = await getRecentTopics(userId);

    // Try AI generation first
    let topic = await generateWithAI(userId, niche, hook, recentTopics);
    let generationMethod = 'ai';

    // Fallback to template
    if (!topic) {
        const templateResult = await generateFromTemplate(userId, hook);
        topic = templateResult.topic;
        generationMethod = 'template';
    }

    console.log(`   ✅ Generated (${generationMethod}): "${topic}"`);

    // Track this topic
    const topicData = {
        topic,
        niche,
        hook: hook.name,
        source: 'smart_youtube_generator',
        metadata: {
            hookType: hook.name,
            emotionalAppeal: hook.emotionalAppeal,
            retentionScore: hook.retentionScore,
            ctrScore: hook.ctrScore,
            strategy: 'minimax',
            exploration: exploration.isExploring,
            generationMethod,
            timestamp: new Date().toISOString()
        }
    };

    // Save topic to database
    try {
        await dataService.topics.saveTopic(userId, 'youtube', topicData);
    } catch (err) {
        console.error('   ⚠️ Failed to save topic:', err.message);
    }

    // Track usage in performance weights
    try {
        await performanceWeights.trackHookUsage(userId, hook.name, 'youtube');
    } catch (e) {
        // Non-critical
    }

    return {
        topic,
        metadata: {
            hookType: hook.name,
            emotionalAppeal: hook.emotionalAppeal,
            retentionScore: hook.retentionScore,
            ctrScore: hook.ctrScore,
            strategy: 'minimax',
            exploration: exploration.isExploring,
            generationMethod
        }
    };
};

/**
 * Calculate retention optimization insights (user-scoped)
 * Used for post-generation storyboard tuning
 */
export const getRetentionOptimization = async (userId) => {
    const weights = await performanceWeights.loadWeights(userId);
    const youtubeHooks = weights.platforms?.youtube?.hooks || {};

    // Find hooks with best retention
    const retentionRanking = Object.entries(youtubeHooks)
        .filter(([_, stats]) => stats.attempts >= 3)
        .map(([name, stats]) => ({
            name,
            avgRetention: stats.avgWatchPercent || 0,
            attempts: stats.attempts
        }))
        .sort((a, b) => b.avgRetention - a.avgRetention);

    // Find common drop-off points
    const dropOffInsights = {
        earlyDropOff: [], // Hooks with <40% retention
        goodRetention: [], // Hooks with >60% retention
        recommendation: ''
    };

    retentionRanking.forEach(h => {
        if (h.avgRetention < 40) dropOffInsights.earlyDropOff.push(h.name);
        if (h.avgRetention > 60) dropOffInsights.goodRetention.push(h.name);
    });

    if (dropOffInsights.goodRetention.length > 0) {
        dropOffInsights.recommendation = `Focus on "${dropOffInsights.goodRetention[0]}" hooks - they have best retention`;
    } else {
        dropOffInsights.recommendation = 'Not enough data yet. Keep experimenting with different hooks.';
    }

    return {
        ranking: retentionRanking.slice(0, 5),
        insights: dropOffInsights
    };
};

export default {
    generateSmartYouTubeTopic,
    getRecentTopics,
    getRetentionOptimization,
    YT_HOOK_PATTERNS,
    YT_TOPIC_VARIABLES
};
