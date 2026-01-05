/**
 * Training Controller
 * ML dataset management for video performance learning
 * Collects and exports training data for future AI improvements
 */
import trainingData from '../modules/analytics/training_data.js';
import youtubeAnalytics from '../modules/analytics/youtube_analytics.js';

const trainingController = {
    getStats: async (req, res) => {
        const userId = req.user.id;
        const stats = await trainingData.getDatasetStats(userId);
        res.json(stats);
    },

    getSamples: async (req, res) => {
        const userId = req.user.id;
        const { limit = 50, offset = 0 } = req.query;
        const samples = await trainingData.loadAllSamples(userId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        res.json({
            total: samples.length,
            offset: parseInt(offset),
            limit: parseInt(limit),
            samples
        });
    },

    getSampleById: async (req, res) => {
        const userId = req.user.id;
        const { sampleId } = req.params;
        const samples = await trainingData.loadAllSamples(userId);
        const sample = samples.find(s => s.sampleId === sampleId);
        if (sample) {
            res.json(sample);
        } else {
            res.status(404).json({ error: "Sample not found" });
        }
    },

    updatePerformance: async (req, res) => {
        const userId = req.user.id;
        const { sampleId } = req.params;
        const { platform, performance } = req.body;

        if (!platform || !performance) {
            return res.status(400).json({ error: "platform and performance are required" });
        }

        const updated = await trainingData.updatePerformance(userId, sampleId, platform, performance);
        if (updated) {
            res.json({ success: true, message: `Performance updated for ${platform}` });
        } else {
            res.status(404).json({ error: "Sample not found" });
        }
    },

    exportCSV: async (req, res) => {
        const userId = req.user.id;
        const csvContent = await trainingData.exportToCSV(userId);
        if (csvContent) {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="training_data.csv"');
            res.send(csvContent);
        } else {
            res.status(404).json({ error: "No training data to export" });
        }
    },

    exportEmbeddings: async (req, res) => {
        const userId = req.user.id;
        const embeddingData = await trainingData.exportForEmbeddings(userId);
        if (embeddingData && embeddingData.length > 0) {
            const jsonlContent = embeddingData.map(d => JSON.stringify(d)).join('\n');
            res.setHeader('Content-Type', 'application/jsonl');
            res.setHeader('Content-Disposition', 'attachment; filename="texts_for_embedding.jsonl"');
            res.send(jsonlContent);
        } else {
            res.status(404).json({ error: "No training data to export" });
        }
    },

    exportJSONL: async (req, res) => {
        const userId = req.user.id;
        const samples = await trainingData.loadAllSamples(userId);
        if (samples.length === 0) {
            return res.status(404).json({ error: "No training data to export" });
        }
        res.setHeader('Content-Type', 'application/jsonl');
        res.setHeader('Content-Disposition', 'attachment; filename="video_training_data.jsonl"');
        res.send(samples.map(s => JSON.stringify(s)).join('\n'));
    },

    getLabeled: async (req, res) => {
        const userId = req.user.id;
        const samples = await trainingData.loadAllSamples(userId);
        const labeled = samples.filter(s =>
            s.performance?.youtube || s.performance?.tiktok ||
            s.performance?.facebook || s.performance?.instagram
        );
        res.json({
            total: labeled.length,
            unlabeled: samples.length - labeled.length,
            samples: labeled
        });
    },

    syncAnalytics: async (req, res) => {
        const userId = req.user.id;
        console.log(`📊 [User: ${userId}] Syncing analytics to training data...`);

        const samples = await trainingData.loadAllSamples(userId);
        let updated = 0;

        for (const sample of samples) {
            if (sample.platformVariants?.youtube?.videoId && !sample.performance?.youtube) {
                try {
                    const ytStats = await youtubeAnalytics.getVideoStats([sample.platformVariants.youtube.videoId]);
                    if (ytStats?.length > 0) {
                        const score = youtubeAnalytics.calculateMinimaxScore?.(ytStats[0]) || { score: 0, label: 'UNKNOWN' };
                        await trainingData.updatePerformance(userId, sample.sampleId, 'youtube', {
                            ...ytStats[0],
                            ...score
                        });
                        updated++;
                    }
                } catch (e) {
                    // Skip if can't fetch
                }
            }
        }

        res.json({
            success: true,
            message: `Synced ${updated} samples with analytics data`,
            totalSamples: samples.length,
            updated
        });
    }
};

export default trainingController;
