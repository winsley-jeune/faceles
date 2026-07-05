import { generateText } from "../llm.js";
import tiktokAnalytics from './tiktok_analytics.js';
import explorationConfig from './exploration_config.js';
import performanceWeights from './performance_weights.js';
import dataService from '../../services/dataService.js';

/**
 * SMART TIKTOK TOPIC GENERATOR
 *
 * Uses "Expected Value" Strategy:
 * - TikTok = Viral Lottery (most flop, some go massive)
 * - High volume approach (accept 80% will underperform)
 * - Optimize for the 20% that can go viral
 * - Pattern interrupts in first 1 second are CRITICAL
 * - Trending sounds/hashtags boost visibility
 */

// ============================================================
// TIKTOK-SPECIFIC HOOK PATTERNS (Expected Value Optimization)
// ============================================================

const TT_HOOK_PATTERNS = {
    // HIGH VIRAL POTENTIAL (risky but high reward)
    'shock-opener': {
        viralPotential: 'high',
        keywords: ['wait', 'hold up', 'nobody talks about', 'this changes everything'],
        emotionalAppeal: 'shock',
        description: 'Pattern interrupt that stops scrolling',
        templates: [
            'Wait... {shocking_statement}',
            'Nobody talks about this {topic} fact',
            'This {topic} hack changes everything',
            'Hold up - {unexpected_reveal}'
        ]
    },
    'controversial-take': {
        viralPotential: 'high',
        keywords: ['unpopular opinion', 'hot take', 'controversial', 'fight me'],
        emotionalAppeal: 'debate',
        description: 'Polarizing content that drives comments',
        templates: [
            'Hot take: {controversial_statement}',
            'Unpopular opinion about {topic}',
            '{controversial_claim} - fight me in the comments',
            'I said what I said: {hot_take}'
        ]
    },
    'story-hook': {
        viralPotential: 'high',
        keywords: ['storytime', 'so basically', 'you won\'t believe', 'the time'],
        emotionalAppeal: 'curiosity',
        description: 'Storytelling hooks that demand completion',
        templates: [
            'Storytime: the {topic} incident',
            'So basically... {story_teaser}',
            'The time I {dramatic_action} and {consequence}',
            'You won\'t believe what happened when {scenario}'
        ]
    },

    // MEDIUM VIRAL POTENTIAL (balanced risk/reward)
    'pov-hook': {
        viralPotential: 'medium',
        keywords: ['pov', 'when you', 'that moment', 'me when'],
        emotionalAppeal: 'relatability',
        description: 'Relatable POV content',
        templates: [
            'POV: {relatable_scenario}',
            'When you {common_situation}',
            'That moment when {relatable_feeling}',
            'Me when {everyday_struggle}'
        ]
    },
    'educational-hook': {
        viralPotential: 'medium',
        keywords: ['learn', 'hack', 'tip', 'how to', 'secret'],
        emotionalAppeal: 'value',
        description: 'Quick educational content',
        templates: [
            '{topic} hack that actually works',
            'Learn this {topic} trick in 30 seconds',
            'The {topic} tip nobody taught you',
            'Secret {topic} technique revealed'
        ]
    },
    'trend-jack': {
        viralPotential: 'medium',
        keywords: ['trend', 'viral', 'everyone', 'fyp'],
        emotionalAppeal: 'fomo',
        description: 'Riding trending formats',
        templates: [
            'Finally trying the viral {topic} trend',
            'The {topic} thing everyone is doing',
            'Testing if this {topic} trend actually works',
            'My take on the {trend} trend'
        ]
    },

    // STUPID HUSTLE (maximum engagement, comment wars)
    'stupid-hustle': {
        viralPotential: 'high',
        keywords: ['hustle', 'passive income', 'side hustle', 'genius', 'scheme', 'sigma'],
        emotionalAppeal: 'outrage + humor',
        description: 'Satirical hustle content that sparks comment wars',
        templates: [
            'Step 1: {create_problem}. Step 2: {sell_solution}',
            'This {descriptor} hustle is either genius or a felony',
            'POV: You just ruined {victim_group}\'s day for ${money}',
            'The side hustle that got me banned from {location}',
            'Sigma grindset: {evil_scheme}',
            'Passive income hack (slightly illegal)'
        ]
    }
};

// TikTok-optimized topic variables
const TT_TOPIC_VARIABLES = {
    topic: ['money', 'dating', 'gym', 'work', 'school', 'parents', 'friends', 'relationship'],
    shocking_statement: [
        'your gym routine is backwards',
        'you\'ve been saving money wrong',
        'this dating advice is toxic',
        'schools actually teach you to be poor'
    ],
    unexpected_reveal: [
        'your boss already knows',
        'it was never about the money',
        'they lied about everything',
        'the algorithm exposed this'
    ],
    controversial_statement: [
        'working hard won\'t make you rich',
        'college is a scam for most people',
        'nice guys don\'t finish last, boring guys do',
        'morning routines are cope'
    ],
    controversial_claim: ['9-5 jobs are modern slavery', 'dating apps ruined dating', 'social media is making us dumber'],
    hot_take: ['hustle culture is toxic', 'your parents were wrong about money', 'success is mostly luck'],
    story_teaser: ['I got fired and it was the best thing ever', 'my side hustle backfired spectacularly'],
    dramatic_action: ['quit my job on the spot', 'called out my boss', 'ghosted everyone'],
    consequence: ['it actually worked out', 'I regret nothing', 'chaos ensued'],
    scenario: ['I tried the viral money hack', 'I confronted my toxic coworker'],
    relatable_scenario: [
        'you\'re pretending to work while scrolling',
        'your alarm goes off on Monday',
        'you read the text but "forget" to reply'
    ],
    common_situation: ['realize it\'s only Tuesday', 'your crush texts back', 'your bank account hits zero'],
    relatable_feeling: ['you overshare with a stranger', 'you realize you\'re the toxic friend'],
    everyday_struggle: ['I pretend to check my notes', 'I rehearse a conversation that never happens'],
    trend: ['quiet quitting', 'girl math', 'Roman Empire', 'delulu'],

    // Stupid hustle variables
    create_problem: ['spread bread in parking lot for birds', 'release mosquitoes', 'hide all the shopping carts', 'disconnect the WiFi', 'puncture bike tires'],
    sell_solution: ['offer car wash service', 'sell bug spray', 'rent carts for $5', 'sell hotspot access', 'offer bike repair'],
    descriptor: ['unhinged', 'chaotic', 'morally gray', 'questionable'],
    victim_group: ['everyone at the beach', 'the whole parking lot', 'every shopper', 'all the gym bros'],
    money: ['500', '1000', '2000', '5000'],
    location: ['Walmart', 'the mall', 'the beach', 'the gym', 'Target'],
    evil_scheme: ['buy all the umbrellas before rain', 'put fake parking tickets then sell removal', 'start rumors then sell solutions']
};

// ============================================================
// TOPIC GENERATION FUNCTIONS
// ============================================================

/**
 * Get recent topics to avoid duplicates (user-scoped)
 */
export const getRecentTopics = async (userId, limit = 20) => {
    try {
        const topics = await dataService.topics.getTopics(userId, 'tiktok', { limit });
        return topics.map(t => t.topic);
    } catch (err) {
        console.error('Failed to load recent TikTok topics:', err.message);
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

    // Reset regex
    varPattern.lastIndex = 0;

    while ((match = varPattern.exec(template)) !== null) {
        const varName = match[1];
        const options = TT_TOPIC_VARIABLES[varName];
        if (options && options.length > 0) {
            // Use weighted selection instead of pure random
            const value = await performanceWeights.selectWeightedVariable(userId, varName, options, 'tiktok');
            result = result.replace(`{${varName}}`, value);
            usedVariables[varName] = value;
        }
    }

    return { topic: result, usedVariables };
};

/**
 * Select hook based on TRUE Expected Value strategy (user-scoped)
 * Uses performance weights + viral potential weighting
 *
 * TRUE EXPECTED VALUE FORMULA:
 * EV = (viral_probability × viral_views) + (normal_probability × normal_views)
 * We weight high-risk hooks higher when channel is new (more lottery tickets)
 * Reduce risk when channel has momentum (protect growth)
 */
const selectHookByExpectedValue = async (userId, niche, isExploring = false) => {
    // Check for niche override
    const isStupidHustle = ['stupid_hustle', 'stupid-hustle', 'hustle'].includes(niche);
    if (isStupidHustle) {
        return { name: 'stupid-hustle', ...TT_HOOK_PATTERNS['stupid-hustle'] };
    }

    // Get performance weights for TikTok hooks
    const weights = await performanceWeights.loadWeights(userId);
    const tiktokHooks = weights.platforms?.tiktok?.hooks || {};
    const killedHooks = weights.killed?.tiktok || [];

    // Filter out killed hooks
    const aliveHooks = Object.entries(TT_HOOK_PATTERNS)
        .filter(([name]) => !killedHooks.includes(name));

    if (aliveHooks.length === 0) {
        // All hooks killed, reset
        console.log('   [RESET] All TikTok hooks killed, resetting...');
        return { name: 'shock-opener', ...TT_HOOK_PATTERNS['shock-opener'] };
    }

    // Calculate Expected Value for each hook
    const hookEVs = aliveHooks.map(([name, hook]) => {
        const stats = tiktokHooks[name] || { attempts: 0, viralHits: 0, totalViews: 0, maxViews: 0 };

        // Base viral probability from hook definition
        let baseViralProb = hook.viralPotential === 'high' ? 0.15 : 0.05;

        // Adjust based on actual performance
        if (stats.attempts >= 3) {
            const actualViralRate = stats.viralHits / stats.attempts;
            baseViralProb = (baseViralProb + actualViralRate) / 2; // Blend definition with reality
        }

        // Calculate expected value
        const avgViews = stats.attempts > 0 ? stats.totalViews / stats.attempts : 500;
        const viralViews = stats.maxViews > 0 ? stats.maxViews : 10000;
        const normalViews = Math.min(avgViews, 1000);

        const EV = (baseViralProb * viralViews) + ((1 - baseViralProb) * normalViews);

        // Weight adjustment based on performance history
        const performanceWeight = stats.weight || performanceWeights.CONFIG.BASE_WEIGHT;

        return {
            name,
            hook,
            EV,
            performanceWeight,
            combinedScore: EV * performanceWeight,
            viralPotential: hook.viralPotential,
            stats
        };
    });

    // Sort by combined score (EV × performance weight)
    hookEVs.sort((a, b) => b.combinedScore - a.combinedScore);

    // Expected Value distribution with exploration
    if (isExploring) {
        // 40% pick lower-ranked hook for exploration
        if (Math.random() < 0.4 && hookEVs.length > 2) {
            const explorationIndex = Math.floor(Math.random() * (hookEVs.length - 2)) + 2;
            const selected = hookEVs[explorationIndex];
            console.log(`   🔬 EV Exploration: ${selected.name} (EV: ${Math.round(selected.EV)})`);
            return { name: selected.name, ...selected.hook };
        }
    }

    // 80% from top 3 hooks weighted by EV, 20% random from all
    if (Math.random() < 0.8 && hookEVs.length >= 3) {
        const top3 = hookEVs.slice(0, 3);
        const totalScore = top3.reduce((sum, h) => sum + h.combinedScore, 0);
        let rand = Math.random() * totalScore;

        for (const h of top3) {
            rand -= h.combinedScore;
            if (rand <= 0) {
                console.log(`   📊 EV Selected: ${h.name} (EV: ${Math.round(h.EV)}, weight: ${h.performanceWeight.toFixed(2)})`);
                return { name: h.name, ...h.hook };
            }
        }
        return { name: top3[0].name, ...top3[0].hook };
    }

    // Random selection for exploration
    const randomIndex = Math.floor(Math.random() * hookEVs.length);
    return { name: hookEVs[randomIndex].name, ...hookEVs[randomIndex].hook };
};

/**
 * Generate topic using templates (fast, fallback)
 * Now returns metadata for tracking
 */
const generateFromTemplate = async (userId, hook) => {
    const templateIndex = Math.floor(Math.random() * hook.templates.length);
    const template = hook.templates[templateIndex];
    const hookName = hook.name || 'unknown';
    const templateId = `tt_${hookName}_template_${templateIndex}`;

    const result = await fillTemplate(userId, template);

    return {
        topic: result.topic,
        templateId,
        hookName,
        usedVariables: result.usedVariables
    };
};

/**
 * Generate topic using AI (slower, more creative)
 */
const generateFromAI = async (userId, niche, recentTopics, hook) => {
    if (!process.env.ANTHROPIC_API_KEY) {
        return null;
    }

    const isStupidHustle = ['stupid_hustle', 'stupid-hustle', 'hustle'].includes(niche);

    // Get winning patterns from TikTok analytics
    const patterns = await tiktokAnalytics.loadWinningPatterns(userId);
    const topWinners = patterns.winners?.slice(0, 5) || [];

    let prompt;

    if (isStupidHustle) {
        prompt = `You are a SATIRICAL TikTok content creator. Generate ABSURD "sigma grindset" hustle ideas that spark outrage and debate.

🎭 CONTENT TYPE: STUPID HUSTLE (Engagement Bait)
Goal: Make people FIGHT in comments arguing if it's genius or criminal.

📌 FORMULA: "Create the problem, sell the solution"
Examples:
- "Buy all bread, spread in parking lot, birds poop on cars, offer car wash"
- "Release mosquitoes near your bug spray stand"
- "Hide shopping carts, rent them out for $5"
- "Sigma grindset: puncture tires near your repair shop"

🎯 TIKTOK REQUIREMENTS:
1. Pattern interrupt in FIRST WORD
2. Must stop mid-scroll
3. Trigger OUTRAGE or DISBELIEF
4. Gen-Z TikTok language/slang
5. Under 50 characters (TikTok is FAST)

❌ ALREADY USED (don't repeat):
${recentTopics.slice(-10).map(t => `- ${t}`).join('\n')}

Generate ONE satirical hustle hook. Return ONLY the hook. Nothing else.`;
    } else {
        prompt = `You are a viral TikTok creator. Generate a scroll-stopping hook using EXPECTED VALUE strategy (optimize for viral potential).

🎯 HOOK TYPE: ${hook.name || 'shock-opener'}
Emotional appeal: ${hook.emotionalAppeal}
Description: ${hook.description}

📊 TOP PERFORMING TIKTOKS (study these):
${topWinners.length > 0
    ? topWinners.map(v => `"${v.title || v.description?.substring(0, 50)}" - ${v.views || 0} views`).join('\n')
    : 'No data yet - use TikTok best practices'}

🎯 NICHE: ${niche}

📌 TIKTOK RULES (CRITICAL):
1. PATTERN INTERRUPT in first 1-2 words
2. Must make someone STOP scrolling
3. Under 50 characters (TikTok is FAST)
4. Use Gen-Z language/slang
5. Hook types that work: shock, story, controversy, POV
6. Avoid: long intros, "in this video", boring starts

❌ ALREADY USED (don't repeat):
${recentTopics.slice(-10).map(t => `- ${t}`).join('\n')}

Generate ONE TikTok hook. Return ONLY the hook. Nothing else.`;
    }

    try {
        const responseText = await generateText(prompt);
        let topic = responseText.trim();

        // Clean up
        topic = topic.replace(/^["'\-\s]+|["'\-\s]+$/g, '').trim();
        topic = topic.split('\n')[0];

        // Validate
        if (topic.length > 80 || topic.length < 8) {
            console.log(`   ⚠️ Rejected AI topic (bad length): "${topic}"`);
            return null;
        }

        return topic;
    } catch (err) {
        console.error('   ⚠️ AI generation failed:', err.message);
        return null;
    }
};

/**
 * MAIN: Generate smart TikTok topic using TRUE Expected Value strategy (user-scoped)
 * NOW POWERED BY:
 * 1. PERFORMANCE WEIGHTS - Weighted selection based on historical success
 * 2. EXPLORATION CONFIG - Explore/exploit balance
 * 3. TRUE EXPECTED VALUE - EV = (viral_prob × viral_views) + (normal_prob × normal_views)
 */
export const generateSmartTikTokTopic = async (userId, niche = 'general', useAI = true) => {
    console.log('🎵 Generating smart TikTok topic (TRUE EXPECTED VALUE)...');
    console.log(`   User: ${userId}`);

    // CHECK EXPLORATION CONFIG FIRST
    const explorationDecision = await explorationConfig.shouldExplore(userId, 'tiktok');
    const stupidHustleDecision = await explorationConfig.shouldBeStupidHustle(userId, 'tiktok');

    console.log(`   🎲 Exploration decision: ${explorationDecision.isExploration ? 'EXPLORE' : 'EXPLOIT'} (${explorationDecision.reason})`);

    // If exploration mode selected stupid_hustle, override niche
    if (stupidHustleDecision.isStupidHustle) {
        niche = 'stupid_hustle';
        console.log(`   🎭 Stupid Hustle mode activated! (${stupidHustleDecision.escalationLevel} chaos)`);
    } else if (explorationDecision.isExploration && explorationDecision.type !== 'exploit') {
        console.log(`   🔬 Exploration type: ${explorationDecision.type}`);
    }

    const recentTopics = await getRecentTopics(userId, 20);

    // Select hook using TRUE Expected Value calculation (with performance weights)
    const hook = await selectHookByExpectedValue(userId, niche, explorationDecision.isExploration);
    const hookName = hook.name || 'unknown';

    console.log(`   🎯 Hook type: ${hookName} (viral potential: ${hook.viralPotential || 'high'})`);
    console.log(`   📝 Recent topics to avoid: ${recentTopics.length}`);

    let topic = null;
    let templateResult = null;
    let source = 'unknown';
    let attempts = 0;
    const maxAttempts = 5;

    // Try AI first if enabled
    while (!topic && attempts < maxAttempts) {
        attempts++;

        if (useAI && attempts <= 2) {
            topic = await generateFromAI(userId, niche, recentTopics, hook);
            source = 'ai-expected-value';
        }

        // Fallback to template (with weighted variables)
        if (!topic) {
            templateResult = await generateFromTemplate(userId, hook);
            topic = templateResult.topic;
            source = 'template-weighted-ev';
        }

        // Check for duplicates
        if (topic && recentTopics.some(t => t.toLowerCase().includes(topic.toLowerCase().substring(0, 15)))) {
            console.log(`   🔄 Duplicate detected, regenerating...`);
            topic = null;
            templateResult = null;
        }
    }

    if (!topic) {
        templateResult = await generateFromTemplate(userId, hook);
        topic = templateResult.topic;
        source = 'fallback-weighted';
    }

    console.log(`   ✅ Generated: "${topic}" (source: ${source})`);

    // Save topic to database
    const topicData = {
        topic,
        niche,
        hook: hookName,
        source: 'smart_tiktok_generator',
        metadata: {
            hookType: hookName,
            viralPotential: hook.viralPotential,
            source,
            templateId: templateResult?.templateId || null,
            usedVariables: templateResult?.usedVariables || {},
            strategy: 'true-expected-value',
            timestamp: new Date().toISOString()
        }
    };

    try {
        await dataService.topics.saveTopic(userId, 'tiktok', topicData);
    } catch (err) {
        console.error('   ⚠️ Failed to save topic:', err.message);
    }

    return {
        topic,
        niche,
        platform: 'tiktok',
        source,
        patterns: {
            hook: hookName,
            emotion: hook.emotionalAppeal,
            viralPotential: hook.viralPotential
        },
        templateInfo: templateResult ? {
            templateId: templateResult.templateId,
            usedVariables: templateResult.usedVariables
        } : null,
        analytics: {
            strategy: 'true-expected-value',
            viralPotential: hook.viralPotential,
            reason: 'TikTok EV optimization: (viral_prob × viral_views) + (normal_prob × normal_views)'
        }
    };
};

/**
 * Get best patterns analysis (user-scoped)
 */
export const getBestPatterns = async (userId) => {
    const patterns = await tiktokAnalytics.loadWinningPatterns(userId);
    return {
        topHooks: Object.entries(patterns.patterns?.hooks || {})
            .sort((a, b) => (b[1].avgViews || 0) - (a[1].avgViews || 0))
            .slice(0, 5),
        viralRate: patterns.viralRate || 0,
        winnerCount: patterns.winners?.length || 0
    };
};

export default {
    generateSmartTikTokTopic,
    getRecentTopics,
    getBestPatterns,
    TT_HOOK_PATTERNS,
    TT_TOPIC_VARIABLES
};
