import dataService from '../../services/dataService.js';

/**
 * A/B TESTING FRAMEWORK
 *
 * Systematic experimentation to identify winning patterns
 *
 * Tests:
 * 1. Variable Combinations - Which {person} + {action} + {outcome} work best
 * 2. Hook Variants - Same topic, different hooks
 * 3. Visual Style Tests - Same content, different themes/colors
 * 4. Duration Tests - Same content, different lengths
 * 5. CTA Tests - Different call-to-action styles
 *
 * Process:
 * 1. Create experiment with variants
 * 2. Assign videos to experiment groups
 * 3. Track performance per variant
 * 4. Identify statistical winners
 * 5. Promote winners to 2x weight
 */

// Minimum samples needed before declaring a winner
const MIN_SAMPLES_FOR_SIGNIFICANCE = 5;

// Minimum performance difference to declare winner (20%)
const MIN_IMPROVEMENT_THRESHOLD = 0.20;

/**
 * Load A/B test data for user
 */
const loadABTests = async (userId) => {
    try {
        const data = await dataService.abTesting.getABTests(userId);
        if (data) return data;
    } catch (err) {
        console.error('Failed to load A/B tests:', err.message);
    }
    return {
        experiments: [],
        completedExperiments: [],
        winningPatterns: [],
        lastUpdated: null
    };
};

/**
 * Save A/B test data for user
 */
const saveABTests = async (userId, data) => {
    data.lastUpdated = new Date().toISOString();
    try {
        await dataService.abTesting.saveABTests(userId, data);
    } catch (err) {
        console.error('Failed to save A/B tests:', err.message);
    }
};

/**
 * Create a new A/B test experiment
 */
export const createExperiment = async (userId, config) => {
    const {
        name,
        type, // 'hook', 'variable', 'visual', 'duration', 'cta'
        platform,
        niche,
        variants, // Array of variant definitions
        targetSamples = 10 // Samples needed per variant
    } = config;

    const data = await loadABTests(userId);

    const experiment = {
        id: `exp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name,
        type,
        platform,
        niche,
        variants: variants.map((v, i) => ({
            id: `var_${i}`,
            name: v.name,
            config: v.config,
            samples: 0,
            totalViews: 0,
            totalRetention: 0,
            avgViews: 0,
            avgRetention: 0,
            viralHits: 0, // Videos with 3x+ average views
            videos: []
        })),
        targetSamples,
        status: 'active',
        createdAt: new Date().toISOString(),
        winner: null
    };

    data.experiments.push(experiment);
    await saveABTests(userId, data);

    console.log(`📊 Created A/B experiment: ${name}`);
    console.log(`   Variants: ${variants.map(v => v.name).join(' vs ')}`);

    return experiment;
};

/**
 * Get the next variant to use (even distribution)
 */
export const getNextVariant = async (userId, experimentId) => {
    const data = await loadABTests(userId);
    const exp = data.experiments.find(e => e.id === experimentId);

    if (!exp || exp.status !== 'active') {
        return null;
    }

    // Find variant with fewest samples
    const sortedVariants = [...exp.variants].sort((a, b) => a.samples - b.samples);
    return sortedVariants[0];
};

/**
 * Assign a video to an experiment variant
 */
export const assignToExperiment = async (userId, experimentId, videoId, variantId) => {
    const data = await loadABTests(userId);
    const exp = data.experiments.find(e => e.id === experimentId);

    if (!exp) {
        return { success: false, error: 'Experiment not found' };
    }

    const variant = exp.variants.find(v => v.id === variantId);
    if (!variant) {
        return { success: false, error: 'Variant not found' };
    }

    variant.samples++;
    variant.videos.push({
        videoId,
        assignedAt: new Date().toISOString(),
        views: 0,
        retention: 0,
        status: 'pending'
    });

    await saveABTests(userId, data);

    return {
        success: true,
        experiment: exp.name,
        variant: variant.name,
        totalSamples: variant.samples
    };
};

/**
 * Record results for a video in an experiment
 */
export const recordExperimentResult = async (userId, experimentId, videoId, results) => {
    const data = await loadABTests(userId);
    const exp = data.experiments.find(e => e.id === experimentId);

    if (!exp) {
        return { success: false, error: 'Experiment not found' };
    }

    const {
        views = 0,
        retention = 0,
        avgChannelViews = 1000 // For calculating if it's a viral hit
    } = results;

    // Find which variant this video belongs to
    for (const variant of exp.variants) {
        const video = variant.videos.find(v => v.videoId === videoId);
        if (video) {
            video.views = views;
            video.retention = retention;
            video.status = 'completed';

            // Update variant aggregates
            variant.totalViews += views;
            variant.totalRetention += retention;
            variant.avgViews = variant.totalViews / variant.videos.filter(v => v.status === 'completed').length;
            variant.avgRetention = variant.totalRetention / variant.videos.filter(v => v.status === 'completed').length;

            // Check if viral hit
            if (views >= avgChannelViews * 3) {
                variant.viralHits++;
            }

            await saveABTests(userId, data);

            // Check if experiment can be concluded
            await checkExperimentCompletion(userId, experimentId);

            return { success: true, variant: variant.name };
        }
    }

    return { success: false, error: 'Video not found in experiment' };
};

/**
 * Check if experiment has enough data to conclude
 */
const checkExperimentCompletion = async (userId, experimentId) => {
    const data = await loadABTests(userId);
    const exp = data.experiments.find(e => e.id === experimentId);

    if (!exp || exp.status !== 'active') {
        return;
    }

    // Check if all variants have enough samples
    const allComplete = exp.variants.every(v =>
        v.videos.filter(video => video.status === 'completed').length >= exp.targetSamples
    );

    if (!allComplete) {
        return;
    }

    // All variants have enough data - determine winner
    const sortedVariants = [...exp.variants].sort((a, b) => {
        // Primary: Average views
        // Secondary: Retention
        const viewScore = b.avgViews - a.avgViews;
        if (Math.abs(viewScore) > 100) return viewScore;
        return b.avgRetention - a.avgRetention;
    });

    const best = sortedVariants[0];
    const secondBest = sortedVariants[1];

    // Calculate improvement percentage
    const improvement = secondBest.avgViews > 0
        ? (best.avgViews - secondBest.avgViews) / secondBest.avgViews
        : 1;

    // Check if winner is significant
    if (improvement >= MIN_IMPROVEMENT_THRESHOLD) {
        exp.winner = {
            variantId: best.id,
            variantName: best.name,
            improvement: (improvement * 100).toFixed(1) + '%',
            avgViews: best.avgViews,
            avgRetention: best.avgRetention,
            viralHits: best.viralHits
        };
        exp.status = 'completed';

        // Add to winning patterns
        data.winningPatterns.push({
            type: exp.type,
            platform: exp.platform,
            niche: exp.niche,
            winner: best.name,
            config: best.config,
            improvement: improvement,
            completedAt: new Date().toISOString()
        });

        // Move to completed
        data.completedExperiments.push(exp);
        data.experiments = data.experiments.filter(e => e.id !== experimentId);

        console.log(`🏆 A/B Test Winner: ${best.name} (+${(improvement * 100).toFixed(1)}%)`);
    } else {
        // No clear winner
        exp.status = 'inconclusive';
        exp.conclusion = 'No statistically significant difference between variants';

        data.completedExperiments.push(exp);
        data.experiments = data.experiments.filter(e => e.id !== experimentId);
    }

    await saveABTests(userId, data);
};

/**
 * Get active experiments for a platform/niche
 */
export const getActiveExperiments = async (userId, platform = null, niche = null) => {
    const data = await loadABTests(userId);

    let experiments = data.experiments.filter(e => e.status === 'active');

    if (platform) {
        experiments = experiments.filter(e => e.platform === platform);
    }
    if (niche) {
        experiments = experiments.filter(e => e.niche === niche || e.niche === 'all');
    }

    return experiments;
};

/**
 * Get winning patterns for a type
 */
export const getWinningPatterns = async (userId, type = null, platform = null) => {
    const data = await loadABTests(userId);

    let patterns = data.winningPatterns;

    if (type) {
        patterns = patterns.filter(p => p.type === type);
    }
    if (platform) {
        patterns = patterns.filter(p => p.platform === platform);
    }

    return patterns.sort((a, b) => b.improvement - a.improvement);
};

/**
 * Auto-create hook variant experiment
 */
export const createHookExperiment = async (userId, platform, niche, hooks) => {
    return await createExperiment(userId, {
        name: `Hook Test: ${niche} on ${platform}`,
        type: 'hook',
        platform,
        niche,
        variants: hooks.map(h => ({
            name: h.name,
            config: { hookType: h.name, ...h }
        })),
        targetSamples: MIN_SAMPLES_FOR_SIGNIFICANCE
    });
};

/**
 * Auto-create visual theme experiment
 */
export const createVisualExperiment = async (userId, platform, themes) => {
    return await createExperiment(userId, {
        name: `Visual Theme Test on ${platform}`,
        type: 'visual',
        platform,
        niche: 'all',
        variants: themes.map(t => ({
            name: t,
            config: { visualTheme: t }
        })),
        targetSamples: MIN_SAMPLES_FOR_SIGNIFICANCE
    });
};

/**
 * Auto-create duration experiment
 */
export const createDurationExperiment = async (userId, platform, durations) => {
    return await createExperiment(userId, {
        name: `Duration Test on ${platform}`,
        type: 'duration',
        platform,
        niche: 'all',
        variants: durations.map(d => ({
            name: `${d}s`,
            config: { targetDuration: d }
        })),
        targetSamples: MIN_SAMPLES_FOR_SIGNIFICANCE
    });
};

/**
 * Get experiment summary
 */
export const getExperimentSummary = async (userId) => {
    const data = await loadABTests(userId);

    return {
        active: data.experiments.length,
        completed: data.completedExperiments.length,
        winningPatterns: data.winningPatterns.length,
        experiments: data.experiments.map(e => ({
            id: e.id,
            name: e.name,
            type: e.type,
            platform: e.platform,
            progress: Math.min(100, Math.round(
                e.variants.reduce((sum, v) => sum + v.samples, 0) /
                (e.variants.length * e.targetSamples) * 100
            )) + '%'
        })),
        recentWinners: data.winningPatterns.slice(-5).reverse()
    };
};

/**
 * Apply winning patterns to selection weights
 */
export const applyWinningPatterns = async (userId, performanceWeights) => {
    const data = await loadABTests(userId);

    data.winningPatterns.forEach(pattern => {
        if (pattern.type === 'hook' && pattern.config?.hookType) {
            // Boost winning hook by 2x
            try {
                performanceWeights.boostItem(
                    pattern.config.hookType,
                    pattern.platform,
                    'hooks',
                    2.0 // 2x weight
                );
                console.log(`   📈 Applied A/B winner boost: ${pattern.config.hookType} (+100%)`);
            } catch (e) {
                // Non-critical
            }
        }

        if (pattern.type === 'visual' && pattern.config?.visualTheme) {
            try {
                performanceWeights.boostItem(
                    pattern.config.visualTheme,
                    pattern.platform,
                    'themes',
                    1.5 // 1.5x weight
                );
            } catch (e) {
                // Non-critical
            }
        }
    });
};

export default {
    createExperiment,
    getNextVariant,
    assignToExperiment,
    recordExperimentResult,
    getActiveExperiments,
    getWinningPatterns,
    createHookExperiment,
    createVisualExperiment,
    createDurationExperiment,
    getExperimentSummary,
    applyWinningPatterns
};
