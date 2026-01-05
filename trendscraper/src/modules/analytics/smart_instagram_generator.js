import { GoogleGenerativeAI } from "@google/generative-ai";
import instagramAnalytics from './instagram_analytics.js';
import explorationConfig from './exploration_config.js';
import performanceWeights from './performance_weights.js';
import dataService from '../../services/dataService.js';

/**
 * SMART INSTAGRAM TOPIC GENERATOR
 *
 * Uses "Nash Equilibrium" Strategy:
 * - Balance between follower engagement and new viewer acquisition
 * - 70% follower-friendly content (retention)
 * - 30% reach-optimized content (growth)
 * - Saves are algorithm gold (high-value content signals)
 * - Shares = new audience reach
 */

// ============================================================
// INSTAGRAM-SPECIFIC HOOK PATTERNS (Nash Equilibrium)
// ============================================================

const IG_HOOK_PATTERNS = {
    // FOLLOWER-FRIENDLY (70%) - Content for existing audience
    'aesthetic-value': {
        type: 'follower',
        keywords: ['satisfying', 'aesthetic', 'vibes', 'mood', 'cozy', 'dreamy'],
        emotionalAppeal: 'visual pleasure',
        description: 'Beautiful, save-worthy content followers love',
        templates: [
            'The most satisfying {topic} you\'ll see today',
            '{aesthetic} vibes that just hit different',
            'This {topic} is giving everything'
        ]
    },
    'insider-tips': {
        type: 'follower',
        keywords: ['hack', 'tip', 'trick', 'secret', 'game changer', 'life hack'],
        emotionalAppeal: 'value',
        description: 'Useful tips followers will save',
        templates: [
            '{number} {topic} hacks you need to try',
            'The {topic} tip that changed my life',
            'Save this before you forget: {topic} hack'
        ]
    },
    'transformation': {
        type: 'follower',
        keywords: ['before after', 'glow up', 'transformation', 'progress', 'journey'],
        emotionalAppeal: 'inspiration',
        description: 'Transformation content that inspires saves',
        templates: [
            'My {topic} transformation in {time}',
            'This {topic} glow up is insane',
            'From {before} to {after}: my {topic} journey'
        ]
    },

    // REACH-OPTIMIZED (30%) - Content for new viewers
    'trending-audio': {
        type: 'reach',
        keywords: ['trend', 'viral', 'fyp', 'trending', 'blowing up'],
        emotionalAppeal: 'fomo',
        description: 'Trend-jacking for algorithm reach',
        templates: [
            'This {topic} trend is taking over',
            'POV: You finally try the viral {topic}',
            'The {topic} everyone is talking about'
        ]
    },
    'controversial-take': {
        type: 'reach',
        keywords: ['unpopular opinion', 'hot take', 'fight me', 'controversial'],
        emotionalAppeal: 'debate',
        description: 'Polarizing content that drives shares',
        templates: [
            'Unpopular opinion: {controversial_take}',
            'This {topic} take is gonna get me canceled',
            'Hot take on {topic} (don\'t come for me)'
        ]
    },
    'relatable-moment': {
        type: 'reach',
        keywords: ['pov', 'when you', 'that feeling', 'its giving', 'the way'],
        emotionalAppeal: 'belonging',
        description: 'Shareable relatable content',
        templates: [
            'POV: {relatable_scenario}',
            'It\'s the {relatable_thing} for me',
            'The way {relatable_action} just hits different'
        ]
    },

    // STUPID HUSTLE (for engagement bait when niche=stupid_hustle)
    'stupid-hustle': {
        type: 'reach',
        keywords: ['hustle', 'passive income', 'side hustle', 'genius', 'scheme'],
        emotionalAppeal: 'outrage + humor',
        description: 'Satirical hustle content that sparks comment wars',
        templates: [
            'Step 1: {create_problem}. Step 2: {sell_solution}',
            'This {descriptor} hustle is either genius or a felony',
            'POV: You just ruined {victim_group}\'s day for ${money}',
            'The side hustle that got me banned from {location}'
        ]
    }
};

// Instagram-optimized topic variables
const IG_TOPIC_VARIABLES = {
    topic: ['skincare', 'coffee', 'outfit', 'room', 'morning routine', 'self care', 'productivity', 'aesthetic'],
    number: ['3', '5', '7'],
    aesthetic: ['cozy', 'clean girl', 'that girl', 'soft girl', 'dark academia', 'cottagecore'],
    time: ['30 days', '1 week', '6 months'],
    before: ['struggling', 'unmotivated', 'lost'],
    after: ['thriving', 'glowing', 'confident'],
    controversial_take: [
        'morning routines are overrated',
        'hustle culture is toxic',
        'not everyone needs a skincare routine',
        'aesthetic isn\'t a personality'
    ],
    relatable_scenario: [
        'you\'re overstimulated but keep scrolling',
        'the Sunday scaries hit at 3pm',
        'you say "I\'ll start Monday" for the 5th time'
    ],
    relatable_thing: ['random 3am thoughts', 'overthinking a 2 second interaction', 'doom scrolling'],
    relatable_action: ['you talk to yourself in your head', 'you rehearse conversations'],

    // Stupid hustle variables
    create_problem: ['spread bread in parking lot for birds', 'release mosquitoes', 'hide all the shopping carts', 'disconnect the WiFi'],
    sell_solution: ['offer car wash service', 'sell bug spray', 'rent carts for $5', 'sell hotspot access'],
    descriptor: ['unhinged', 'chaotic', 'morally gray'],
    victim_group: ['everyone at the beach', 'the whole parking lot', 'every driver'],
    money: ['500', '1000', '2000'],
    location: ['Walmart', 'the mall', 'the beach', 'the gym']
};

// ============================================================
// TOPIC GENERATION FUNCTIONS
// ============================================================

/**
 * Get recent topics to avoid duplicates
 */
export const getRecentTopics = async (userId, limit = 20) => {
    try {
        const topics = await dataService.topics.getTopics(userId, 'instagram', { limit });
        return topics.map(t => t.topic);
    } catch (err) {
        console.error('Failed to load recent Instagram topics:', err.message);
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
        const options = IG_TOPIC_VARIABLES[varName];
        if (options && options.length > 0) {
            // Use weighted selection instead of pure random
            const value = await performanceWeights.selectWeightedVariable(userId, varName, options, 'instagram');
            result = result.replace(`{${varName}}`, value);
            usedVariables[varName] = value;
        }
    }

    return { topic: result, usedVariables };
};

/**
 * Generate topic using templates with WEIGHTED selection
 * Uses performance weights for hook and variable selection
 */
const generateFromTemplate = async (userId, hookType = null, contentType = 'follower') => {
    // If hookType specified, use it; otherwise use weighted selection
    let hook;
    let hookName;

    if (hookType && IG_HOOK_PATTERNS[hookType]) {
        hook = IG_HOOK_PATTERNS[hookType];
        hookName = hookType;
    } else {
        // Filter by content type (follower vs reach)
        const hooks = Object.entries(IG_HOOK_PATTERNS)
            .filter(([_, h]) => h.type === contentType);

        // Use weighted selection based on performance
        const hookNames = hooks.map(([name]) => name);
        hookName = await performanceWeights.weightedSelect(userId, hookNames, 'instagram', 'hooks') || hookNames[0];
        hook = IG_HOOK_PATTERNS[hookName];
    }

    const templateIndex = Math.floor(Math.random() * hook.templates.length);
    const template = hook.templates[templateIndex];
    const templateId = `ig_${hookName}_template_${templateIndex}`;

    const result = await fillTemplate(userId, template);

    return {
        topic: result.topic,
        templateId,
        hookName,
        contentType: hook.type,
        usedVariables: result.usedVariables
    };
};

/**
 * Generate topic using AI (slower, more creative)
 */
const generateFromAI = async (userId, niche, recentTopics, contentType = 'follower', recommendation = null) => {
    if (!process.env.GEMINI_API_KEY) {
        return null;
    }

    // Check if this is stupid_hustle niche
    const isStupidHustle = ['stupid_hustle', 'stupid-hustle', 'hustle'].includes(niche);

    // Get winning patterns from Instagram analytics
    const patterns = await instagramAnalytics.loadWinningPatterns(userId);
    const topWinners = patterns.winners?.slice(0, 5) || [];

    let prompt;

    if (isStupidHustle) {
        prompt = `You are a SATIRICAL viral content creator for Instagram Reels. Generate ABSURD "sigma grindset" hustle ideas that spark outrage and debate.

🎭 CONTENT TYPE: STUPID HUSTLE (Engagement Bait)
Goal: Make people FIGHT in comments arguing if it's genius or criminal.

📌 FORMULA: "Create the problem, sell the solution"
Examples:
- "Buy all bread, spread in parking lot, birds poop on cars, offer car wash"
- "Release mosquitoes near your bug spray stand"
- "Puncture bike tires near your bike repair shop"
- "Hide shopping carts, rent them out for $5"
- "Disconnect cafe WiFi, sell hotspot access"

🎯 REQUIREMENTS:
1. Follow "create problem → sell solution" format
2. Must be satirical but sound like a real "hustle tip"
3. Should trigger OUTRAGE or DISBELIEF
4. Make people comment "this is evil" or "this is genius"
5. Keep under 60 characters
6. Use Gen-Z Instagram caption style

❌ ALREADY USED (don't repeat):
${recentTopics.slice(-10).map(t => `- ${t}`).join('\n')}

Generate ONE satirical hustle idea. Return ONLY the idea. Nothing else.`;
    } else {
        prompt = `You are an Instagram Reels content creator. Generate a viral topic using NASH EQUILIBRIUM strategy.

🎯 CONTENT TYPE: ${contentType.toUpperCase()}
${contentType === 'follower'
    ? '- Focus on VALUE and SAVES (tips, tutorials, transformations)\n- Make followers want to SAVE and revisit\n- Quality over virality'
    : '- Focus on REACH and SHARES\n- Trend-jack, be relatable, spark debate\n- Optimize for new audience discovery'}

📊 TOP PERFORMING REELS (study these):
${topWinners.length > 0
    ? topWinners.map(v => `"${v.title || v.caption?.substring(0, 50)}" - ${v.views || 0} views`).join('\n')
    : 'No data yet - use Instagram best practices'}

🎯 NICHE: ${niche}

📌 INSTAGRAM RULES:
1. Under 60 characters
2. Use casual, Gen-Z language
3. Include relevant keywords for SEO
4. ${contentType === 'follower' ? 'Make it SAVE-worthy (actionable tips, beautiful content)' : 'Make it SHARE-worthy (relatable, surprising, debatable)'}
5. Match Instagram's aesthetic vibe

❌ ALREADY USED (don't repeat):
${recentTopics.slice(-10).map(t => `- ${t}`).join('\n')}

Generate ONE Instagram Reel topic. Return ONLY the topic. Nothing else.`;
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        let topic = result.response.text().trim();

        // Clean up
        topic = topic.replace(/^["'\-\s]+|["'\-\s]+$/g, '').trim();
        topic = topic.split('\n')[0];

        // Validate
        if (topic.length > 100 || topic.length < 10) {
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
 * Calculate DYNAMIC Nash Equilibrium ratio based on actual engagement data
 * The 70/30 split should LEARN and adapt, not be hardcoded!
 */
const calculateDynamicNashRatio = async (userId) => {
    const weights = await performanceWeights.loadWeights(userId);
    const igData = weights.platforms?.instagram || {};

    // Get performance of follower vs reach content
    const followerHooks = ['aesthetic-value', 'insider-tips', 'transformation'];
    const reachHooks = ['trending-audio', 'controversial-take', 'relatable-moment'];

    let followerScore = 0;
    let reachScore = 0;
    let followerAttempts = 0;
    let reachAttempts = 0;

    // Calculate average performance per content type
    for (const hookName of followerHooks) {
        const stats = igData.hooks?.[hookName];
        if (stats && stats.attempts > 0) {
            followerScore += stats.weight || 1;
            followerAttempts += stats.attempts;
        }
    }

    for (const hookName of reachHooks) {
        const stats = igData.hooks?.[hookName];
        if (stats && stats.attempts > 0) {
            reachScore += stats.weight || 1;
            reachAttempts += stats.attempts;
        }
    }

    // If not enough data, use default 70/30
    if (followerAttempts < 5 && reachAttempts < 5) {
        return { followerRatio: 0.70, reachRatio: 0.30, reason: 'Insufficient data - using default 70/30' };
    }

    // Calculate dynamic ratio based on performance
    const totalScore = followerScore + reachScore;
    if (totalScore === 0) {
        return { followerRatio: 0.70, reachRatio: 0.30, reason: 'No performance data - using default' };
    }

    // Normalize ratios (ensure minimum 20% for each to maintain exploration)
    let followerRatio = Math.max(0.20, Math.min(0.80, followerScore / totalScore));
    let reachRatio = 1 - followerRatio;

    return {
        followerRatio,
        reachRatio,
        reason: `Dynamic Nash: ${Math.round(followerRatio * 100)}% follower / ${Math.round(reachRatio * 100)}% reach (based on ${followerAttempts + reachAttempts} samples)`
    };
};

/**
 * MAIN: Generate smart Instagram topic using DYNAMIC Nash Equilibrium
 * NOW POWERED BY:
 * 1. PERFORMANCE WEIGHTS - Weighted selection based on historical success
 * 2. EXPLORATION CONFIG - Explore/exploit balance
 * 3. DYNAMIC NASH EQUILIBRIUM - Ratio LEARNS from actual engagement data
 */
export const generateSmartInstagramTopic = async (userId, niche = 'general', useAI = true) => {
    console.log('📸 Generating smart Instagram topic (DYNAMIC NASH EQUILIBRIUM)...');
    console.log(`   User: ${userId}`);

    // CHECK EXPLORATION CONFIG FIRST
    const explorationDecision = await explorationConfig.shouldExplore(userId, 'instagram');
    const stupidHustleDecision = await explorationConfig.shouldBeStupidHustle(userId, 'instagram');

    console.log(`   🎲 Exploration decision: ${explorationDecision.isExploration ? 'EXPLORE' : 'EXPLOIT'} (${explorationDecision.reason})`);

    // If exploration mode selected stupid_hustle, override niche
    if (stupidHustleDecision.isStupidHustle) {
        niche = 'stupid_hustle';
        console.log(`   🎭 Stupid Hustle mode activated! (${stupidHustleDecision.escalationLevel} chaos)`);
    } else if (explorationDecision.isExploration && explorationDecision.type !== 'exploit') {
        console.log(`   🔬 Exploration type: ${explorationDecision.type}`);
    }

    const recentTopics = await getRecentTopics(userId, 20);

    // Get content recommendation from Instagram analytics
    let recommendation = null;
    try {
        recommendation = await instagramAnalytics.getContentRecommendation(userId);
    } catch (err) {
        console.log('   ⚠️ Could not get IG recommendation:', err.message);
    }

    // Calculate DYNAMIC Nash Equilibrium ratio (not hardcoded 70/30!)
    const nashRatio = await calculateDynamicNashRatio(userId);
    console.log(`   🎯 ${nashRatio.reason}`);

    // Determine content type based on dynamic ratio
    let contentType = 'follower'; // default
    if (recommendation?.shouldFocusOn) {
        contentType = recommendation.shouldFocusOn;
    } else {
        // Use DYNAMIC ratio instead of hardcoded
        contentType = Math.random() < nashRatio.followerRatio ? 'follower' : 'reach';
    }

    // Check for niche override (stupid_hustle always uses reach/engagement type)
    const isStupidHustle = ['stupid_hustle', 'stupid-hustle', 'hustle'].includes(niche);
    if (isStupidHustle) {
        contentType = 'reach';
    }

    console.log(`   📊 Content type: ${contentType} (${contentType === 'follower' ? 'retention focus' : 'growth focus'})`);
    console.log(`   📝 Recent topics to avoid: ${recentTopics.length}`);

    let topic = null;
    let templateResult = null;
    let source = 'unknown';
    let hookType = isStupidHustle ? 'stupid-hustle' : null;
    let attempts = 0;
    const maxAttempts = 5;

    // Try AI first if enabled
    while (!topic && attempts < maxAttempts) {
        attempts++;

        if (useAI && attempts <= 2) {
            topic = await generateFromAI(userId, niche, recentTopics, contentType, recommendation);
            source = 'ai-dynamic-nash';
        }

        // Fallback to template (with weighted selection)
        if (!topic) {
            templateResult = await generateFromTemplate(userId, hookType, contentType);
            topic = templateResult.topic;
            hookType = templateResult.hookName;
            source = 'template-weighted-nash';
        }

        // Check for duplicates
        if (topic && recentTopics.some(t => t.toLowerCase().includes(topic.toLowerCase().substring(0, 20)))) {
            console.log(`   🔄 Duplicate detected, regenerating...`);
            topic = null;
            templateResult = null;
        }
    }

    if (!topic) {
        templateResult = await generateFromTemplate(userId, hookType, contentType);
        topic = templateResult.topic;
        hookType = templateResult.hookName;
        source = 'fallback-weighted';
    }

    console.log(`   ✅ Generated: "${topic}" (source: ${source})`);

    // Record the topic with full tracking metadata
    await dataService.topics.saveTopic(userId, 'instagram', {
        topic,
        niche,
        hook: hookType || contentType,
        source,
        metadata: {
            contentType,
            templateId: templateResult?.templateId || null,
            usedVariables: templateResult?.usedVariables || {},
            nashRatio: nashRatio,
            generatedAt: new Date().toISOString()
        }
    });

    return {
        topic,
        niche,
        platform: 'instagram',
        source,
        patterns: {
            hook: hookType || contentType,
            emotion: isStupidHustle ? 'outrage' : (contentType === 'follower' ? 'value' : 'engagement'),
            contentType
        },
        templateInfo: templateResult ? {
            templateId: templateResult.templateId,
            usedVariables: templateResult.usedVariables
        } : null,
        analytics: {
            equilibriumRatio: `${Math.round(nashRatio.followerRatio * 100)}/${Math.round(nashRatio.reachRatio * 100)}`,
            focusType: contentType,
            reason: nashRatio.reason,
            strategy: 'dynamic-nash-equilibrium'
        }
    };
};

/**
 * Get best patterns analysis
 */
export const getBestPatterns = async (userId) => {
    const patterns = await instagramAnalytics.loadWinningPatterns(userId);
    return {
        topHooks: Object.entries(patterns.patterns?.hooks || {})
            .sort((a, b) => (b[1].avgViews || 0) - (a[1].avgViews || 0))
            .slice(0, 5),
        equilibrium: patterns.equilibrium,
        winnerCount: patterns.winners?.length || 0
    };
};

export default {
    generateSmartInstagramTopic,
    getRecentTopics,
    getBestPatterns,
    IG_HOOK_PATTERNS,
    IG_TOPIC_VARIABLES
};
