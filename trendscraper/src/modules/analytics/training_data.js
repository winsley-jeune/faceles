/**
 * Training Data Collection Module - Database Edition
 *
 * PURPOSE: Collect comprehensive data for future ML model training
 *
 * This module captures EVERYTHING about each video:
 * - Input features (topic, niche, trending context)
 * - Production variables (script, voice, visuals, timing, music)
 * - Output labels (views, engagement, retention per platform)
 *
 * Data is stored in PostgreSQL with user isolation
 */

import dataService from '../../services/dataService.js';

/**
 * COMPREHENSIVE DATA SCHEMA
 * This captures ALL variables that could influence video performance
 */
const TRAINING_SCHEMA = {
    version: '1.0.0',

    // Unique identifier
    id: 'string',           // UUID for this training sample
    createdAt: 'timestamp', // When video was created

    // ============ INPUT FEATURES ============
    input: {
        // Topic & Niche
        topic: 'string',              // Raw topic text
        niche: 'string',              // Category (money, psychology, etc.)
        subNiche: 'string',           // Sub-category if applicable

        // Trending Context (what was happening when created)
        trendingTopics: 'array',      // Related trending topics at creation time
        seasonality: 'string',        // Time of year context
        dayOfWeek: 'number',          // 0-6
        hourOfDay: 'number',          // 0-23

        // Content Intent
        contentGoal: 'string',        // brand-awareness, lead-gen, sales, engagement
        targetAudience: 'string',     // Audience description
        emotionalTarget: 'string',    // Fear, curiosity, inspiration, etc.
    },

    // ============ SCRIPT FEATURES ============
    script: {
        fullText: 'string',           // Complete script text
        hookText: 'string',           // First scene text (critical)
        ctaText: 'string',            // Call to action text

        // Script Analysis
        wordCount: 'number',
        sentenceCount: 'number',
        avgWordsPerSentence: 'number',

        // Hook Analysis
        hookStyle: 'string',          // curiosity, shock, question, statistic, etc.
        hookWordCount: 'number',
        hasNumber: 'boolean',         // Contains number in hook
        hasQuestion: 'boolean',       // Hook is a question

        // Emotional Markers
        urgencyWords: 'number',       // Count of urgent language
        exclusivityWords: 'number',   // "secret", "nobody knows", etc.
        negativeWords: 'number',
        positiveWords: 'number',

        // Structural Features
        sceneCount: 'number',
        avgSceneDuration: 'number',
        totalDuration: 'number',
    },

    // ============ VISUAL FEATURES ============
    visuals: {
        theme: 'string',              // dark_cinematic, cyber_neon, etc.
        colorPalette: 'string',       // Primary colors used
        style: 'string',              // 3D isometric, realistic, cartoon, etc.

        // Per-scene visual data
        scenes: [{
            index: 'number',
            sceneType: 'string',      // hook, body, cta
            imagePrompt: 'string',    // The prompt used
            duration: 'number',
            hasText: 'boolean',       // Text overlay in image
            hasEmoji: 'boolean',
            dominantColor: 'string',
        }],

        // Thumbnail/Hook Frame
        hookImagePrompt: 'string',
        hookHasContrast: 'boolean',   // High contrast (attention-grabbing)
        hookHasFace: 'boolean',       // Contains face/person
    },

    // ============ AUDIO FEATURES ============
    audio: {
        voicePreset: 'string',        // dramatic, urgent, female_calm, etc.
        voiceGender: 'string',        // male, female
        voiceId: 'string',            // ElevenLabs voice ID

        // Voice Settings
        stability: 'number',
        similarityBoost: 'number',
        style: 'number',

        // Speech Analysis
        wordsPerMinute: 'number',     // Speaking pace
        avgPauseDuration: 'number',   // Pause length

        // Background Music
        hasBGM: 'boolean',
        bgmTrack: 'string',           // Track identifier
        bgmMood: 'string',            // suspense, upbeat, dramatic
        bgmVolume: 'number',          // 0-1
    },

    // ============ TIMING FEATURES ============
    timing: {
        totalDuration: 'number',      // Total video length in seconds
        hookDuration: 'number',       // First 3 seconds

        // Pacing
        fastestScene: 'number',       // Shortest scene duration
        slowestScene: 'number',       // Longest scene duration
        paceVariation: 'number',      // Standard deviation of scene durations

        // Publishing
        publishHour: 'number',        // Hour of day published (0-23)
        publishDayOfWeek: 'number',   // 0-6
        publishTimezone: 'string',
    },

    // ============ PLATFORM-SPECIFIC PRODUCTION ============
    platformVariants: {
        youtube: {
            title: 'string',
            description: 'string',
            tags: 'array',
            hashtags: 'array',
        },
        tiktok: {
            caption: 'string',
            hashtags: 'array',
            sounds: 'array',
        },
        facebook: {
            caption: 'string',
            hashtags: 'array',
        },
        instagram: {
            caption: 'string',
            hashtags: 'array',
        }
    },

    // ============ OUTPUT LABELS (Performance) ============
    // These are updated AFTER video is posted
    performance: {
        youtube: {
            views: 'number',
            likes: 'number',
            comments: 'number',
            shares: 'number',
            watchTimeSeconds: 'number',
            avgViewDuration: 'number',
            avgViewPercentage: 'number',
            impressions: 'number',
            ctr: 'number',              // Click-through rate
            subscribersGained: 'number',

            // Retention curve (if available)
            retentionAt25: 'number',    // % still watching at 25%
            retentionAt50: 'number',
            retentionAt75: 'number',
            retentionAt100: 'number',

            // Calculated scores
            score: 'number',            // Our MINIMAX score
            label: 'string',            // VIRAL, GOOD, AVERAGE, POOR, FLOP
        },
        tiktok: {
            views: 'number',
            likes: 'number',
            comments: 'number',
            shares: 'number',
            saves: 'number',
            avgWatchTime: 'number',
            fullVideoWatches: 'number',
            profileVisits: 'number',
            followsFromVideo: 'number',

            // Velocity metrics
            viewsFirstHour: 'number',
            viewsFirst24h: 'number',

            score: 'number',
            label: 'string',
        },
        facebook: {
            views: 'number',
            reactions: 'number',
            comments: 'number',
            shares: 'number',
            reach: 'number',
            impressions: 'number',

            score: 'number',
            label: 'string',
        },
        instagram: {
            views: 'number',
            likes: 'number',
            comments: 'number',
            saves: 'number',
            shares: 'number',
            reach: 'number',
            impressions: 'number',
            profileVisits: 'number',
            followsFromPost: 'number',

            // Audience breakdown
            followerReach: 'number',
            nonFollowerReach: 'number',

            score: 'number',
            label: 'string',
        },

        // Cross-platform aggregated
        crossPlatform: {
            totalViews: 'number',
            totalEngagement: 'number',
            bestPlatform: 'string',
            universalScore: 'number',
        }
    },

    // ============ META FIELDS ============
    meta: {
        version: 'string',            // Schema version
        generatedBy: 'string',        // Model/method that created the video
        experimentGroup: 'string',    // A/B test group if applicable
        isManualOverride: 'boolean',  // Was human involved in editing
        notes: 'string',              // Any manual notes
    }
};

/**
 * Generate unique ID for training sample
 */
const generateId = () => {
    return `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Initialize training data (legacy compatibility - now no-op)
 * Database initialization is handled by database module
 */
export const initTrainingData = async (userId) => {
    // Database is auto-initialized, this is for backwards compatibility
    return { status: 'database_ready' };
};

/**
 * Create a new training sample when video is generated
 * Called during video creation to capture all production variables
 *
 * @param {string} userId - User ID (required for multi-tenant isolation)
 * @param {object} data - Video production data
 */
export const createTrainingSample = async (userId, data) => {
    const sampleId = generateId();

    const sampleData = {
        sampleId,
        // Input features
        input: {
            topic: data.topic || '',
            niche: data.niche || 'general',
            subNiche: data.subNiche || '',
            trendingTopics: data.trendingTopics || [],
            seasonality: getSeasonality(),
            dayOfWeek: new Date().getDay(),
            hourOfDay: new Date().getHours(),
            contentGoal: data.contentGoal || 'brand-awareness',
            targetAudience: data.targetAudience || '',
            emotionalTarget: data.emotionalTarget || 'curiosity',
        },

        // Script features
        script: analyzeScript(data.storyboard || []),

        // Visual features
        visuals: analyzeVisuals(data.storyboard || [], data.visualTheme),

        // Audio features
        audio: {
            voicePreset: data.voicePreset || 'dramatic',
            voiceGender: data.voiceGender || 'male',
            voiceId: data.voiceId || '',
            stability: data.voiceSettings?.stability || 0.5,
            similarityBoost: data.voiceSettings?.similarityBoost || 0.75,
            style: data.voiceSettings?.style || 0.5,
            wordsPerMinute: calculateWPM(data.storyboard),
            avgPauseDuration: 0.3,
            hasBGM: data.hasBGM || false,
            bgmTrack: data.bgmTrack || '',
            bgmMood: data.bgmMood || '',
            bgmVolume: data.bgmVolume || 0.15,
        },

        // Timing features
        timing: analyzeTiming(data.storyboard || []),

        // Platform variants (to be filled during posting)
        platformVariants: {
            youtube: data.youtube || {},
            tiktok: data.tiktok || {},
            facebook: data.facebook || {},
            instagram: data.instagram || {},
        },

        // Performance (to be updated later)
        performance: {
            youtube: null,
            tiktok: null,
            facebook: null,
            instagram: null,
            crossPlatform: null,
        },

        // Meta
        meta: {
            version: TRAINING_SCHEMA.version,
            generatedBy: data.generatedBy || 'gemini-2.0-flash',
            experimentGroup: data.experimentGroup || 'default',
            isManualOverride: data.isManualOverride || false,
            notes: data.notes || '',
        }
    };

    // Save to database
    const sample = await dataService.training.createSample(userId, sampleData);

    console.log(`📊 [User: ${userId}] Training sample created: ${sampleId}`);

    return sample;
};

/**
 * Update performance data for a training sample
 * Called when analytics data becomes available
 *
 * @param {string} userId - User ID (required)
 * @param {string} sampleId - Sample ID
 * @param {string} platform - Platform name
 * @param {object} performanceData - Performance metrics
 */
export const updatePerformance = async (userId, sampleId, platform, performanceData) => {
    const updated = await dataService.training.updatePerformance(userId, sampleId, platform, performanceData);

    if (updated) {
        console.log(`📊 [User: ${userId}] Performance updated for ${sampleId} on ${platform}`);
    }

    return updated;
};

/**
 * Load all training samples for user
 *
 * @param {string} userId - User ID (required)
 * @param {object} options - Query options (limit, offset, orderBy, orderDir)
 */
export const loadAllSamples = async (userId, options = {}) => {
    return dataService.training.getAllSamples(userId, options);
};

/**
 * Export training data to CSV for ML pipelines
 *
 * @param {string} userId - User ID (required)
 * @param {string} outputPath - Output file path (optional)
 */
export const exportToCSV = async (userId, outputPath = null) => {
    const samples = await dataService.training.getAllSamples(userId);

    if (samples.length === 0) {
        console.log(`📊 [User: ${userId}] No training data to export`);
        return null;
    }

    // Flatten the nested structure for CSV
    const flattenedData = samples.map(s => ({
        id: s.sampleId,
        created_at: s.createdAt,

        // Input features
        topic: s.input?.topic,
        niche: s.input?.niche,
        day_of_week: s.input?.dayOfWeek,
        hour_of_day: s.input?.hourOfDay,
        content_goal: s.input?.contentGoal,

        // Script features
        word_count: s.script?.wordCount,
        hook_style: s.script?.hookStyle,
        hook_has_number: s.script?.hasNumber ? 1 : 0,
        hook_has_question: s.script?.hasQuestion ? 1 : 0,
        urgency_words: s.script?.urgencyWords,
        total_duration: s.script?.totalDuration,
        scene_count: s.script?.sceneCount,

        // Audio features
        voice_preset: s.audio?.voicePreset,
        voice_gender: s.audio?.voiceGender,
        has_bgm: s.audio?.hasBGM ? 1 : 0,

        // Visual features
        visual_theme: s.visuals?.theme,
        hook_has_contrast: s.visuals?.hookHasContrast ? 1 : 0,
        hook_has_face: s.visuals?.hookHasFace ? 1 : 0,

        // Performance labels
        yt_views: s.performance?.youtube?.views,
        yt_score: s.performance?.youtube?.score,
        yt_label: s.performance?.youtube?.label,

        tt_views: s.performance?.tiktok?.views,
        tt_score: s.performance?.tiktok?.score,
        tt_label: s.performance?.tiktok?.label,

        fb_views: s.performance?.facebook?.views,
        fb_score: s.performance?.facebook?.score,

        ig_views: s.performance?.instagram?.views,
        ig_score: s.performance?.instagram?.score,

        universal_score: s.performance?.crossPlatform?.universalScore,
        total_views: s.performance?.crossPlatform?.totalViews,
        best_platform: s.performance?.crossPlatform?.bestPlatform,
    }));

    // Generate CSV
    const headers = Object.keys(flattenedData[0]);
    const csvContent = [
        headers.join(','),
        ...flattenedData.map(row => headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
            return val;
        }).join(','))
    ].join('\n');

    console.log(`📊 [User: ${userId}] Exported ${flattenedData.length} samples to CSV`);

    return csvContent;
};

/**
 * Export text fields for embedding generation
 * These can be fed to OpenAI/Cohere/etc for vector embeddings
 *
 * @param {string} userId - User ID (required)
 */
export const exportForEmbeddings = async (userId) => {
    const samples = await dataService.training.getAllSamples(userId);

    const embeddingData = samples.map(s => ({
        id: s.sampleId,
        // Combined text for embedding
        text: `Topic: ${s.input?.topic || ''}. Hook: ${s.script?.hookText || ''}. Full script: ${s.script?.fullText || ''}`,
        // Separate fields for different embedding strategies
        topic: s.input?.topic,
        hook: s.script?.hookText,
        script: s.script?.fullText,
        // Labels for supervised learning
        labels: {
            yt_score: s.performance?.youtube?.score,
            tt_score: s.performance?.tiktok?.score,
            fb_score: s.performance?.facebook?.score,
            ig_score: s.performance?.instagram?.score,
            universal_score: s.performance?.crossPlatform?.universalScore,
        }
    }));

    console.log(`📊 [User: ${userId}] Exported ${embeddingData.length} samples for embeddings`);

    return embeddingData;
};

/**
 * Get statistics about collected training data
 *
 * @param {string} userId - User ID (required)
 */
export const getDatasetStats = async (userId) => {
    const samples = await dataService.training.getAllSamples(userId);

    const stats = {
        totalSamples: samples.length,
        samplesWithPerformance: samples.filter(s => s.performance?.crossPlatform).length,

        byNiche: {},
        byHookStyle: {},
        byVoice: {},
        byTheme: {},

        performanceDistribution: {
            viral: 0,
            good: 0,
            average: 0,
            poor: 0,
            flop: 0,
        },

        avgScores: {
            youtube: 0,
            tiktok: 0,
            facebook: 0,
            instagram: 0,
        }
    };

    samples.forEach(s => {
        // Count by niche
        const niche = s.input?.niche || 'unknown';
        stats.byNiche[niche] = (stats.byNiche[niche] || 0) + 1;

        // Count by hook style
        const hookStyle = s.script?.hookStyle || 'unknown';
        stats.byHookStyle[hookStyle] = (stats.byHookStyle[hookStyle] || 0) + 1;

        // Count by voice
        const voice = s.audio?.voicePreset || 'unknown';
        stats.byVoice[voice] = (stats.byVoice[voice] || 0) + 1;

        // Count by theme
        const theme = s.visuals?.theme || 'unknown';
        stats.byTheme[theme] = (stats.byTheme[theme] || 0) + 1;

        // Performance distribution
        ['youtube', 'tiktok', 'facebook', 'instagram'].forEach(platform => {
            const label = s.performance?.[platform]?.label?.toLowerCase();
            if (label && stats.performanceDistribution[label] !== undefined) {
                stats.performanceDistribution[label]++;
            }
        });
    });

    return stats;
};

// ============================================
// HELPER FUNCTIONS (unchanged logic)
// ============================================

/**
 * Analyze script for training features
 */
const analyzeScript = (storyboard) => {
    if (!storyboard || storyboard.length === 0) {
        return {};
    }

    const fullText = storyboard.map(s => s.text).join(' ');
    const hookText = storyboard[0]?.text || '';
    const ctaText = storyboard[storyboard.length - 1]?.text || '';

    const sentences = fullText.split(/[.!?]+/).filter(s => s.trim());
    const words = fullText.split(/\s+/).filter(w => w);

    // Urgency words
    const urgencyPatterns = /urgent|now|today|immediately|hurry|limited|last chance|don't miss|before it's too late/gi;
    const urgencyWords = (fullText.match(urgencyPatterns) || []).length;

    // Exclusivity words
    const exclusivityPatterns = /secret|nobody knows|exclusive|insider|hidden|they don't want|revealed/gi;
    const exclusivityWords = (fullText.match(exclusivityPatterns) || []).length;

    // Hook analysis
    const hookStyle = detectHookStyle(hookText);

    return {
        fullText,
        hookText,
        ctaText,
        wordCount: words.length,
        sentenceCount: sentences.length,
        avgWordsPerSentence: words.length / Math.max(1, sentences.length),
        hookStyle,
        hookWordCount: hookText.split(/\s+/).length,
        hasNumber: /\d/.test(hookText),
        hasQuestion: /\?/.test(hookText),
        urgencyWords,
        exclusivityWords,
        negativeWords: countSentiment(fullText, 'negative'),
        positiveWords: countSentiment(fullText, 'positive'),
        sceneCount: storyboard.length,
        avgSceneDuration: storyboard.reduce((sum, s) => sum + (s.duration || 6), 0) / storyboard.length,
        totalDuration: storyboard.reduce((sum, s) => sum + (s.duration || 6), 0),
    };
};

/**
 * Detect hook style from text
 */
const detectHookStyle = (text) => {
    const textLower = text.toLowerCase();

    if (/\d+%|\d+ (percent|million|billion|thousand)/.test(textLower)) return 'statistic';
    if (/\?$/.test(text.trim())) return 'question';
    if (/stop|wait|hold on|don't scroll/.test(textLower)) return 'scroll_stopper';
    if (/you won't believe|shocking|insane|crazy/.test(textLower)) return 'shock';
    if (/secret|nobody|they don't/.test(textLower)) return 'mystery';
    if (/here's how|this is how|the way to/.test(textLower)) return 'how_to';
    if (/mistake|wrong|never|avoid/.test(textLower)) return 'negative_hook';
    if (/i was|story time|true story/.test(textLower)) return 'story';

    return 'statement';
};

/**
 * Count sentiment words
 */
const countSentiment = (text, type) => {
    const patterns = {
        negative: /bad|wrong|mistake|fail|lose|problem|danger|risk|afraid|worry|hate|terrible|awful|horrible/gi,
        positive: /good|great|amazing|success|win|love|happy|best|perfect|incredible|awesome|fantastic/gi,
    };
    return (text.match(patterns[type]) || []).length;
};

/**
 * Analyze visual features
 */
const analyzeVisuals = (storyboard, theme) => {
    const scenes = storyboard.map((scene, index) => ({
        index,
        sceneType: scene.scene_type || 'body',
        imagePrompt: scene.image_prompt || '',
        duration: scene.duration || 6,
        hasText: /text|caption|title|word/i.test(scene.image_prompt || ''),
        hasEmoji: /emoji|icon|symbol/i.test(scene.image_prompt || ''),
        dominantColor: extractDominantColor(scene.image_prompt || ''),
    }));

    const hookScene = storyboard[0] || {};

    return {
        theme: theme || 'dark_cinematic',
        colorPalette: extractColorPalette(storyboard),
        style: extractStyle(storyboard),
        scenes,
        hookImagePrompt: hookScene.image_prompt || '',
        hookHasContrast: /contrast|bright|dark|bold/i.test(hookScene.image_prompt || ''),
        hookHasFace: /face|person|man|woman|human|portrait/i.test(hookScene.image_prompt || ''),
    };
};

/**
 * Extract dominant color from prompt
 */
const extractDominantColor = (prompt) => {
    const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'black', 'white', 'gold', 'silver', 'cyan', 'magenta'];
    for (const color of colors) {
        if (prompt.toLowerCase().includes(color)) return color;
    }
    return 'unknown';
};

/**
 * Extract color palette from all scenes
 */
const extractColorPalette = (storyboard) => {
    const colors = new Set();
    const allPrompts = storyboard.map(s => s.image_prompt || '').join(' ').toLowerCase();

    ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'black', 'white', 'gold', 'cyan', 'neon'].forEach(color => {
        if (allPrompts.includes(color)) colors.add(color);
    });

    return Array.from(colors).join(', ');
};

/**
 * Extract visual style from prompts
 */
const extractStyle = (storyboard) => {
    const allPrompts = storyboard.map(s => s.image_prompt || '').join(' ').toLowerCase();

    if (allPrompts.includes('3d') || allPrompts.includes('isometric')) return '3d_isometric';
    if (allPrompts.includes('realistic') || allPrompts.includes('photo')) return 'realistic';
    if (allPrompts.includes('cartoon') || allPrompts.includes('anime')) return 'cartoon';
    if (allPrompts.includes('cinematic')) return 'cinematic';
    if (allPrompts.includes('minimal')) return 'minimalist';

    return 'mixed';
};

/**
 * Analyze timing features
 */
const analyzeTiming = (storyboard) => {
    const durations = storyboard.map(s => s.duration || 6);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
        totalDuration,
        hookDuration: durations[0] || 6,
        fastestScene: Math.min(...durations),
        slowestScene: Math.max(...durations),
        paceVariation: calculateStdDev(durations),
        publishHour: new Date().getHours(),
        publishDayOfWeek: new Date().getDay(),
        publishTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
};

/**
 * Calculate standard deviation
 */
const calculateStdDev = (arr) => {
    const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
    const squaredDiffs = arr.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / arr.length);
};

/**
 * Calculate words per minute from storyboard
 */
const calculateWPM = (storyboard) => {
    if (!storyboard || storyboard.length === 0) return 150;

    const totalWords = storyboard.reduce((sum, s) => sum + (s.text?.split(/\s+/).length || 0), 0);
    const totalSeconds = storyboard.reduce((sum, s) => sum + (s.duration || 6), 0);

    return Math.round((totalWords / totalSeconds) * 60);
};

/**
 * Get seasonality string
 */
const getSeasonality = () => {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
};

export default {
    initTrainingData,
    createTrainingSample,
    updatePerformance,
    loadAllSamples,
    exportToCSV,
    exportForEmbeddings,
    getDatasetStats,
    TRAINING_SCHEMA,
};
