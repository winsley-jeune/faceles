import dataService from '../../services/dataService.js';

/**
 * Content Configuration Manager
 * Stores and manages AI-learned recommendations for content generation
 * Multi-tenant with database storage
 */

// Default config when starting fresh
const DEFAULT_CONFIG = {
    version: 1,
    lastUpdated: null,

    // Hook optimization
    hooks: {
        style: "Start with a shocking statement or unexpected outcome",
        patterns: [
            "I did [unexpected action] and [surprising result]",
            "[Shocking statement]... here's what happened",
            "Everyone said [common belief], but [opposite happened]"
        ],
        avoidPatterns: [
            "In this video...",
            "Today we'll talk about...",
            "Did you know that..."
        ],
        firstThreeSeconds: "Must create immediate curiosity or shock"
    },

    // Topic guidance
    topics: {
        focus: [],           // Topics that performed well
        avoid: [],           // Topics that underperformed
        suggested: [],       // AI-suggested new topics to try
        niches: {
            preferred: [],   // Niches with best performance
            testing: [],     // Niches currently being tested
            avoid: []        // Niches that don't work
        }
    },

    // Title optimization
    titles: {
        patterns: [],        // Patterns that work
        keywords: [],        // High-performing keywords
        avoidKeywords: [],   // Words that hurt performance
        maxLength: 70,
        useNumbers: true,
        useEmojis: false     // Based on data
    },

    // Content style
    contentStyle: {
        tone: "storytelling",         // narrative, educational, shocking, etc.
        pacing: "fast",               // fast, medium, slow
        emotionalHook: true,
        useCliffhangers: true,
        callToAction: "subtle"        // none, subtle, direct
    },

    // Posting strategy
    posting: {
        optimalTimes: [],             // Best posting times
        frequency: "2-3 per day",
        bestDays: []
    },

    // Performance benchmarks (updated from data)
    benchmarks: {
        targetViews: 1000,
        targetLikes: 50,
        targetWatchTime: 70,          // percentage
        currentAvgViews: 0
    },

    // VISUAL OPTIMIZATION (Hook frame / thumbnail)
    visuals: {
        hook: {
            // These get applied to the FIRST image (hook frame)
            colorScheme: "high-contrast, vibrant, saturated colors",
            composition: "single clear focal point, uncluttered background",
            style: "dramatic lighting, cinematic, eye-catching",
            elements: [
                "expressive face or reaction",
                "bold visual contrast",
                "sense of action or tension"
            ],
            avoid: [
                "cluttered scenes",
                "low contrast",
                "multiple competing focal points",
                "small text",
                "dark muddy colors"
            ],
            enhancementPrompt: "THUMBNAIL-OPTIMIZED: ultra eye-catching, high contrast, vibrant colors, single clear focal point, dramatic lighting, scroll-stopping visual"
        },
        body: {
            // Regular scene images
            style: "clean, professional, consistent with hook",
            maintain: "visual continuity with hook frame"
        },
        cta: {
            // Call-to-action final frame
            style: "engaging, inviting, clear message"
        }
    },

    // Learning history
    learningHistory: []               // Track what was learned and when
};

/**
 * Load current content config
 * @param {string} userId - User ID
 */
export const loadContentConfig = async (userId) => {
    try {
        const config = await dataService.contentConfig.get(userId);
        if (config) {
            return { ...DEFAULT_CONFIG, ...config };
        }
    } catch (error) {
        console.log('   ⚠️ Could not load content config, using defaults');
    }
    return DEFAULT_CONFIG;
};

/**
 * Save content config
 * @param {string} userId - User ID
 * @param {object} config - Config data
 */
export const saveContentConfig = async (userId, config) => {
    try {
        await dataService.contentConfig.save(userId, config);
        console.log('   💾 Content config saved');
        return config;
    } catch (error) {
        console.error('Error saving content config:', error.message);
        return config;
    }
};

/**
 * Update config from weekly analysis
 * @param {string} userId - User ID
 * @param {object} analysis - Analysis data
 */
export const updateFromAnalysis = async (userId, analysis) => {
    const config = await loadContentConfig(userId);

    console.log('   🔄 Updating content config from analysis...');

    // Update topics
    if (analysis.contentRecommendations) {
        const rec = analysis.contentRecommendations;

        // Merge with existing, avoiding duplicates
        config.topics.focus = [...new Set([
            ...config.topics.focus,
            ...(rec.topicsToDoubleDown || [])
        ])].slice(-10); // Keep last 10

        config.topics.avoid = [...new Set([
            ...config.topics.avoid,
            ...(rec.topicsToAvoid || [])
        ])].slice(-10);

        config.topics.suggested = rec.newTopicsToTest || [];
    }

    // Update hooks from technical recommendations
    if (analysis.technicalRecommendations) {
        const tech = analysis.technicalRecommendations;

        if (tech.hooks) {
            config.hooks.style = tech.hooks;
        }
        if (tech.titles) {
            config.titles.guidance = tech.titles;
        }
        if (tech.postingSchedule) {
            config.posting.guidance = tech.postingSchedule;
        }
    }

    // Update content style from what's working
    if (analysis.whatWorking && analysis.whatWorking.length > 0) {
        // Detect style from what's working
        const working = analysis.whatWorking.join(' ').toLowerCase();

        if (working.includes('narrative') || working.includes('story')) {
            config.contentStyle.tone = 'storytelling';
        }
        if (working.includes('shock') || working.includes('unexpected')) {
            config.contentStyle.emotionalHook = true;
        }
    }

    // Update benchmarks
    if (analysis.weeklyGoals) {
        // Extract target views from goals if mentioned
        const viewGoal = analysis.weeklyGoals.find(g =>
            g.toLowerCase().includes('view')
        );
        if (viewGoal) {
            const match = viewGoal.match(/(\d+)/);
            if (match) {
                config.benchmarks.targetViews = parseInt(match[1]);
            }
        }
    }

    // Store suggested videos for auto-generation
    if (analysis.suggestedVideos) {
        config.topics.suggested = analysis.suggestedVideos.map(v => ({
            topic: v.topic,
            niche: v.niche,
            reason: v.whyThisWillWork,
            addedAt: new Date().toISOString()
        }));
    }

    // Update priority focus
    if (analysis.priorityFocus) {
        config.currentPriority = analysis.priorityFocus;
    }

    // Add to learning history
    config.learningHistory.push({
        date: new Date().toISOString(),
        insights: analysis.keyInsights?.map(i => i.insight) || [],
        changes: [
            `Topics to focus: ${config.topics.focus.slice(0, 3).join(', ')}`,
            `Priority: ${config.currentPriority || 'Not set'}`
        ]
    });

    // Keep only last 10 learning entries
    if (config.learningHistory.length > 10) {
        config.learningHistory = config.learningHistory.slice(-10);
    }

    return saveContentConfig(userId, config);
};

/**
 * Get prompt enhancement for storyboard generation
 * This is what gets injected into the Gemini prompt
 * @param {string} userId - User ID
 */
export const getStoryboardEnhancement = async (userId) => {
    const config = await loadContentConfig(userId);

    let enhancement = `
CONTENT OPTIMIZATION RULES (Based on channel performance data):

HOOK STRATEGY (CRITICAL - First 3 seconds determine success):
${config.hooks.style}

Hook patterns that work:
${config.hooks.patterns.map(p => `- ${p}`).join('\n')}

Avoid these hook patterns:
${config.hooks.avoidPatterns.map(p => `- ${p}`).join('\n')}

CONTENT STYLE:
- Tone: ${config.contentStyle.tone}
- Pacing: ${config.contentStyle.pacing}
- Use emotional hooks: ${config.contentStyle.emotionalHook ? 'Yes' : 'No'}
- Use cliffhangers: ${config.contentStyle.useCliffhangers ? 'Yes' : 'No'}
`;

    if (config.topics.focus.length > 0) {
        enhancement += `
TOPICS THAT PERFORM WELL (incorporate these themes):
${config.topics.focus.map(t => `- ${t}`).join('\n')}
`;
    }

    if (config.topics.avoid.length > 0) {
        enhancement += `
TOPICS/APPROACHES TO AVOID:
${config.topics.avoid.map(t => `- ${t}`).join('\n')}
`;
    }

    if (config.currentPriority) {
        enhancement += `
CURRENT PRIORITY FOCUS:
${config.currentPriority}
`;
    }

    return enhancement;
};

/**
 * Get next suggested video to generate
 * @param {string} userId - User ID
 */
export const getNextSuggestedVideo = async (userId) => {
    const config = await loadContentConfig(userId);

    if (config.topics.suggested && config.topics.suggested.length > 0) {
        return config.topics.suggested[0];
    }
    return null;
};

/**
 * Mark a suggested video as generated
 * @param {string} userId - User ID
 * @param {string} topic - Topic to mark as generated
 */
export const markVideoGenerated = async (userId, topic) => {
    const config = await loadContentConfig(userId);

    config.topics.suggested = config.topics.suggested.filter(
        v => v.topic !== topic
    );

    await saveContentConfig(userId, config);
};

/**
 * Reset config to defaults
 * @param {string} userId - User ID
 */
export const resetConfig = async (userId) => {
    return saveContentConfig(userId, DEFAULT_CONFIG);
};

/**
 * Get visual enhancement for a specific scene type
 * This is used by visuals_pro.js to enhance image prompts
 * @param {string} userId - User ID
 * @param {string} sceneType - Scene type (hook, body, cta)
 */
export const getVisualEnhancement = async (userId, sceneType = 'body') => {
    const config = await loadContentConfig(userId);
    const visuals = config.visuals || DEFAULT_CONFIG.visuals;

    if (sceneType === 'hook') {
        const hook = visuals.hook;
        return {
            enhancement: hook.enhancementPrompt,
            colorScheme: hook.colorScheme,
            composition: hook.composition,
            style: hook.style,
            elements: hook.elements || [],
            avoid: hook.avoid || [],
            // Build full prompt addition
            promptAddition: `${hook.enhancementPrompt}, ${hook.colorScheme}, ${hook.composition}, ${hook.style}`
        };
    }

    if (sceneType === 'cta') {
        const cta = visuals.cta;
        return {
            enhancement: cta.style,
            promptAddition: `${cta.style}, clear visual message, engaging`
        };
    }

    // Default body scene
    const body = visuals.body;
    return {
        enhancement: body.style,
        promptAddition: `${body.style}, ${body.maintain}`
    };
};

/**
 * Get the hook image specific prompt enhancement
 * This creates the most eye-catching first frame possible
 * @param {string} userId - User ID
 * @param {string} basePrompt - Base prompt for the image
 */
export const getHookImagePrompt = async (userId, basePrompt) => {
    const config = await loadContentConfig(userId);
    const hookVisuals = config.visuals?.hook || DEFAULT_CONFIG.visuals.hook;

    // Build enhanced prompt for hook/thumbnail
    const avoidList = hookVisuals.avoid.join(', NO ');

    return `${basePrompt}, ${hookVisuals.enhancementPrompt}, ${hookVisuals.colorScheme}, ${hookVisuals.composition}, ${hookVisuals.style}, NO ${avoidList}`;
};

export default {
    loadContentConfig,
    saveContentConfig,
    updateFromAnalysis,
    getStoryboardEnhancement,
    getNextSuggestedVideo,
    markVideoGenerated,
    resetConfig,
    getVisualEnhancement,
    getHookImagePrompt
};
