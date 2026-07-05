import { generateText } from "../llm.js";
import viralIntelligence from './viral_intelligence.js';
import explorationConfig from './exploration_config.js';
import performanceWeights from './performance_weights.js';
import dataService from '../../services/dataService.js';

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
    // TOP PERFORMER: Workplace + Secrets combo (your winning pattern!)
    'workplace-secrets': {
        keywords: ['secret', 'hide', 'fired', 'promoted', 'boss', 'manager', 'employee', 'ceo', 'hr', 'work', 'coworker'],
        emotionalAppeal: 'curiosity + rebellion',
        description: 'Workplace insider reveals secrets or breaks rules with unexpected outcome',
        templates: [
            '{authority} reveals what {institution} HIDE from {person}s',
            '{person} broke {rule} at work - got {outcome} instead of fired',
            'Why your {wrongdoer} doesn\'t want you to know about {secret}',
            '{person} secretly {action} for {time} - {wrongdoer} never found out',
            '{authority} exposes {number} {things} your company HIDES',
            'This {person} got {outcome} after exposing {institution}\'s {secret}',
            // NEW: Domain-specific templates
            '{workplace_role} {workplace_action} - WHAT HAPPENED NEXT',
            '{restaurant_role} {restaurant_action}?! SHOCKING outcome',
            '{customer_type} {customer_action} - I QUIT on the spot',
            '{wrongdoer} secretly {bad_action} - got {consequence}'
        ]
    },
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
    },
    'stupid-hustle': {
        keywords: ['hustle', 'passive income', 'side hustle', 'genius', 'evil', 'scheme', 'illegal', 'sigma', 'grindset'],
        emotionalAppeal: 'outrage + humor + disbelief',
        description: 'Absurd create-the-problem-sell-the-solution schemes. Satirical sigma grindset content designed to spark comment wars.',
        templates: [
            'Step 1: {create_problem}. Step 2: {sell_solution}',
            '{hustle_action} near your {hustle_business} - passive income',
            'Buy all the {scarce_item} before {event}, sell for {multiplier}x',
            '{sabotage_action}, then offer {repair_service}',
            'This {descriptor} hustle is either genius or a felony',
            'POV: You just ruined {victim_group}\'s day for ${money}',
            '{evil_setup} so you can {profit_action}',
            'The side hustle that got me banned from {location}',
            'Is this a business or a crime? The IRS can\'t tell',
            '{chaotic_action} at {location}, profit from the chaos'
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
    // Core characters - DOMAIN SPECIFIC
    person: ['employee', 'cashier', 'intern', 'manager', 'worker', 'new hire', 'customer', 'coworker', 'server', 'waiter'],
    authority: ['ex-banker', 'HR manager', 'former salesperson', 'retail worker', 'accountant', 'therapist', 'restaurant manager', 'shift supervisor'],
    institution: ['banks', 'corporations', 'retail stores', 'HR departments', 'insurance companies', 'restaurants', 'sales teams'],
    manipulator: ['salespeople', 'advertisers', 'employers', 'marketers', 'scammers', 'managers', 'bosses'],
    wrongdoer: ['boss', 'CEO', 'manager', 'company', 'landlord', 'customer', 'coworker'],
    underdog: ['quiet employee', 'youngest intern', 'overlooked worker', 'new hire', 'rookie server', 'part-timer'],
    descriptor: ['quietest', 'laziest', 'youngest', 'most overlooked', 'least experienced', 'newest'],

    // Rules and structures
    rule: ['company policy', 'dress code', 'work hours', 'the rules', 'protocol', 'employee handbook'],
    time: ['6 months', '2 years', '3 weeks', '1 year', 'months', 'days'],
    number: ['3', '5', '7', '4', '6'],
    things: ['secrets', 'tricks', 'habits', 'mistakes', 'lies', 'tactics', 'strategies'],

    // Actions - EXPANDED FOR WORKPLACE/RESTAURANT
    action: ['work from home', 'ignore meetings', 'break dress code', 'speak up', 'say no', 'steal tips', 'skip shifts', 'take breaks', 'call out sick'],
    outcome: ['promoted', 'praised', 'rewarded', 'given a raise', 'made manager', 'got bonus', 'kept the job'],
    bad_action: ['secretly cut pay', 'lied to employees', 'stole credit', 'broke promises', 'stole tips', 'stole sales', 'cut hours', 'underpaid staff'],
    good_outcome: ['promotion', 'raise', 'success', 'recognition', 'bonus', 'better shift'],
    consequence: ['fired', 'exposed', 'caught', 'sued', 'karma', 'demoted', 'reported'],

    // Topics and themes
    topic: ['success', 'money', 'confidence', 'relationships', 'career', 'workplace', 'customer service'],
    secret: ['this loophole', 'these tricks', 'this strategy', 'the real way', 'this secret'],
    unexpected: ['not what you think', 'the opposite', 'completely different', 'shocking', 'surprising'],

    // NEW: Domain-specific additions for RESTAURANT
    restaurant_role: ['server', 'waiter', 'waitress', 'bartender', 'chef', 'host', 'busser', 'cook'],
    restaurant_action: ['gave huge discount', 'comped the meal', 'added free items', 'spit in food', 'stole tips', 'gave extra', 'offered refund'],
    restaurant_item: ['discount', 'free meal', 'comp', 'tip', 'appetizer', 'dessert', 'drinks'],

    // NEW: Domain-specific additions for WORKPLACE/OFFICE
    workplace_role: ['coworker', 'colleague', 'teammate', 'supervisor', 'boss', 'manager', 'executive', 'HR'],
    workplace_action: ['stole my sale', 'took credit', 'sabotaged project', 'gossiped about me', 'reported me', 'got promoted', 'got bonus'],
    workplace_item: ['sale', 'commission', 'bonus', 'promotion', 'raise', 'project', 'client', 'deal'],

    // NEW: Customer service specific
    customer_type: ['rude customer', 'angry customer', 'Karen', 'entitled customer', 'regular', 'VIP'],
    customer_action: ['yelled at me', 'demanded refund', 'left bad review', 'complained', 'threw tantrum', 'tipped big'],

    // STUPID HUSTLE variables - for satirical engagement bait content
    create_problem: ['spread bread in parking lot for birds', 'release mosquitoes', 'puncture bike tires', 'hide all the shopping carts', 'disconnect the WiFi', 'deflate the bouncy castle', 'spill coffee on laptops', 'put fake parking tickets', 'block the bathroom', 'unplug all phone chargers'],
    sell_solution: ['offer car wash service', 'sell bug spray', 'offer bike repair', 'rent carts for $5', 'sell hotspot access', 'rent an air pump', 'offer laptop repair', 'sell ticket removal for $10', 'sell bathroom key access', 'rent portable chargers'],
    hustle_action: ['Release mosquitoes', 'Spread bird seed', 'Put nails on the road', 'Disconnect WiFi router', 'Hide all the towels', 'Deflate pool floats'],
    hustle_business: ['bug spray stand', 'car wash', 'tire repair shop', 'hotspot rental', 'towel rental kiosk', 'pump rental booth'],
    scarce_item: ['umbrellas', 'ice', 'bottled water', 'sunscreen', 'phone chargers', 'toilet paper', 'hand sanitizer', 'face masks'],
    event: ['it rains', 'the heatwave', 'the festival', 'the power outage', 'the concert', 'the game'],
    multiplier: ['5', '10', '20', '50', '100'],
    sabotage_action: ['Slash tires', 'Break phone screens', 'Clog toilets', 'Kill batteries', 'Ruin paint jobs', 'Scratch windshields'],
    repair_service: ['mobile tire service', 'phone repair', 'plumbing services', 'charging station', 'detailing service', 'glass repair'],
    victim_group: ['everyone at the beach', 'the whole parking lot', 'every shopper', 'all the gym members', 'the entire neighborhood', 'every driver'],
    money: ['500', '1000', '2000', '5000', '200'],
    evil_setup: ['Train pigeons to steal food', 'Fake a water main break', 'Start a rumor it\'s haunted', 'Spread fake bedbugs rumors', 'Tell everyone there\'s a gas leak'],
    profit_action: ['sell pigeon-proof containers', 'sell bottled water', 'offer ghost removal services', 'sell mattress covers', 'sell air purifiers'],
    location: ['Walmart', 'the mall', 'the beach', 'the airport', 'the gym', 'the farmers market', 'the parking lot', 'the food court'],
    chaotic_action: ['Release 100 crickets', 'Trigger the fire alarm', 'Let loose a skunk', 'Dump glitter everywhere', 'Play baby crying sounds']
};

// ============================================================
// TOPIC TRACKING - Avoid Repetition
// ============================================================

/**
 * Load generated topics history
 * Uses dataService for multi-tenant support
 */
export const loadGeneratedTopics = async (userId, platform = 'general') => {
    try {
        const topics = await dataService.topics.getTopics(userId, platform);
        if (topics && topics.length > 0) {
            return {
                topics: topics.map(t => ({
                    topic: t.topic,
                    fingerprint: createFingerprint(t.topic),
                    patterns: t.metadata || {},
                    videoId: t.videoId,
                    performance: t.performanceScore ? { score: t.performanceScore } : null,
                    generatedAt: t.createdAt
                })),
                lastGenerated: topics[0]?.createdAt || null
            };
        }
    } catch (err) {
        console.error('Failed to load topics:', err.message);
    }

    return {
        topics: [],
        lastGenerated: null
    };
};

/**
 * Record a newly generated topic
 * Uses dataService for multi-tenant support
 */
export const recordGeneratedTopic = async (userId, topic, patterns = {}, videoId = null) => {
    try {
        await dataService.topics.saveTopic(userId, patterns.platform || 'general', {
            topic: topic,
            niche: patterns.niche || 'general',
            hook: patterns.hook,
            script: null,
            visualStyle: patterns.visualStyle,
            voiceStyle: patterns.voiceStyle,
            source: patterns.source || 'smart_generator',
            performanceScore: 0,
            metadata: {
                ...patterns,
                fingerprint: createFingerprint(topic),
                videoId,
                generatedAt: new Date().toISOString()
            }
        });
        console.log(`   📝 Recorded topic: "${topic.substring(0, 50)}..."`);
    } catch (err) {
        console.error('Failed to record topic:', err.message);
    }
};

/**
 * Link a generated topic to its YouTube video ID
 */
export const linkTopicToVideo = async (userId, topic, videoId, platform = 'general') => {
    try {
        const topics = await dataService.topics.getTopics(userId, platform);
        const topicEntry = topics.find(t =>
            t.topic === topic || createFingerprint(t.topic) === createFingerprint(topic)
        );

        if (topicEntry) {
            await dataService.topics.updateTopic(topicEntry.id, {
                metadata: {
                    ...(topicEntry.metadata || {}),
                    videoId,
                    linkedAt: new Date().toISOString()
                }
            });
            console.log(`   🔗 Linked topic to video ${videoId}`);
            return true;
        }
    } catch (err) {
        console.error('Failed to link topic to video:', err.message);
    }
    return false;
};

/**
 * Update topic performance when we get video stats
 * This closes the feedback loop!
 */
export const updateTopicPerformance = async (userId, videoId, views, likes, comments, platform = 'general') => {
    try {
        const topics = await dataService.topics.getTopics(userId, platform);
        const topicEntry = topics.find(t => t.metadata?.videoId === videoId);

        if (topicEntry) {
            // Track pattern performance for viral intelligence
            if (topicEntry.hook) {
                await viralIntelligence.trackPatternAttempt(
                    userId,
                    { hookType: topicEntry.hook, niche: topicEntry.niche || 'general' },
                    { views, likes, comments }
                );
            }

            await dataService.topics.updateTopic(topicEntry.id, {
                performanceScore: views,
                metadata: {
                    ...(topicEntry.metadata || {}),
                    performance: {
                        views,
                        likes,
                        comments,
                        updatedAt: new Date().toISOString()
                    }
                }
            });

            console.log(`   📈 Updated performance for ${videoId}: ${views} views`);
            return topicEntry;
        }
    } catch (err) {
        console.error('Failed to update topic performance:', err.message);
    }
    return null;
};

/**
 * Get topics that need performance tracking
 */
export const getTopicsNeedingPerformanceUpdate = async (userId, platform = 'general') => {
    try {
        const topics = await dataService.topics.getTopics(userId, platform);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        return topics.filter(t =>
            t.metadata?.videoId &&
            !t.metadata?.performance &&
            new Date(t.createdAt) < oneDayAgo
        );
    } catch (err) {
        console.error('Failed to get topics needing update:', err.message);
        return [];
    }
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
export const isTopicDuplicate = async (userId, newTopic, platform = 'general', threshold = 0.5) => {
    try {
        const topics = await dataService.topics.getTopics(userId, platform, { limit: 100 });
        const newFingerprint = createFingerprint(newTopic);
        const newWords = new Set(newFingerprint.split('_'));

        for (const existing of topics) {
            const existingFingerprint = existing.metadata?.fingerprint || createFingerprint(existing.topic);
            const existingWords = new Set(existingFingerprint.split('_'));

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
    } catch (err) {
        console.error('Duplicate check failed:', err.message);
    }
    return { isDuplicate: false };
};

/**
 * Get list of recently generated topics (for AI prompt)
 */
export const getRecentTopics = async (userId, platform = 'general', count = 20) => {
    try {
        const topics = await dataService.topics.getTopics(userId, platform, { limit: count });
        return topics.map(t => t.topic);
    } catch (err) {
        console.error('Failed to get recent topics:', err.message);
        return [];
    }
};

// ============================================================
// DEEP PATTERN EXTRACTION
// ============================================================

/**
 * Extract patterns from video performance data
 * NOW TRACKS OUTLIER POTENTIAL - not just averages!
 */
export const extractPatternsFromVideos = (videos) => {
    // Calculate channel average for dynamic winner threshold
    const allViews = videos.map(v => v.stats?.views || 0).filter(v => v > 0);
    const channelAvg = allViews.length > 0 ? allViews.reduce((a, b) => a + b, 0) / allViews.length : 100;
    const outlierThreshold = channelAvg * 3; // 3x average = viral hit
    const winnerThreshold = Math.max(channelAvg * 1.5, 200); // At least 1.5x avg or 200

    const results = {
        hooks: {},
        structures: {},
        emotions: {},
        avoid: [],
        channelStats: { avgViews: Math.round(channelAvg), outlierThreshold: Math.round(outlierThreshold) }
    };

    videos.forEach(video => {
        const views = video.stats?.views || 0;
        const likes = video.stats?.likes || 0;
        const title = video.title || '';
        const isWinner = views >= winnerThreshold;
        const isOutlier = views >= outlierThreshold; // TRUE VIRAL HIT
        const isFlop = views < channelAvg * 0.3 && (video.daysSincePublished || 0) > 3;

        // Detect hook patterns
        for (const [hookName, hookData] of Object.entries(HOOK_PATTERNS)) {
            const hasPattern = hookData.keywords.some(kw =>
                title.toLowerCase().includes(kw.toLowerCase())
            );

            if (hasPattern) {
                if (!results.hooks[hookName]) {
                    results.hooks[hookName] = {
                        wins: 0,
                        total: 0,
                        totalViews: 0,
                        maxViews: 0,        // Track best performer
                        outlierCount: 0,    // How many viral hits
                        winnerViews: 0,     // Only count winner views
                        examples: [],
                        bestVideo: null     // The actual viral hit
                    };
                }
                results.hooks[hookName].total++;
                results.hooks[hookName].totalViews += views;

                // Track max views (viral potential indicator)
                if (views > results.hooks[hookName].maxViews) {
                    results.hooks[hookName].maxViews = views;
                    results.hooks[hookName].bestVideo = title;
                }

                // Track outliers (true viral hits)
                if (isOutlier) {
                    results.hooks[hookName].outlierCount++;
                }

                if (isWinner) {
                    results.hooks[hookName].wins++;
                    results.hooks[hookName].winnerViews += views;
                    results.hooks[hookName].examples.push(title);
                }
            }
        }

        // Detect story structures
        if (/got promoted|instead of|but actually|turned out/i.test(title)) {
            if (!results.structures['unexpected-outcome']) {
                results.structures['unexpected-outcome'] = { wins: 0, total: 0, totalViews: 0, maxViews: 0, outlierCount: 0 };
            }
            results.structures['unexpected-outcome'].total++;
            results.structures['unexpected-outcome'].totalViews += views;
            if (views > results.structures['unexpected-outcome'].maxViews) results.structures['unexpected-outcome'].maxViews = views;
            if (isOutlier) results.structures['unexpected-outcome'].outlierCount++;
            if (isWinner) results.structures['unexpected-outcome'].wins++;
        }

        if (/reveals?|exposes?|secrets?|hidden/i.test(title)) {
            if (!results.structures['insider-revelation']) {
                results.structures['insider-revelation'] = { wins: 0, total: 0, totalViews: 0, maxViews: 0, outlierCount: 0 };
            }
            results.structures['insider-revelation'].total++;
            results.structures['insider-revelation'].totalViews += views;
            if (views > results.structures['insider-revelation'].maxViews) results.structures['insider-revelation'].maxViews = views;
            if (isOutlier) results.structures['insider-revelation'].outlierCount++;
            if (isWinner) results.structures['insider-revelation'].wins++;
        }

        if (/d+s+(things?|ways?|habits?|tricks?|secrets?|mistakes?)/i.test(title)) {
            if (!results.structures['list-expose']) {
                results.structures['list-expose'] = { wins: 0, total: 0, totalViews: 0, maxViews: 0, outlierCount: 0 };
            }
            results.structures['list-expose'].total++;
            results.structures['list-expose'].totalViews += views;
            if (views > results.structures['list-expose'].maxViews) results.structures['list-expose'].maxViews = views;
            if (isOutlier) results.structures['list-expose'].outlierCount++;
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
 * Uses dataService for multi-tenant support
 */
export const getBestPatterns = async (userId, platform = null) => {
    // Load analytics from dataService
    let videos = [];

    try {
        if (platform) {
            videos = await dataService.analytics.getAnalyticsByPlatform(userId, platform);
        } else {
            const analyticsHistory = await dataService.analytics.getAnalyticsHistory(userId);
            if (analyticsHistory && typeof analyticsHistory === 'object') {
                // Flatten analytics from all platforms
                for (const platformData of Object.values(analyticsHistory)) {
                    if (Array.isArray(platformData)) {
                        videos = videos.concat(platformData);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Failed to load analytics for patterns:', err.message);
    }

    if (videos.length === 0) {
        return getDefaultPatterns();
    }

    const extracted = extractPatternsFromVideos(videos);

    // Rank by OUTLIER POTENTIAL - prioritize patterns that produce viral hits
    // This is the key change: we care about MAX views, not average views!
    const rankByOutlierPotential = (obj) => {
        return Object.entries(obj)
            .map(([name, data]) => ({
                name,
                maxViews: data.maxViews || 0,           // Highest performing video
                outlierCount: data.outlierCount || 0,   // How many viral hits
                avgViews: data.total > 0 ? Math.round(data.totalViews / data.total) : 0,
                winnerAvg: data.wins > 0 ? Math.round(data.winnerViews / data.wins) : 0, // Avg of winners only
                winRate: data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0,
                total: data.total,
                bestVideo: data.bestVideo || null,
                examples: data.examples || []
            }))
            .filter(p => p.total >= 1)
            // SORT BY: outlier count first, then max views, then winner average
            .sort((a, b) => {
                // Patterns with outliers always win
                if (a.outlierCount !== b.outlierCount) return b.outlierCount - a.outlierCount;
                // Then by max views (viral potential)
                if (a.maxViews !== b.maxViews) return b.maxViews - a.maxViews;
                // Then by average of winners only
                return b.winnerAvg - a.winnerAvg;
            });
    };

    return {
        hooks: rankByOutlierPotential(extracted.hooks),
        structures: rankByOutlierPotential(extracted.structures),
        channelStats: extracted.channelStats,
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
 * Fill template with WEIGHTED random variables
 * Uses performance_weights.js instead of pure Math.random()
 */
const fillTemplate = async (userId, template, platform = 'youtube') => {
    let result = template;
    const usedVariables = {};  // Track what we use for analytics

    for (const [key, values] of Object.entries(TOPIC_VARIABLES)) {
        const regex = new RegExp(`{${key}}`, 'g');
        if (result.includes(`{${key}}`)) {
            // Use weighted selection instead of pure random
            const value = await performanceWeights.selectWeightedVariable(userId, key, values, platform);
            result = result.replace(regex, value);
            usedVariables[key] = value;
        }
    }

    // Return object with topic and metadata
    return {
        topic: result,
        usedVariables
    };
};

/**
 * Generate topic using templates (fast, no API)
 * Now uses weighted template selection
 */
const generateFromTemplate = async (userId, hookName, niche, platform = 'youtube') => {
    const hook = HOOK_PATTERNS[hookName];
    if (!hook || !hook.templates) {
        return null;
    }

    // Use weighted selection for template (or random if no data yet)
    const templateIndex = Math.floor(Math.random() * hook.templates.length);
    const template = hook.templates[templateIndex];
    const templateId = `${hookName}_template_${templateIndex}`;

    const result = await fillTemplate(userId, template, platform);

    // Attach metadata for tracking
    return {
        topic: result.topic,
        templateId,
        hookName,
        usedVariables: result.usedVariables || {}
    };
};

/**
 * HYBRID VIRAL ANALYSIS
 * Uses multiple statistical methods instead of simple average
 *
 * Why hybrid?
 * - Average is skewed by failures (most videos perform below average)
 * - Uses percentiles to identify true top performers
 * - Combines relative (channel) + absolute (platform) thresholds
 */
const analyzeViralPotential = (videos) => {
    if (!videos || videos.length === 0) {
        return {
            viralThreshold: 1000,
            median: 0,
            top10Percentile: 0,
            max: 0,
            scoreMethod: 'platform_default',
            reasoning: 'No data - using platform minimum (1000 views)'
        };
    }

    // Extract view counts and sort
    const viewCounts = videos
        .map(v => v.stats?.views || 0)
        .filter(v => v > 0)
        .sort((a, b) => a - b);

    if (viewCounts.length === 0) {
        return {
            viralThreshold: 1000,
            median: 0,
            top10Percentile: 0,
            max: 0,
            scoreMethod: 'platform_default',
            reasoning: 'No views data - using platform minimum'
        };
    }

    // Calculate statistical measures
    const median = viewCounts[Math.floor(viewCounts.length * 0.5)];
    const top10Percentile = viewCounts[Math.floor(viewCounts.length * 0.9)] || median;
    const top25Percentile = viewCounts[Math.floor(viewCounts.length * 0.75)] || median;
    const max = viewCounts[viewCounts.length - 1];

    // HYBRID THRESHOLD CALCULATION
    // Viral = Must meet AT LEAST ONE of these criteria:
    // 1. In top 10% of your videos AND above 1000 views (platform recognition)
    // 2. OR 5x median (statistical outlier)
    // 3. Floor of 1000 views (YouTube algorithm threshold)

    const medianOutlier = median * 5; // 5x median = outlier
    const platformMinimum = 1000; // YouTube starts pushing videos at 1k+

    const viralThreshold = Math.max(
        platformMinimum, // Never go below platform threshold
        Math.min(top10Percentile, medianOutlier) // Use lower of: top 10% or 5x median
    );

    let scoreMethod = '';
    let reasoning = '';

    if (top10Percentile >= platformMinimum) {
        scoreMethod = 'top_10_percentile';
        reasoning = `Top 10% of your videos (${Math.round(top10Percentile)}+ views)`;
    } else if (medianOutlier >= platformMinimum) {
        scoreMethod = 'median_outlier';
        reasoning = `5x your median performance (${Math.round(medianOutlier)}+ views)`;
    } else {
        scoreMethod = 'platform_minimum';
        reasoning = 'Platform minimum threshold (1000+ views for YouTube push)';
    }

    return {
        viralThreshold: Math.round(viralThreshold),
        median: Math.round(median),
        top10Percentile: Math.round(top10Percentile),
        top25Percentile: Math.round(top25Percentile),
        max: Math.round(max),
        scoreMethod,
        reasoning,
        totalVideos: viewCounts.length
    };
};

/**
 * Calculate viral score using HYBRID analysis
 * Score 0-10 based on percentile ranking + absolute thresholds
 */
const calculateViralScore = (views, viralAnalysis) => {
    if (!views || views <= 0) return 0;

    // If viralAnalysis is a number (legacy channelAvg), use old logic temporarily
    if (typeof viralAnalysis === 'number') {
        const channelAvg = viralAnalysis;
        if (!channelAvg || channelAvg <= 0) return 0;
        const ratio = views / channelAvg;
        return Math.min(10, ratio * 3).toFixed(1);
    }

    const { viralThreshold, top10Percentile, median, max } = viralAnalysis;

    // Score 10: Maximum performing video
    if (views >= max) return 10.0;

    // Score 9-10: Above viral threshold
    if (views >= viralThreshold) {
        const ratio = views / viralThreshold;
        return Math.min(10, 9 + ratio).toFixed(1);
    }

    // Score 7-9: In top 10% but below viral threshold
    if (views >= top10Percentile) {
        const ratio = (views - top10Percentile) / (viralThreshold - top10Percentile);
        return (7 + ratio * 2).toFixed(1);
    }

    // Score 5-7: Above median
    if (views >= median) {
        const ratio = (views - median) / (top10Percentile - median);
        return (5 + ratio * 2).toFixed(1);
    }

    // Score 0-5: Below median
    const ratio = views / median;
    return (ratio * 5).toFixed(1);
};

/**
 * Generate topic using AI - DOMAIN-AWARE & EXPLORATION-CONSCIOUS
 * Learns from videos with viral score 9+ and respects domain boundaries
 *
 * @param {object} bestPatterns - Top performing patterns
 * @param {array} recentTopics - Recently generated topics
 * @param {string} niche - Content niche
 * @param {object} viralData - Viral intelligence data with domain info
 * @param {object} explorationMode - Exploration mode decision
 */
const generateFromAI = async (bestPatterns, recentTopics, niche, viralData = null, explorationMode = null) => {
    if (!process.env.ANTHROPIC_API_KEY) {
        return null;
    }

    const topVideos = viralData?.topVideos || [];

    // Use HYBRID analysis instead of simple average
    const viralAnalysis = analyzeViralPotential(topVideos);
    const { viralThreshold, median, top10Percentile, max, scoreMethod, reasoning } = viralAnalysis;

    console.log(`   📊 Viral Analysis (${scoreMethod}):`);
    console.log(`      Threshold: ${viralThreshold} views - ${reasoning}`);
    console.log(`      Median: ${median} | Top 10%: ${top10Percentile} | Max: ${max}`);

    // FILTER: Only use videos with viral score >= 9
    const MIN_VIRAL_SCORE = 9;

    const highViralVideos = topVideos.filter(v => {
        const views = v.stats?.views || 0;
        const score = parseFloat(calculateViralScore(views, viralAnalysis));
        return score >= MIN_VIRAL_SCORE;
    });

    console.log(`   🔥 Found ${highViralVideos.length} videos with viral score 9+ (${viralThreshold}+ views)`);

    // NEW: Extract domain information from viral data
    const bestDomain = viralData?.bestDomain || null;
    const domainContext = bestDomain ? {
        domain: bestDomain.domain,
        characters: bestDomain.characters || [],
        actions: bestDomain.actions || [],
        subDomains: bestDomain.subDomains || [],
        avgViews: bestDomain.avgViews || 0,
        examples: bestDomain.examples?.slice(0, 5) || []
    } : null;

    // Build examples ONLY from high-viral videos (score 9+)
    const viralExamples = highViralVideos
        .slice(0, 15)
        .map(v => {
            const views = v.stats?.views || 0;
            const score = calculateViralScore(views, viralAnalysis);
            return `- "${v.title}" (${views.toLocaleString()} views, score: ${score}/10)`;
        })
        .join('\n');

    const hasViralData = highViralVideos.length > 0;

    // Determine exploration type
    const isExploration = explorationMode?.isExploration || false;
    const explorationType = explorationMode?.type || 'exploit';
    const isStupidHustle = niche === 'stupid_hustle' || explorationType === 'stupid_hustle';

    // Build domain constraint message
    let domainConstraint = '';
    if (domainContext && !isStupidHustle) {
        const characterList = domainContext.characters.join(', ');
        const actionList = domainContext.actions.join(', ');

        if (isExploration && explorationType !== 'experimental') {
            // EXPLORATION MODE: Same domain, different angle
            domainConstraint = `
🎯 DOMAIN CONSTRAINT (${explorationType.toUpperCase()} EXPLORATION):
- Primary Domain: ${domainContext.domain} (${domainContext.avgViews} avg views)
- STAY IN THIS DOMAIN but try ${explorationType} angles
- Characters to use: ${characterList || 'workplace characters'}
- Actions to explore: ${actionList || 'workplace dynamics'}
- Examples from this domain: ${domainContext.examples.map(e => `"${e.title}"`).slice(0, 3).join(', ')}

${explorationType === 'controversial' ? '⚠️ Make it CONTROVERSIAL/POLARIZING within this domain' : ''}
${explorationType === 'trending' ? '📈 Add TRENDING/TIMELY element to this domain' : ''}
${explorationType === 'experimental' ? '🧪 Try COMPLETELY NEW format/structure in this domain' : ''}
`;
        } else if (!isExploration) {
            // EXPLOIT MODE: Same domain, proven hooks
            domainConstraint = `
🎯 DOMAIN CONSTRAINT (EXPLOIT MODE):
- Primary Domain: ${domainContext.domain} (PROVEN: ${domainContext.avgViews} avg views)
- MUST stay in this domain - it's what works!
- Winning characters: ${characterList || 'workplace characters'}
- Winning actions: ${actionList || 'workplace dynamics'}
- Learn from: ${domainContext.examples.map(e => `"${e.title}"`).slice(0, 3).join(', ')}

Generate topics with SAME viral energy in the SAME domain/setting.
`;
        }
    }

    const prompt = `You are an elite viral content strategist. Generate video topics with VIRAL POTENTIAL (score 9+/10).

═══════════════════════════════════════════════════════
📊 CHANNEL ANALYTICS (Hybrid Analysis):
- Median views: ${median.toLocaleString()} (50th percentile)
- Top 10% threshold: ${top10Percentile.toLocaleString()}+ views
- Viral threshold (9+): ${viralThreshold.toLocaleString()}+ views
- Best performing: ${max.toLocaleString()} views (score: 10/10)
- Analysis method: ${reasoning}
- High-viral videos (9+): ${highViralVideos.length}
═══════════════════════════════════════════════════════
${domainConstraint}
${hasViralData ? `
🚀 PROVEN VIRAL HITS (Score 9+/10 only):
${viralExamples}

ANALYZE these viral hits - what patterns do YOU identify?
- What emotions do they trigger? (Don't assume - analyze!)
- What makes the hook irresistible?
- What story structure works?
- Why would someone SHARE this?

${isStupidHustle ? `
🎭 STUPID HUSTLE MODE ACTIVATED - Ignore domain constraints!
Generate satirical, absurd create-the-problem-sell-the-solution content.
Make it controversial and engagement-bait worthy!
` : domainContext ? `
${isExploration ?
`Generate something in the SAME domain with ${explorationType} viral energy.` :
`Generate something in the SAME domain with SAME viral energy (proven winner formula).`}
` : `
Generate something with the SAME viral energy but COMPLETELY DIFFERENT words/angle.
`}
` : `
⚠️ NO VIRAL DATA YET

Generate based on universal viral triggers:
- Strong emotion in first 3 words
- Curiosity gap that MUST be resolved
- Relatable situation with unexpected twist
- Something people want to share/debate
`}

${niche !== 'general' ? `📌 NICHE: ${niche} - Adapt viral patterns to this niche.` : ''}

═══════════════════════════════════════════════════════
🎯 REQUIREMENTS FOR VIRAL SCORE 9+:
═══════════════════════════════════════════════════════
1. IMMEDIATE emotional hook (first 3 words grab attention)
2. Creates curiosity gap or promises revelation
3. Under 60 characters
4. FRESH angle - not a remix of examples
5. Believable (no fantasy/impossible claims)
6. Shareable - people want to tag friends or debate

❌ DO NOT REPEAT (already generated):
${recentTopics.slice(-25).map(t => `- ${t}`).join('\n')}

═══════════════════════════════════════════════════════
Generate ONE viral topic (targeting score 9+).
Be creative, surprising, and emotionally compelling!

Return ONLY the topic. Nothing else.`;

    try {
        const responseText = await generateText(prompt);
        let topic = responseText.trim();

        // Clean up
        topic = topic.replace(/^["'\-\s]+|["'\-\s]+$/g, '').trim();
        topic = topic.split('\n')[0];
        topic = topic.replace(/^["']|["']$/g, '');

        return topic;
    } catch (error) {
        console.error('   ⚠️ AI generation failed:', error.message);
        return null;
    }
};

/**
 * MAIN: Generate a smart topic based on analytics
 * NOW POWERED BY:
 * 1. VIRAL INTELLIGENCE SYSTEM - Outlier detection & pattern analysis
 * 2. PERFORMANCE WEIGHTS - Weighted selection based on historical success
 * 3. EXPLORATION CONFIG - Explore/exploit balance
 *
 * @param {string} userId - User ID for multi-tenant support
 * @param {string} niche - Content niche
 * @param {boolean} useAI - Whether to use AI generation
 * @param {Array} freshVideos - Optional fresh video data from YouTube API (bypasses stale cache)
 * @param {string} platform - Target platform (youtube, tiktok, instagram, facebook)
 */
export const generateSmartTopic = async (userId, niche = 'general', useAI = true, freshVideos = null, platform = 'youtube') => {
    console.log(`🧠 Generating smart topic for ${platform.toUpperCase()} using WEIGHTED INTELLIGENCE...`);
    console.log(`   User: ${userId}`);

    // CHECK EXPLORATION CONFIG FIRST
    const explorationDecision = await explorationConfig.shouldExplore(userId, platform);
    const stupidHustleDecision = await explorationConfig.shouldBeStupidHustle(userId, platform);

    console.log(`   🎲 Exploration decision: ${explorationDecision.isExploration ? 'EXPLORE' : 'EXPLOIT'} (${explorationDecision.reason})`);

    // If exploration mode selected stupid_hustle, override niche
    if (stupidHustleDecision.isStupidHustle) {
        niche = 'stupid_hustle';
        console.log(`   🎭 Stupid Hustle mode activated! (${stupidHustleDecision.escalationLevel} chaos)`);
    } else if (explorationDecision.isExploration && explorationDecision.type !== 'exploit') {
        console.log(`   🔬 Exploration type: ${explorationDecision.type}`);
    }

    // Load viral intelligence data
    let viralData = null;
    let channelAvg = 1000; // Default channel average
    try {
        // Use fresh videos if provided, otherwise fall back to cached data
        let videos = freshVideos || [];

        if (videos.length === 0) {
            // Try dataService first
            try {
                videos = await dataService.analytics.getAnalyticsByPlatform(userId, platform);
                console.log('   📦 Using dataService analytics data');
            } catch (dsErr) {
                console.error('   ⚠️ Failed to load analytics:', dsErr.message);
            }
        } else if (freshVideos) {
            console.log('   🔄 Using fresh API data');
        }

        // Run viral analysis with AI emotions
        if (videos.length > 0) {
            const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);
            viralData = await viralIntelligence.analyzeForOutliers(userId, videos, emotionMap);
            viralData.recommendation = await viralIntelligence.getRecommendedPattern(userId, viralData);
            channelAvg = viralData.avgViews || 1000;

            // UPDATE PERFORMANCE WEIGHTS from analytics (batch update)
            await performanceWeights.updateFromAnalytics(userId, platform, videos, channelAvg);
        }
    } catch (err) {
        console.error('   ⚠️ Viral intelligence failed:', err.message);
    }

    const bestPatterns = await getBestPatterns(userId, platform);
    const recentTopics = await getRecentTopics(userId, platform, 20);

    // NICHE-TO-HOOK MAPPING: Force specific hook patterns for certain niches
    const NICHE_HOOK_MAP = {
        'stupid_hustle': 'stupid-hustle',
        'stupid-hustle': 'stupid-hustle',
        'hustle': 'stupid-hustle',
        'controversial': 'rule-breaking',
        'secrets': 'secrets-exposed',
        'workplace': 'workplace-secrets',
        'psychology': 'manipulation-awareness',
        'revenge': 'revenge-karma'
    };

    // Use viral intelligence recommendation if available
    const recommendation = viralData?.recommendation;

    // WEIGHTED HOOK SELECTION - uses performance_weights.js
    let topHook;
    if (NICHE_HOOK_MAP[niche]) {
        // Niche forces a specific hook
        topHook = NICHE_HOOK_MAP[niche];
    } else if (!explorationDecision.isExploration) {
        // EXPLOIT MODE: Use weighted selection based on performance data
        topHook = await performanceWeights.selectBestHook(userId, HOOK_PATTERNS, platform);
        console.log(`   🎯 Weighted hook selection: ${topHook}`);
    } else {
        // EXPLORE MODE: Try something new (lower-weighted or random)
        const hookNames = Object.keys(HOOK_PATTERNS);
        topHook = hookNames[Math.floor(Math.random() * hookNames.length)];
        console.log(`   🔬 Exploration hook: ${topHook}`);
    }

    let topEmotion = recommendation?.emotion || 'curiosity';
    const topStructure = recommendation?.structure || bestPatterns.structures[0]?.name || 'unexpected-outcome';

    // Override emotion for stupid-hustle (needs outrage + humor)
    if (topHook === 'stupid-hustle') {
        topEmotion = 'outrage';
        console.log(`   🎭 Stupid Hustle mode: Generating satirical engagement bait content`);
    }

    // Check if pattern is killed (using BOTH systems)
    const isKilledByVI = await viralIntelligence.isPatternKilled(userId, topHook, niche);
    const isKilledByPW = await performanceWeights.isKilled(userId, topHook, platform);

    if (isKilledByVI || isKilledByPW) {
        console.log(`   ☠️ Pattern "${topHook}" is killed - switching to backup`);
        // Find next best pattern that isn't killed (weighted)
        const alternatives = [];
        for (const h of Object.keys(HOOK_PATTERNS)) {
            const killedVI = await viralIntelligence.isPatternKilled(userId, h, niche);
            const killedPW = await performanceWeights.isKilled(userId, h, platform);
            if (!killedVI && !killedPW) {
                alternatives.push(h);
            }
        }
        if (alternatives.length > 0) {
            topHook = await performanceWeights.selectBestHook(
                userId,
                Object.fromEntries(alternatives.map(a => [a, HOOK_PATTERNS[a]])),
                platform
            );
        }
    }

    // Log viral intelligence insights
    if (viralData) {
        console.log(`   🧠 VIRAL INTELLIGENCE:`);
        console.log(`      📊 Channel Avg: ${viralData.avgViews} views`);
        console.log(`      🚀 Outliers Found: ${viralData.outlierCount} videos`);
        console.log(`      🎯 Selected Hook: ${topHook} + ${topEmotion}`);
        console.log(`      💡 Reason: ${recommendation?.reason || 'Using weighted selection'}`);
    } else {
        console.log(`   📊 Best hook: ${topHook} (weighted by performance)`);
        console.log(`   📊 Best structure: ${topStructure}`);
    }
    console.log(`   📝 Already generated: ${recentTopics.length} topics`);

    let topic = null;
    let templateResult = null;
    let source = 'unknown';
    let attempts = 0;
    const maxAttempts = 5;

    while (!topic && attempts < maxAttempts) {
        attempts++;

        // Try AI first if enabled - now with viral intelligence data AND exploration mode
        if (useAI && attempts <= 2) {
            topic = await generateFromAI(bestPatterns, recentTopics, niche, viralData, explorationDecision);
            source = explorationDecision.isExploration ? `ai-${explorationDecision.type}` : 'ai-exploit';
        }

        // Fallback to template (with weighted variables)
        if (!topic) {
            templateResult = await generateFromTemplate(userId, topHook, niche, platform);
            topic = templateResult?.topic || templateResult;
            source = 'template-weighted';
        }

        // Check for duplicates
        if (topic) {
            const topicStr = typeof topic === 'string' ? topic : topic.toString();
            const dupCheck = await isTopicDuplicate(userId, topicStr, platform);
            if (dupCheck.isDuplicate) {
                console.log(`   🔄 Attempt ${attempts}: "${topicStr.substring(0, 40)}..." too similar (${dupCheck.similarity}%)`);
                topic = null;
                templateResult = null;
            }
        }
    }

    if (!topic) {
        // Ultimate fallback with timestamp
        const fallbackResult = await fillTemplate(userId, '{authority} reveals {number} {things} they hide', platform);
        topic = `${fallbackResult.topic} (${Date.now() % 10000})`;
        source = 'fallback';
    }

    // Ensure topic is a string
    const topicStr = typeof topic === 'string' ? topic : topic.toString();

    // Record the topic with viral intelligence patterns + template info
    await recordGeneratedTopic(userId, topicStr, {
        hook: topHook,
        emotion: topEmotion,
        structure: topStructure,
        source,
        platform,
        templateId: templateResult?.templateId || null,
        usedVariables: templateResult?.usedVariables || {},
        viralScore: viralData?.recommendation?.examples?.[0]?.viralScore || null,
        channelAvg: viralData?.avgViews || null
    });

    console.log(`   ✅ Generated (${source}): "${topicStr}"`);

    return {
        topic: topicStr,
        niche,
        platform,
        patterns: {
            hook: topHook,
            emotion: topEmotion,
            structure: topStructure,
            hookData: HOOK_PATTERNS[topHook]
        },
        source,
        templateInfo: templateResult ? {
            templateId: templateResult.templateId,
            usedVariables: templateResult.usedVariables
        } : null,
        analytics: {
            topHook: bestPatterns.hooks[0],
            topStructure: bestPatterns.structures[0],
            recentCount: recentTopics.length,
            channelAvg
        },
        viralIntelligence: viralData ? {
            avgViews: viralData.avgViews,
            outlierCount: viralData.outlierCount,
            recommendation: viralData.recommendation,
            topOutlier: viralData.outliers?.[0]?.title,
            topVideos: viralData.topVideos?.slice(0, 10) || []
        } : null
    };
};

/**
 * Get full recommendation with context
 */
export const getTopicRecommendation = async (userId, niche = 'general', platform = 'youtube') => {
    const result = await generateSmartTopic(userId, niche, true, null, platform);

    const patterns = await getBestPatterns(userId, platform);
    return {
        recommendedTopic: result.topic,
        niche: result.niche,
        whyThisWorks: `Uses "${result.patterns.hook}" hook pattern which averages ${result.analytics.topHook?.avgViews || 'N/A'} views`,
        patterns: result.patterns,
        avoid: patterns.avoid.map(a => a.title)
    };
};

export default {
    loadGeneratedTopics,
    recordGeneratedTopic,
    linkTopicToVideo,
    updateTopicPerformance,
    getTopicsNeedingPerformanceUpdate,
    isTopicDuplicate,
    getRecentTopics,
    extractPatternsFromVideos,
    getBestPatterns,
    generateSmartTopic,
    getTopicRecommendation,
    calculateViralScore,
    analyzeViralPotential,
    HOOK_PATTERNS,
    STORY_STRUCTURES
};
