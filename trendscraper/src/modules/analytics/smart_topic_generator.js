import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";

const GENERATED_TOPICS_PATH = '/app/data/generated_topics.json';
const ANALYTICS_PATH = '/app/data/analytics_history.json';

/**
 * SMART TOPIC GENERATOR
 *
 * Solves the problem of repeating the same topics by:
 * 1. Tracking all generated topics to avoid duplication
 * 2. Extracting DEEP PATTERNS from successful content
 * 3. Generating NEW topic ideas that follow winning patterns
 */

// ============================================================
// PATTERN DEFINITIONS - What makes content succeed
// ============================================================

const HOOK_PATTERNS = {
    'rule-breaking': {
        keywords: ['broke', 'rules', 'illegal', 'banned', 'forbidden', 'shouldn\'t', 'wasn\'t supposed'],
        emotionalAppeal: 'rebellion',
        description: 'Someone breaks a rule and faces unexpected consequences',
        templates: [
            '{person} broke {rule} for {time}, here\'s what happened',
            '{person} wasn\'t supposed to {action}, but {outcome}'
        ]
    },
    'secrets-exposed': {
        keywords: ['secret', 'hide', 'hidden', 'don\'t want you to know', 'they won\'t tell', 'never told'],
        emotionalAppeal: 'curiosity',
        description: 'Revealing hidden information insiders keep quiet',
        templates: [
            '{authority} reveals {number} {things} they\'re told to hide',
            '{institution} doesn\'t want you to know about {secret}'
        ]
    },
    'shocking-truth': {
        keywords: ['truth', 'real', 'actually', 'shocking', 'surprising', 'really'],
        emotionalAppeal: 'surprise',
        description: 'Revealing a truth that contradicts common belief',
        templates: [
            'The truth about {topic} is {unexpected}',
            'What {topic} actually means (not what you think)'
        ]
    },
    'manipulation-awareness': {
        keywords: ['trick', 'manipulate', 'gaslight', 'psychology', 'used against', 'tactics'],
        emotionalAppeal: 'self-protection',
        description: 'Exposing psychological tactics used to manipulate',
        templates: [
            '{number} {manipulation} tactics {manipulator} use on you',
            'How {manipulator} trick you into {action}'
        ]
    },
    'underdog-wins': {
        keywords: ['promoted', 'fired', 'got the job', 'succeeded', 'won', 'instead of'],
        emotionalAppeal: 'hope',
        description: 'Someone unlikely succeeds or gets justice',
        templates: [
            '{underdog} did {bad_action} and got {good_outcome} instead',
            'The {descriptor} {person} who {unexpected_success}'
        ]
    },
    'revenge-karma': {
        keywords: ['revenge', 'karma', 'got back', 'caught', 'exposed', 'backfired'],
        emotionalAppeal: 'justice',
        description: 'Wrongdoer faces consequences',
        templates: [
            '{wrongdoer} {bad_action}, gets {consequence}',
            '{victim} gets revenge on {wrongdoer} in the best way'
        ]
    }
};

const STORY_STRUCTURES = {
    'unexpected-outcome': {
        pattern: '[Person] did [Action that should fail] → [Positive outcome]',
        examples: ['Broke rules → Got promoted', 'Deleted database → Got hired']
    },
    'insider-revelation': {
        pattern: '[Authority] reveals [Hidden information] about [Topic]',
        examples: ['Ex-banker reveals secrets', 'HR manager exposes tricks']
    },
    'list-expose': {
        pattern: '[Number] [Things] that [Unexpected effect]',
        examples: ['5 habits that keep you broke', '3 tricks salespeople use']
    }
};

const TOPIC_VARIABLES = {
    person: ['employee', 'cashier', 'intern', 'manager', 'worker', 'new hire', 'customer'],
    authority: ['ex-banker', 'HR manager', 'former salesperson', 'retail worker', 'accountant', 'therapist'],
    institution: ['banks', 'corporations', 'retail stores', 'HR departments', 'insurance companies'],
    manipulator: ['salespeople', 'advertisers', 'employers', 'marketers', 'scammers'],
    wrongdoer: ['boss', 'CEO', 'manager', 'company', 'landlord', 'customer'],
    underdog: ['quiet employee', 'youngest intern', 'overlooked worker', 'new hire'],
    descriptor: ['quietest', 'laziest', 'youngest', 'most overlooked', 'least experienced'],
    rule: ['company policy', 'dress code', 'work hours', 'the rules', 'protocol'],
    time: ['6 months', '2 years', '3 weeks', '1 year', 'months'],
    number: ['3', '5', '7', '4', '6'],
    things: ['secrets', 'tricks', 'habits', 'mistakes', 'lies', 'tactics'],
    action: ['work from home', 'ignore meetings', 'break dress code', 'speak up', 'say no'],
    outcome: ['promoted', 'praised', 'rewarded', 'given a raise', 'made manager'],
    bad_action: ['secretly cut pay', 'lied to employees', 'stole credit', 'broke promises'],
    good_outcome: ['promotion', 'raise', 'success', 'recognition'],
    consequence: ['fired', 'exposed', 'caught', 'sued', 'karma'],
    topic: ['success', 'money', 'confidence', 'relationships', 'career'],
    secret: ['this loophole', 'these tricks', 'this strategy', 'the real way'],
    unexpected: ['not what you think', 'the opposite', 'completely different', 'shocking']
};

// ============================================================
// TOPIC TRACKING - Avoid Repetition
// ============================================================

/**
 * Load generated topics history
 */
export const loadGeneratedTopics = () => {
    if (fs.existsSync(GENERATED_TOPICS_PATH)) {
        return JSON.parse(fs.readFileSync(GENERATED_TOPICS_PATH, 'utf8'));
    }
    return {
        topics: [],
        lastGenerated: null
    };
};

/**
 * Save generated topics
 */
const saveGeneratedTopics = (data) => {
    data.lastGenerated = new Date().toISOString();
    const dir = path.dirname(GENERATED_TOPICS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(GENERATED_TOPICS_PATH, JSON.stringify(data, null, 2));
};

/**
 * Record a newly generated topic
 */
export const recordGeneratedTopic = (topic, patterns = {}, videoId = null) => {
    const data = loadGeneratedTopics();

    data.topics.push({
        topic: topic,
        fingerprint: createFingerprint(topic),
        patterns: patterns,
        videoId: videoId,
        generatedAt: new Date().toISOString()
    });

    // Keep only last 200 topics
    if (data.topics.length > 200) {
        data.topics = data.topics.slice(-200);
    }

    saveGeneratedTopics(data);
    console.log(`   📝 Recorded topic: "${topic.substring(0, 50)}..."`);
    return data;
};

/**
 * Create fingerprint for similarity checking
 */
const createFingerprint = (topic) => {
    return topic.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .sort()
        .join('_');
};

/**
 * Check if topic is too similar to existing ones
 */
export const isTopicDuplicate = (newTopic, threshold = 0.5) => {
    const data = loadGeneratedTopics();
    const newFingerprint = createFingerprint(newTopic);
    const newWords = new Set(newFingerprint.split('_'));

    for (const existing of data.topics) {
        const existingWords = new Set(existing.fingerprint.split('_'));

        // Jaccard similarity
        const intersection = [...newWords].filter(w => existingWords.has(w)).length;
        const union = new Set([...newWords, ...existingWords]).size;
        const similarity = union > 0 ? intersection / union : 0;

        if (similarity >= threshold) {
            return {
                isDuplicate: true,
                similarTo: existing.topic,
                similarity: Math.round(similarity * 100)
            };
        }
    }
    return { isDuplicate: false };
};

/**
 * Get list of recently generated topics (for AI prompt)
 */
export const getRecentTopics = (count = 20) => {
    const data = loadGeneratedTopics();
    return data.topics.slice(-count).map(t => t.topic);
};

// ============================================================
// DEEP PATTERN EXTRACTION
// ============================================================

/**
 * Extract patterns from video performance data
 */
export const extractPatternsFromVideos = (videos) => {
    const results = {
        hooks: {},
        structures: {},
        emotions: {},
        avoid: []
    };

    videos.forEach(video => {
        const views = video.stats?.views || 0;
        const likes = video.stats?.likes || 0;
        const title = video.title || '';
        const isWinner = views >= 200;
        const isFlop = views < 50 && (video.daysSincePublished || 0) > 3;

        // Detect hook patterns
        for (const [hookName, hookData] of Object.entries(HOOK_PATTERNS)) {
            const hasPattern = hookData.keywords.some(kw =>
                title.toLowerCase().includes(kw.toLowerCase())
            );

            if (hasPattern) {
                if (!results.hooks[hookName]) {
                    results.hooks[hookName] = { wins: 0, total: 0, totalViews: 0, examples: [] };
                }
                results.hooks[hookName].total++;
                results.hooks[hookName].totalViews += views;
                if (isWinner) {
                    results.hooks[hookName].wins++;
                    results.hooks[hookName].examples.push(title);
                }
            }
        }

        // Detect story structures
        if (/got promoted|instead of|but actually|turned out/i.test(title)) {
            if (!results.structures['unexpected-outcome']) {
                results.structures['unexpected-outcome'] = { wins: 0, total: 0, totalViews: 0 };
            }
            results.structures['unexpected-outcome'].total++;
            results.structures['unexpected-outcome'].totalViews += views;
            if (isWinner) results.structures['unexpected-outcome'].wins++;
        }

        if (/reveals?|exposes?|secrets?|hidden/i.test(title)) {
            if (!results.structures['insider-revelation']) {
                results.structures['insider-revelation'] = { wins: 0, total: 0, totalViews: 0 };
            }
            results.structures['insider-revelation'].total++;
            results.structures['insider-revelation'].totalViews += views;
            if (isWinner) results.structures['insider-revelation'].wins++;
        }

        if (/\d+\s+(things?|ways?|habits?|tricks?|secrets?|mistakes?)/i.test(title)) {
            if (!results.structures['list-expose']) {
                results.structures['list-expose'] = { wins: 0, total: 0, totalViews: 0 };
            }
            results.structures['list-expose'].total++;
            results.structures['list-expose'].totalViews += views;
            if (isWinner) results.structures['list-expose'].wins++;
        }

        // Track flops to avoid
        if (isFlop) {
            results.avoid.push({
                title: title,
                views: views,
                reason: 'Low views after 3+ days'
            });
        }
    });

    return results;
};

/**
 * Get best performing patterns ranked
 */
export const getBestPatterns = () => {
    // Load analytics
    let videos = [];
    if (fs.existsSync(ANALYTICS_PATH)) {
        const history = JSON.parse(fs.readFileSync(ANALYTICS_PATH, 'utf8'));
        if (history.snapshots?.length > 0) {
            videos = history.snapshots[history.snapshots.length - 1].videos || [];
        }
    }

    if (videos.length === 0) {
        return getDefaultPatterns();
    }

    const extracted = extractPatternsFromVideos(videos);

    // Rank by average views
    const rankByAvgViews = (obj) => {
        return Object.entries(obj)
            .map(([name, data]) => ({
                name,
                avgViews: data.total > 0 ? Math.round(data.totalViews / data.total) : 0,
                winRate: data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0,
                total: data.total,
                examples: data.examples || []
            }))
            .filter(p => p.total >= 1)
            .sort((a, b) => b.avgViews - a.avgViews);
    };

    return {
        hooks: rankByAvgViews(extracted.hooks),
        structures: rankByAvgViews(extracted.structures),
        avoid: extracted.avoid.slice(0, 5)
    };
};

/**
 * Default patterns when no data
 */
const getDefaultPatterns = () => ({
    hooks: [
        { name: 'rule-breaking', avgViews: 800, winRate: 80, total: 1 },
        { name: 'secrets-exposed', avgViews: 500, winRate: 60, total: 1 },
        { name: 'underdog-wins', avgViews: 400, winRate: 50, total: 1 }
    ],
    structures: [
        { name: 'unexpected-outcome', avgViews: 700, winRate: 70, total: 1 },
        { name: 'insider-revelation', avgViews: 400, winRate: 50, total: 1 }
    ],
    avoid: []
});

// ============================================================
// SMART TOPIC GENERATION
// ============================================================

/**
 * Fill template with random variables
 */
const fillTemplate = (template) => {
    let result = template;

    for (const [key, values] of Object.entries(TOPIC_VARIABLES)) {
        const regex = new RegExp(`{${key}}`, 'g');
        if (result.includes(`{${key}}`)) {
            const value = values[Math.floor(Math.random() * values.length)];
            result = result.replace(regex, value);
        }
    }

    return result;
};

/**
 * Generate topic using templates (fast, no API)
 */
const generateFromTemplate = (hookName, niche) => {
    const hook = HOOK_PATTERNS[hookName];
    if (!hook || !hook.templates) {
        return null;
    }

    const template = hook.templates[Math.floor(Math.random() * hook.templates.length)];
    return fillTemplate(template);
};

/**
 * Generate topic using AI (slower, more creative)
 */
const generateFromAI = async (bestPatterns, recentTopics, niche) => {
    if (!process.env.GEMINI_API_KEY) {
        return null;
    }

    const topHook = bestPatterns.hooks[0];
    const hookDef = HOOK_PATTERNS[topHook?.name] || HOOK_PATTERNS['secrets-exposed'];

    const prompt = `You are a viral content strategist. Generate ONE unique video topic.

WINNING PATTERN (from analytics):
- Hook Style: "${topHook?.name || 'secrets-exposed'}"
- Description: ${hookDef.description}
- Emotional Appeal: ${hookDef.emotionalAppeal}
- Average Views: ${topHook?.avgViews || 500}

NICHE: ${niche}

TOPICS ALREADY CREATED (DO NOT REPEAT OR MAKE SIMILAR):
${recentTopics.slice(-15).map(t => `- ${t}`).join('\n')}

TOPICS THAT FLOPPED (AVOID THESE PATTERNS):
${bestPatterns.avoid.map(a => `- ${a.title}`).join('\n') || '- None yet'}

Create a COMPLETELY NEW topic that:
1. Uses the winning hook style
2. Is NOT similar to any existing topic
3. Is specific and intriguing
4. Works as a YouTube Shorts title

Return ONLY the topic on one line. No explanation.`;

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        let topic = result.response.text().trim();

        // Clean up
        topic = topic.replace(/^["'\-\s]+|["'\-\s]+$/g, '').trim();
        topic = topic.split('\n')[0];

        return topic;
    } catch (error) {
        console.error('   ⚠️ AI generation failed:', error.message);
        return null;
    }
};

/**
 * MAIN: Generate a smart topic based on analytics
 */
export const generateSmartTopic = async (niche = 'general', useAI = true) => {
    console.log('🧠 Generating smart topic based on analytics...');

    const bestPatterns = getBestPatterns();
    const recentTopics = getRecentTopics(20);

    const topHook = bestPatterns.hooks[0]?.name || 'secrets-exposed';
    const topStructure = bestPatterns.structures[0]?.name || 'unexpected-outcome';

    console.log(`   📊 Best hook: ${topHook} (${bestPatterns.hooks[0]?.avgViews || 0} avg views)`);
    console.log(`   📊 Best structure: ${topStructure}`);
    console.log(`   📝 Already generated: ${recentTopics.length} topics`);

    let topic = null;
    let source = 'unknown';
    let attempts = 0;
    const maxAttempts = 5;

    while (!topic && attempts < maxAttempts) {
        attempts++;

        // Try AI first if enabled
        if (useAI && attempts <= 2) {
            topic = await generateFromAI(bestPatterns, recentTopics, niche);
            source = 'ai';
        }

        // Fallback to template
        if (!topic) {
            topic = generateFromTemplate(topHook, niche);
            source = 'template';
        }

        // Check for duplicates
        if (topic) {
            const dupCheck = isTopicDuplicate(topic);
            if (dupCheck.isDuplicate) {
                console.log(`   🔄 Attempt ${attempts}: "${topic.substring(0, 40)}..." too similar (${dupCheck.similarity}%)`);
                topic = null;
            }
        }
    }

    if (!topic) {
        // Ultimate fallback with timestamp
        topic = `${fillTemplate('{authority} reveals {number} {things} they hide')} (${Date.now() % 10000})`;
        source = 'fallback';
    }

    // Record the topic
    recordGeneratedTopic(topic, { hook: topHook, structure: topStructure, source });

    console.log(`   ✅ Generated (${source}): "${topic}"`);

    return {
        topic,
        niche,
        patterns: {
            hook: topHook,
            structure: topStructure,
            hookData: HOOK_PATTERNS[topHook]
        },
        source,
        analytics: {
            topHook: bestPatterns.hooks[0],
            topStructure: bestPatterns.structures[0],
            recentCount: recentTopics.length
        }
    };
};

/**
 * Get full recommendation with context
 */
export const getTopicRecommendation = async (niche = 'general') => {
    const result = await generateSmartTopic(niche, true);

    return {
        recommendedTopic: result.topic,
        niche: result.niche,
        whyThisWorks: `Uses "${result.patterns.hook}" hook pattern which averages ${result.analytics.topHook?.avgViews || 'N/A'} views`,
        patterns: result.patterns,
        avoid: getBestPatterns().avoid.map(a => a.title)
    };
};

export default {
    loadGeneratedTopics,
    recordGeneratedTopic,
    isTopicDuplicate,
    getRecentTopics,
    extractPatternsFromVideos,
    getBestPatterns,
    generateSmartTopic,
    getTopicRecommendation,
    HOOK_PATTERNS,
    STORY_STRUCTURES
};
