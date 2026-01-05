import { GoogleGenerativeAI } from '@google/generative-ai';
import viralIntelligence from './viral_intelligence.js';
import explorationConfig from './exploration_config.js';
import dataService from '../../services/dataService.js';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * VARIATION ENGINE
 *
 * Takes winning videos and generates 10 variations with different:
 * - Angles (same story, different perspective)
 * - Tones (controversial, empathetic, shocking, humorous)
 * - Hooks (question, statement, shock, curiosity)
 * - Emotional triggers
 */

// ============================================================
// TONE SPECTRUM - From safe to controversial
// ============================================================

const TONE_SPECTRUM = {
    // Safe tones (explore 30%)
    safe: {
        tones: ['educational', 'helpful', 'inspiring', 'relatable'],
        risk: 'low',
        description: 'Mass appeal, safe for all audiences'
    },
    // Edgy tones (explore 40%)
    edgy: {
        tones: ['provocative', 'controversial', 'rebellious', 'exposing'],
        risk: 'medium',
        description: 'Polarizing content that drives engagement through debate'
    },
    // Controversial tones (explore 30%)
    controversial: {
        tones: ['outrage-bait', 'calling-out', 'unpopular-opinion', 'taboo'],
        risk: 'high',
        description: 'High risk/reward content that sparks strong reactions'
    }
};

const HOOK_VARIATIONS = {
    question: {
        templates: [
            'Why does {topic}?',
            'What if {topic}?',
            'Did you know {topic}?',
            'Ever wonder why {topic}?'
        ],
        emotion: 'curiosity'
    },
    shock: {
        templates: [
            '{topic} and nobody talks about it',
            'The truth about {topic} will shock you',
            '{topic} - this changes everything',
            'I can\'t believe {topic}'
        ],
        emotion: 'shock'
    },
    controversy: {
        templates: [
            'Unpopular opinion: {topic}',
            '{topic} and I don\'t care who disagrees',
            'Hot take: {topic}',
            'Nobody wants to admit {topic}'
        ],
        emotion: 'outrage'
    },
    callout: {
        templates: [
            'Stop doing {topic}',
            'If you {topic}, you\'re part of the problem',
            '{topic} is a scam and here\'s why',
            'The {topic} lie everyone believes'
        ],
        emotion: 'confrontation'
    },
    story: {
        templates: [
            'I {topic} and this happened...',
            'My {topic} story (you won\'t believe it)',
            'How {topic} changed my life',
            'The day {topic} happened'
        ],
        emotion: 'curiosity'
    },
    insider: {
        templates: [
            'As a {role}, let me tell you about {topic}',
            '{role} here - the truth about {topic}',
            'What {role}s won\'t tell you about {topic}',
            'Former {role} exposes {topic}'
        ],
        emotion: 'trust'
    }
};

const ANGLE_PERSPECTIVES = [
    'victim', 'perpetrator', 'witness', 'expert', 'insider',
    'skeptic', 'believer', 'rebel', 'conformist', 'outsider'
];

// ============================================================
// CORE VARIATION GENERATION
// ============================================================

/**
 * Generate 10 variations from a winning video
 */
export const generateVariationsFromWinner = async (winnerVideo, viralData = null) => {
    console.log(`🔄 Generating 10 variations from winner: "${winnerVideo.title}"`);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Build context from viral data
    const topVideos = viralData?.topVideos?.slice(0, 5) || [];
    const topTitlesContext = topVideos
        .map(v => `"${v.title}" (${v.stats?.views} views)`)
        .join('\n');

    const prompt = `You are a viral content strategist. Your job is to create 10 DIFFERENT variations of a winning video topic.

WINNING VIDEO TO CLONE:
Title: "${winnerVideo.title}"
Views: ${winnerVideo.stats?.views || 0}
Viral Score: ${winnerVideo.viral?.viralScore || 0}
Hook Type: ${winnerVideo.pattern?.hookType || 'unknown'}
Emotion: ${winnerVideo.pattern?.emotion || 'unknown'}

OTHER TOP PERFORMERS (for pattern reference):
${topTitlesContext || 'N/A'}

GENERATE 10 VARIATIONS using this distribution:
- 3 variations: SAFE tone (educational, helpful, mass appeal)
- 4 variations: EDGY tone (provocative, controversial, polarizing)
- 3 variations: CONTROVERSIAL tone (outrage-bait, taboo, unpopular opinions)

EACH VARIATION MUST:
1. Be a DIFFERENT angle/perspective on the same core topic
2. Use a DIFFERENT hook style (question, shock, callout, story, insider)
3. Target a DIFFERENT emotion (curiosity, outrage, shock, fear, hope, anger)
4. Be under 60 characters
5. Be something people would ACTUALLY click on
6. Include appropriate emoji and punctuation

VARIATION FORMAT (respond with JSON array):
[
  {
    "title": "The title here",
    "tone": "safe|edgy|controversial",
    "hookType": "question|shock|controversy|callout|story|insider",
    "emotion": "curiosity|outrage|shock|fear|hope|anger",
    "angle": "what makes this variation different",
    "riskLevel": 1-10
  }
]

Return ONLY the JSON array. No explanation.`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse JSON
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const variations = JSON.parse(jsonMatch[0]);

            // Add metadata
            return variations.map((v, i) => ({
                ...v,
                id: `var_${Date.now()}_${i}`,
                sourceVideoId: winnerVideo.videoId,
                sourceTitle: winnerVideo.title,
                sourceViews: winnerVideo.stats?.views || 0,
                generatedAt: new Date().toISOString(),
                status: 'pending', // pending, scheduled, generated, posted
                scheduledFor: null,
                videoPath: null,
                performance: null
            }));
        }

        throw new Error('Failed to parse variations JSON');
    } catch (err) {
        console.error('   ❌ Variation generation failed:', err.message);
        return [];
    }
};

/**
 * Generate variations for exploration (new topics)
 */
export const generateExplorationVariations = async (niche, viralData = null) => {
    console.log(`🔍 Generating exploration variations for niche: ${niche}`);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Get what's been done before
    const existingTopics = viralData?.topVideos?.map(v => v.title) || [];

    const prompt = `You are a viral content strategist. Generate 5 EXPLORATION topics - completely NEW angles that haven't been tried yet.

NICHE: ${niche}

TOPICS ALREADY COVERED (DO NOT REPEAT):
${existingTopics.slice(0, 10).map(t => `- ${t}`).join('\n') || 'None yet'}

GENERATE 5 NEW EXPLORATION TOPICS:
- 2 topics: CONTROVERSIAL (taboo subjects, unpopular opinions, call-outs)
- 2 topics: EDGY (provocative, polarizing, debate-starting)
- 1 topic: EXPERIMENTAL (completely new format or angle)

RULES:
1. Must be DIFFERENT from existing topics
2. Must be relevant to ${niche} niche
3. Should trigger strong emotions (outrage, curiosity, shock)
4. Under 60 characters
5. Include emoji and punctuation for virality

Return JSON array:
[
  {
    "title": "The title",
    "tone": "controversial|edgy|experimental",
    "emotion": "outrage|curiosity|shock|anger|fear",
    "whyControversial": "what makes this polarizing",
    "riskLevel": 1-10
  }
]

Return ONLY JSON. No explanation.`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const explorations = JSON.parse(jsonMatch[0]);

            return explorations.map((e, i) => ({
                ...e,
                id: `exp_${Date.now()}_${i}`,
                type: 'exploration',
                niche,
                generatedAt: new Date().toISOString(),
                status: 'pending'
            }));
        }

        throw new Error('Failed to parse exploration JSON');
    } catch (err) {
        console.error('   ❌ Exploration generation failed:', err.message);
        return [];
    }
};

// ============================================================
// QUEUE MANAGEMENT
// ============================================================

/**
 * Load variation queue for user
 */
export const loadVariationQueue = async (userId) => {
    try {
        const queue = await dataService.variationEngine.getVariationQueue(userId);
        if (queue) return queue;
    } catch (err) {
        console.error('Failed to load variation queue:', err.message);
    }
    return {
        variations: [],
        explorations: [],
        lastGenerated: null,
        stats: {
            totalGenerated: 0,
            totalPosted: 0,
            totalViews: 0
        }
    };
};

/**
 * Save variation queue for user
 */
const saveVariationQueue = async (userId, queue) => {
    queue.lastUpdated = new Date().toISOString();
    try {
        await dataService.variationEngine.saveVariationQueue(userId, queue);
    } catch (err) {
        console.error('Failed to save variation queue:', err.message);
    }
};

/**
 * Add variations to queue
 */
export const addVariationsToQueue = async (userId, variations) => {
    const queue = await loadVariationQueue(userId);
    queue.variations.push(...variations);
    queue.stats.totalGenerated += variations.length;
    queue.lastGenerated = new Date().toISOString();
    await saveVariationQueue(userId, queue);
    return queue;
};

/**
 * Get next pending variation
 * NOW USES EXPLORATION CONFIG FOR TONE DISTRIBUTION
 */
export const getNextPendingVariation = async (userId) => {
    const queue = await loadVariationQueue(userId);

    // Get tone distribution from exploration config
    const toneDistribution = await explorationConfig.getToneDistribution(userId);
    console.log(`   📊 Using tone distribution: safe=${toneDistribution.safe * 100}%, edgy=${toneDistribution.edgy * 100}%, controversial=${toneDistribution.controversial * 100}%`);

    const pending = queue.variations.filter(v => v.status === 'pending');

    if (pending.length === 0) return null;

    const edgy = pending.filter(v => v.tone === 'edgy');
    const controversial = pending.filter(v => v.tone === 'controversial');
    const safe = pending.filter(v => v.tone === 'safe');

    const rand = Math.random();
    let selected;

    // Use config-based distribution
    if (rand < toneDistribution.edgy && edgy.length > 0) {
        selected = edgy[Math.floor(Math.random() * edgy.length)];
    } else if (rand < (toneDistribution.edgy + toneDistribution.controversial) && controversial.length > 0) {
        selected = controversial[Math.floor(Math.random() * controversial.length)];
    } else if (safe.length > 0) {
        selected = safe[Math.floor(Math.random() * safe.length)];
    } else {
        selected = pending[0];
    }

    return selected;
};

/**
 * Mark variation as scheduled/generated/posted
 */
export const updateVariationStatus = async (userId, variationId, status, data = {}) => {
    const queue = await loadVariationQueue(userId);
    const variation = queue.variations.find(v => v.id === variationId);

    if (variation) {
        variation.status = status;
        Object.assign(variation, data);

        if (status === 'posted') {
            queue.stats.totalPosted++;
        }
    }

    await saveVariationQueue(userId, queue);
    return variation;
};

// ============================================================
// SCHEDULING
// ============================================================

/**
 * Load posting schedule for user
 */
export const loadSchedule = async (userId) => {
    try {
        const schedule = await dataService.variationEngine.getPostingSchedule(userId);
        if (schedule) return schedule;
    } catch (err) {
        console.error('Failed to load schedule:', err.message);
    }
    return {
        enabled: false,
        intervalHours: 3,
        lastPost: null,
        nextPost: null,
        postsToday: 0,
        maxPostsPerDay: 8,
        platforms: ['youtube'],
        niche: 'general'
    };
};

/**
 * Save posting schedule for user
 */
export const saveSchedule = async (userId, schedule) => {
    try {
        schedule.lastUpdated = new Date().toISOString();
        await dataService.variationEngine.savePostingSchedule(userId, schedule);
    } catch (err) {
        console.error('Failed to save schedule:', err.message);
    }
};

/**
 * Check if it's time to post
 */
export const shouldPostNow = async (userId) => {
    const schedule = await loadSchedule(userId);

    if (!schedule.enabled) return false;

    // Check daily limit
    const today = new Date().toDateString();
    const lastPostDate = schedule.lastPost ? new Date(schedule.lastPost).toDateString() : null;

    if (lastPostDate !== today) {
        // New day, reset counter
        schedule.postsToday = 0;
        await saveSchedule(userId, schedule);
    }

    if (schedule.postsToday >= schedule.maxPostsPerDay) {
        console.log('   📅 Daily post limit reached');
        return false;
    }

    // Check interval
    if (schedule.lastPost) {
        const hoursSinceLastPost = (Date.now() - new Date(schedule.lastPost).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastPost < schedule.intervalHours) {
            console.log(`   ⏰ Next post in ${(schedule.intervalHours - hoursSinceLastPost).toFixed(1)} hours`);
            return false;
        }
    }

    return true;
};

/**
 * Record a post
 */
export const recordPost = async (userId) => {
    const schedule = await loadSchedule(userId);
    schedule.lastPost = new Date().toISOString();
    schedule.postsToday++;
    schedule.nextPost = new Date(Date.now() + schedule.intervalHours * 60 * 60 * 1000).toISOString();
    await saveSchedule(userId, schedule);
};

// ============================================================
// MAIN BATCH GENERATION
// ============================================================

/**
 * Generate full batch from winners + exploration
 * NOW USES EXPLORATION CONFIG FOR BATCH SIZES
 */
export const generateBatch = async (userId, viralData, niche = 'general') => {
    console.log('🚀 BATCH GENERATION STARTING...');

    // Get variation settings from exploration config
    const variationSettings = await explorationConfig.getVariationSettings(userId);
    const variationsPerWinner = variationSettings.per_winner || 10;
    const explorationTopics = variationSettings.exploration_topics || 5;

    console.log(`   📊 Config: ${variationsPerWinner} variations per winner, ${explorationTopics} exploration topics`);
    console.log(`   📊 Ratio: ${variationSettings.exploit_explore_ratio.exploit * 100}% exploit, ${variationSettings.exploit_explore_ratio.explore * 100}% explore`);

    const results = {
        variations: [],
        explorations: [],
        totalGenerated: 0
    };

    // Get top winner
    const topWinner = viralData?.topVideos?.[0];

    if (topWinner) {
        console.log(`   🏆 Top winner: "${topWinner.title}" (${topWinner.stats?.views} views)`);

        // Generate variations from winner (using config count)
        const variations = await generateVariationsFromWinner(topWinner, viralData);
        results.variations = variations;
        results.totalGenerated += variations.length;

        console.log(`   ✅ Generated ${variations.length} variations`);

        // Add to queue
        await addVariationsToQueue(userId, variations);
    }

    // Generate exploration topics (using config count)
    const explorations = await generateExplorationVariations(niche, viralData);
    results.explorations = explorations;
    results.totalGenerated += explorations.length;

    console.log(`   🔍 Generated ${explorations.length} exploration topics`);

    // Add explorations to queue as variations
    await addVariationsToQueue(userId, explorations.map(e => ({
        ...e,
        tone: e.tone,
        hookType: 'exploration',
        sourceVideoId: null,
        sourceTitle: 'exploration'
    })));

    console.log(`   📊 Total batch: ${results.totalGenerated} topics ready`);

    return results;
};

export default {
    generateVariationsFromWinner,
    generateExplorationVariations,
    generateBatch,
    loadVariationQueue,
    addVariationsToQueue,
    getNextPendingVariation,
    updateVariationStatus,
    loadSchedule,
    saveSchedule,
    shouldPostNow,
    recordPost,
    TONE_SPECTRUM,
    HOOK_VARIATIONS
};
