import { generateText } from "../llm.js";
import facebookAnalytics from './facebook_analytics.js';
import performanceWeights from './performance_weights.js';
import explorationConfig from './exploration_config.js';
import dataService from '../../services/dataService.js';

/**
 * SMART FACEBOOK TOPIC GENERATOR
 *
 * Uses "Repeated Game" (Tit-for-Tat) Strategy:
 * - Facebook rewards CONSISTENCY over virality
 * - Shares are gold (people share content they trust)
 * - Comments drive algorithm boost
 * - Build trust through reliable, quality posting
 */

// ============================================================
// FACEBOOK-SPECIFIC HOOK PATTERNS
// ============================================================

const FB_HOOK_PATTERNS = {
    'shareable-wisdom': {
        keywords: ['tag someone', 'share this', 'your friends need', 'everyone needs'],
        emotionalAppeal: 'connection',
        description: 'Content people want to share with friends/family',
        templates: [
            'Tag someone who needs to hear this about {topic}',
            'Share this with someone struggling with {challenge}',
            '{number} truths about {topic} everyone needs to know'
        ]
    },
    'debate-starter': {
        keywords: ['am i wrong', 'unpopular opinion', 'controversial', 'debate', 'disagree'],
        emotionalAppeal: 'controversy',
        description: 'Content that sparks discussion and comments',
        templates: [
            'Unpopular opinion: {controversial_take} - am I wrong?',
            'This {topic} take might be controversial, but...',
            'Tell me why I\'m wrong about {topic}'
        ]
    },
    'relatable-struggle': {
        keywords: ['anyone else', 'just me', 'we all', 'that moment when', 'pov'],
        emotionalAppeal: 'belonging',
        description: 'Content that makes people feel understood',
        templates: [
            'POV: You\'re the only one who {relatable_action}',
            'That moment when {relatable_situation} hits different',
            'Anyone else {relatable_struggle} or just me?'
        ]
    },
    'nostalgic-throwback': {
        keywords: ['remember when', 'back in', 'growing up', 'used to', 'before'],
        emotionalAppeal: 'nostalgia',
        description: 'Content that triggers happy memories',
        templates: [
            'Remember when {nostalgic_thing} was {description}?',
            'If you remember {nostalgic_item}, you had a great childhood',
            'Things from the {decade}s that kids today will never understand'
        ]
    },
    'question-hook': {
        keywords: ['what would you', 'which one', 'would you rather', 'have you ever'],
        emotionalAppeal: 'engagement',
        description: 'Direct questions that demand answers',
        templates: [
            'What would you do if {scenario}?',
            'Would you rather {option_a} or {option_b}?',
            'Be honest: have you ever {common_action}?'
        ]
    }
};

// Facebook-optimized topic variables
const FB_TOPIC_VARIABLES = {
    topic: ['money habits', 'relationships', 'career choices', 'parenting', 'friendship', 'dating', 'work-life balance'],
    challenge: ['motivation', 'saving money', 'time management', 'confidence', 'boundaries', 'communication'],
    number: ['3', '5', '7', '4', '6'],
    controversial_take: [
        'most side hustles are a waste of time',
        'working hard won\'t make you rich',
        'nice people finish last in business',
        'morning routines are overrated',
        'college isn\'t worth it anymore'
    ],
    relatable_action: ['rehearses conversations in your head', 'googles symptoms instead of seeing a doctor', 'has 50 browser tabs open'],
    relatable_situation: ['your alarm goes off on Monday', 'you can\'t find your keys before leaving', 'someone says "we need to talk"'],
    relatable_struggle: ['overthinks everything', 'says "I\'m fine" when you\'re not', 'avoids phone calls'],
    nostalgic_thing: ['Saturday morning cartoons', 'renting movies from Blockbuster', 'using a landline phone'],
    nostalgic_item: ['this candy', 'these toys', 'this TV show'],
    description: ['the best part of the week', 'so exciting', 'a big deal'],
    decade: ['90', '80', '2000'],
    scenario: ['your boss offered a 50% raise but weekends required', 'you found $10,000 cash on the street'],
    option_a: ['be famous but broke', 'work dream job for minimum wage'],
    option_b: ['be rich but unknown', 'boring job with great pay'],
    common_action: ['pretended not to see someone in public', 'said "on my way" before leaving']
};

// ============================================================
// TOPIC TRACKING
// ============================================================

export const recordFacebookTopic = async (userId, topic, patterns = {}, videoId = null) => {
    const topicData = {
        topic,
        niche: patterns.niche || 'general',
        hook: patterns.hook,
        source: patterns.source || 'smart_facebook_generator',
        metadata: {
            fingerprint: createFingerprint(topic),
            patterns,
            videoId,
            timestamp: new Date().toISOString()
        }
    };

    try {
        await dataService.topics.saveTopic(userId, 'facebook', topicData);
        console.log(`   📝 [FB] Recorded: "${topic.substring(0, 50)}..."`);
    } catch (err) {
        console.error('   ⚠️ [FB] Failed to record topic:', err.message);
    }

    return topicData;
};

const createFingerprint = (topic) => {
    return topic.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .sort()
        .join('_');
};

export const isFacebookTopicDuplicate = async (userId, newTopic, threshold = 0.5) => {
    try {
        const topics = await dataService.topics.getTopics(userId, 'facebook', { limit: 100 });
        const newFingerprint = createFingerprint(newTopic);
        const newWords = new Set(newFingerprint.split('_'));

        for (const existing of topics) {
            const existingFingerprint = existing.metadata?.fingerprint || createFingerprint(existing.topic);
            const existingWords = new Set(existingFingerprint.split('_'));
            const intersection = [...newWords].filter(w => existingWords.has(w)).length;
            const union = new Set([...newWords, ...existingWords]).size;
            const similarity = union > 0 ? intersection / union : 0;

            if (similarity >= threshold) {
                return { isDuplicate: true, similarTo: existing.topic, similarity: Math.round(similarity * 100) };
            }
        }
    } catch (err) {
        console.error('   ⚠️ [FB] Duplicate check failed:', err.message);
    }
    return { isDuplicate: false };
};

export const getRecentFacebookTopics = async (userId, count = 20) => {
    try {
        const topics = await dataService.topics.getTopics(userId, 'facebook', { limit: count });
        return topics.map(t => t.topic);
    } catch (err) {
        console.error('Failed to load recent Facebook topics:', err.message);
        return [];
    }
};

// ============================================================
// PATTERN EXTRACTION
// ============================================================

export const getFacebookBestPatterns = async (userId) => {
    const patterns = await facebookAnalytics.loadWinningPatterns(userId);

    if (!patterns.winners || patterns.winners.length === 0) {
        return getDefaultFacebookPatterns();
    }

    const hookRanking = Object.entries(patterns.patterns.hooks || {})
        .map(([name, data]) => ({ name, avgScore: data.avgScore || 0, total: data.count || 0 }))
        .filter(h => h.total >= 1)
        .sort((a, b) => b.avgScore - a.avgScore);

    return {
        hooks: hookRanking.length > 0 ? hookRanking : getDefaultFacebookPatterns().hooks,
        trustScore: patterns.trustScore || 0,
        totalPosts: patterns.consistency?.totalPosts || 0,
        topWinners: patterns.winners.slice(0, 3),
        avoid: []
    };
};

const getDefaultFacebookPatterns = () => ({
    hooks: [
        { name: 'shareable-wisdom', avgScore: 1.5, total: 1 },
        { name: 'debate-starter', avgScore: 1.3, total: 1 },
        { name: 'relatable-struggle', avgScore: 1.2, total: 1 },
        { name: 'question-hook', avgScore: 1.0, total: 1 }
    ],
    trustScore: 0,
    totalPosts: 0,
    topWinners: [],
    avoid: []
});

// ============================================================
// TOPIC GENERATION
// ============================================================

/**
 * Fill a template with WEIGHTED random variables
 * Uses performance_weights.js instead of pure Math.random()
 */
const fillTemplate = async (userId, template) => {
    let result = template;
    const usedVariables = {};

    for (const [key, values] of Object.entries(FB_TOPIC_VARIABLES)) {
        const regex = new RegExp(`{${key}}`, 'g');
        if (result.includes(`{${key}}`)) {
            // Use weighted selection instead of pure random
            const value = await performanceWeights.selectWeightedVariable(userId, key, values, 'facebook');
            result = result.replace(regex, value);
            usedVariables[key] = value;
        }
    }

    return { topic: result, usedVariables };
};

/**
 * Generate topic using templates with WEIGHTED selection
 */
const generateFromTemplate = async (userId, hookName) => {
    const hook = FB_HOOK_PATTERNS[hookName] || FB_HOOK_PATTERNS['shareable-wisdom'];
    const templateIndex = Math.floor(Math.random() * hook.templates.length);
    const template = hook.templates[templateIndex];
    const templateId = `fb_${hookName}_template_${templateIndex}`;

    const result = await fillTemplate(userId, template);

    return {
        topic: result.topic,
        templateId,
        hookName,
        usedVariables: result.usedVariables
    };
};

const generateFromAI = async (userId, bestPatterns, recentTopics, niche) => {
    if (!process.env.ANTHROPIC_API_KEY) return null;

    const topHook = bestPatterns.hooks[0];
    const hookDef = FB_HOOK_PATTERNS[topHook?.name] || FB_HOOK_PATTERNS['shareable-wisdom'];

    const prompt = `You are a Facebook Reels strategist optimizing for SHARES and COMMENTS.

FACEBOOK ALGORITHM PRIORITIES:
- Shares = Content endorsement = Massive reach
- Comments = Active engagement = Algorithm boost
- Questions drive 3x more comments
- Relatable content gets shared

WINNING PATTERN:
- Hook: "${topHook?.name || 'shareable-wisdom'}"
- Description: ${hookDef.description}
- Emotional Appeal: ${hookDef.emotionalAppeal}
- Trust Score: ${bestPatterns.trustScore}/100

NICHE: ${niche}

TOP PERFORMERS:
${bestPatterns.topWinners?.map(w => `- ${w.title} (Score: ${w.score})`).join('\n') || '- Building history...'}

AVOID (already created):
${recentTopics.slice(-15).map(t => `- ${t}`).join('\n')}

Create ONE unique Facebook Reel topic that:
1. Uses the winning hook style
2. Is SHAREABLE
3. Invites COMMENTS
4. Is NOT similar to existing topics

Return ONLY the topic. No explanation.`;

    try {
        const responseText = await generateText(prompt);
        let topic = responseText.trim();
        topic = topic.replace(/^["'\-\s]+|["'\-\s]+$/g, '').split('\n')[0];
        return topic;
    } catch (error) {
        console.error('   [FB] AI failed:', error.message);
        return null;
    }
};

/**
 * Calculate TIT-FOR-TAT trust score
 * Facebook rewards CONSISTENCY - if you've been reliable, you can experiment more
 * If you've had flops, stick to proven patterns
 */
const calculateTitForTatScore = async (userId) => {
    const weights = await performanceWeights.loadWeights(userId);
    const fbData = weights.platforms?.facebook || {};

    // Calculate posting frequency (consistency)
    const hooks = Object.values(fbData.hooks || {});
    const totalAttempts = hooks.reduce((sum, h) => sum + (h.attempts || 0), 0);
    const totalWins = hooks.reduce((sum, h) => sum + (h.wins || 0), 0);
    const totalViralHits = hooks.reduce((sum, h) => sum + (h.viralHits || 0), 0);

    // Calculate win rate
    const winRate = totalAttempts > 0 ? totalWins / totalAttempts : 0;

    // Trust score calculation (0-100)
    // - Base: posting frequency contribution (up to 40 points)
    // - Win rate contribution (up to 40 points)
    // - Viral bonus (up to 20 points)
    const frequencyScore = Math.min(40, totalAttempts * 4); // 10+ posts = max
    const winRateScore = winRate * 40;
    const viralBonus = Math.min(20, totalViralHits * 5);

    const trustScore = Math.round(frequencyScore + winRateScore + viralBonus);

    // Tit-for-Tat strategy recommendation
    let strategy = 'conservative';
    let experimentRate = 0.2; // Default: 20% experiments
    let reason = 'Building trust - stick to proven patterns';

    if (trustScore >= 70) {
        strategy = 'aggressive';
        experimentRate = 0.4; // 40% experiments - you've earned trust!
        reason = 'High trust! Algorithm is boosting - experiment boldly';
    } else if (trustScore >= 40) {
        strategy = 'balanced';
        experimentRate = 0.3; // 30% experiments
        reason = 'Good progress! Mix proven patterns with experiments';
    } else if (totalAttempts < 5) {
        strategy = 'exploration';
        experimentRate = 0.5; // 50% experiments - need data!
        reason = 'Insufficient data - exploring to find what works';
    }

    return {
        trustScore,
        strategy,
        experimentRate,
        reason,
        stats: { totalAttempts, totalWins, winRate: Math.round(winRate * 100), totalViralHits }
    };
};

/**
 * Select hook using Tit-for-Tat strategy
 * High trust = more experimentation
 * Low trust = stick to proven winners
 */
const selectHookByTitForTat = async (userId, titForTat, bestPatterns) => {
    const killedHooks = await performanceWeights.getKilledPatterns(userId);
    const fbKilledHooks = killedHooks.facebook || [];
    const aliveHooks = Object.keys(FB_HOOK_PATTERNS).filter(h => !fbKilledHooks.includes(h));

    if (aliveHooks.length === 0) {
        return 'shareable-wisdom';
    }

    // Decide: experiment or exploit?
    const shouldExperiment = Math.random() < titForTat.experimentRate;

    if (shouldExperiment) {
        // Pick random hook for exploration
        const randomHook = aliveHooks[Math.floor(Math.random() * aliveHooks.length)];
        console.log(`   🔬 [FB] Tit-for-Tat EXPERIMENT: ${randomHook}`);
        return randomHook;
    } else {
        // Use weighted selection based on past performance
        const weightedHook = await performanceWeights.weightedSelect(userId, aliveHooks, 'facebook', 'hooks');
        if (weightedHook) {
            console.log(`   📊 [FB] Tit-for-Tat EXPLOIT: ${weightedHook} (weighted by performance)`);
            return weightedHook;
        }

        // Fallback to best pattern from analytics
        return bestPatterns.hooks[0]?.name || 'shareable-wisdom';
    }
};

/**
 * MAIN: Generate smart Facebook topic using TRUE Tit-for-Tat strategy
 * NOW POWERED BY:
 * 1. PERFORMANCE WEIGHTS - Weighted selection based on historical success
 * 2. TIT-FOR-TAT - Trust-based experimentation (cooperate if Facebook cooperates)
 * 3. SHARES WEIGHTED 5X - Facebook's key metric
 */
export const generateSmartFacebookTopic = async (userId, niche = 'general', useAI = true) => {
    console.log('📘 Generating smart FACEBOOK topic (TIT-FOR-TAT STRATEGY)...');
    console.log(`   User: ${userId}`);

    // CHECK EXPLORATION CONFIG FIRST
    const explorationDecision = await explorationConfig.shouldExplore(userId, 'facebook');
    const stupidHustleDecision = await explorationConfig.shouldBeStupidHustle(userId, 'facebook');

    if (stupidHustleDecision.isStupidHustle) {
        niche = 'stupid_hustle';
        console.log(`   🎭 Stupid Hustle mode activated!`);
    }

    // Calculate Tit-for-Tat trust score
    const titForTat = await calculateTitForTatScore(userId);
    console.log(`   🤝 [FB] Trust Score: ${titForTat.trustScore}/100 - ${titForTat.reason}`);
    console.log(`   📊 [FB] Strategy: ${titForTat.strategy} (${Math.round(titForTat.experimentRate * 100)}% experimentation)`);

    const bestPatterns = await getFacebookBestPatterns(userId);
    const recentTopics = await getRecentFacebookTopics(userId, 20);

    // Select hook using Tit-for-Tat strategy
    const topHook = await selectHookByTitForTat(userId, titForTat, bestPatterns);

    let topic = null;
    let templateResult = null;
    let source = 'unknown';
    let attempts = 0;

    while (!topic && attempts < 5) {
        attempts++;

        if (useAI && attempts <= 2) {
            topic = await generateFromAI(userId, bestPatterns, recentTopics, niche);
            source = 'ai-tit-for-tat';
        }

        if (!topic) {
            templateResult = await generateFromTemplate(userId, topHook);
            topic = templateResult.topic;
            source = 'template-weighted-tft';
        }

        if (topic) {
            const topicStr = typeof topic === 'string' ? topic : topic.toString();
            const dupCheck = await isFacebookTopicDuplicate(userId, topicStr);
            if (dupCheck.isDuplicate) {
                console.log(`   🔄 [FB] Attempt ${attempts}: duplicate detected`);
                topic = null;
                templateResult = null;
            }
        }
    }

    if (!topic) {
        const fallbackResult = await fillTemplate(userId, '{number} truths about {topic} everyone needs to know');
        topic = `${fallbackResult.topic} (${Date.now() % 10000})`;
        source = 'fallback';
    }

    const topicStr = typeof topic === 'string' ? topic : topic.toString();

    // Record with full tracking metadata
    await recordFacebookTopic(userId, topicStr, {
        hook: topHook,
        source,
        templateId: templateResult?.templateId || null,
        usedVariables: templateResult?.usedVariables || {},
        titForTat: titForTat
    });
    console.log(`   ✅ [FB] Generated (${source}): "${topicStr}"`);

    return {
        topic: topicStr,
        niche,
        platform: 'facebook',
        patterns: {
            hook: topHook,
            hookData: FB_HOOK_PATTERNS[topHook],
            trustScore: titForTat.trustScore
        },
        templateInfo: templateResult ? {
            templateId: templateResult.templateId,
            usedVariables: templateResult.usedVariables
        } : null,
        source,
        analytics: {
            topHook: bestPatterns.hooks[0],
            trustScore: titForTat.trustScore,
            totalPosts: titForTat.stats.totalAttempts,
            strategy: 'true-tit-for-tat',
            titForTat: titForTat
        }
    };
};

export const getFacebookTopicRecommendation = async (userId, niche = 'general') => {
    const result = await generateSmartFacebookTopic(userId, niche, true);
    const fewShotPrompt = await facebookAnalytics.generateFewShotPrompt(userId);

    return {
        recommendedTopic: result.topic,
        platform: 'facebook',
        niche: result.niche,
        whyThisWorks: `Uses "${result.patterns.hook}" hook for shares/comments. Trust: ${result.patterns.trustScore}/100`,
        patterns: result.patterns,
        facebookStrategy: {
            trustScore: result.analytics.trustScore,
            recommendation: result.analytics.trustScore < 30
                ? 'Focus on consistent daily posting to build trust'
                : result.analytics.trustScore < 60
                    ? 'Good progress! Mix proven patterns with experiments'
                    : 'High trust! Algorithm is boosting - experiment boldly'
        },
        fewShotPrompt
    };
};

export default {
    recordFacebookTopic,
    isFacebookTopicDuplicate,
    getRecentFacebookTopics,
    getFacebookBestPatterns,
    generateSmartFacebookTopic,
    getFacebookTopicRecommendation,
    FB_HOOK_PATTERNS
};
