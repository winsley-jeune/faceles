import { v4 as uuidv4 } from 'uuid';
import jobRepository from '../database/repositories/jobRepository.js';
import logger from '../utils/logger.js';
import { isDatabaseAvailable } from '../database/db.js';

// Import generation modules (will be used in pipeline execution)
import { generateNicheStoryboard } from '../modules/storyboard.js';
import { generateProImages } from '../modules/visuals_pro.js';
import { generateSmartVoice } from '../modules/voice_pro.js';
import { renderVideo } from '../modules/renderer.js';
import { alignSubtitlesToAudio } from '../modules/subtitle_sync.js';

/**
 * Job Queue Service
 * Manages background video generation jobs with worker pool
 * Features: concurrent workers, progress tracking, cancellation support
 */
class JobQueueService {
    constructor(maxWorkers = 3) {
        this.maxWorkers = maxWorkers;
        this.activeJobs = new Map(); // jobId → { workerId, abortController, promise }
        this.pollingInterval = null;
        this.isRunning = false;
        this.POLL_INTERVAL = 5000; // Poll every 5 seconds
    }

    /**
     * Start the job queue service
     * Begins polling for queued jobs
     */
    start() {
        if (this.isRunning) {
            logger.warn('Job queue service is already running');
            return;
        }

        this.isRunning = true;
        logger.info(`Job queue service started with ${this.maxWorkers} workers`);

        // Start polling for jobs
        this.pollingInterval = setInterval(() => {
            this.processQueue();
        }, this.POLL_INTERVAL);

        // Process immediately on start
        this.processQueue();
    }

    /**
     * Stop the job queue service
     * Aborts all active jobs and stops polling
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        logger.info('Stopping job queue service...');

        // Stop polling
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        // Abort all active jobs
        for (const [jobId, { abortController }] of this.activeJobs) {
            logger.info(`Aborting job ${jobId} due to shutdown`);
            abortController.abort();
        }

        this.activeJobs.clear();
        logger.info('Job queue service stopped');
    }

    /**
     * Process the job queue
     * Fetches queued jobs and dispatches to available workers
     */
    async processQueue() {
        if (!this.isRunning) {
            return;
        }

        // Check if database is available
        if (!isDatabaseAvailable()) {
            logger.warn('Database not available, skipping job queue processing');
            return;
        }

        try {
            // Calculate available worker slots
            const availableSlots = this.maxWorkers - this.activeJobs.size;

            if (availableSlots <= 0) {
                // All workers busy
                return;
            }

            // Fetch queued jobs
            const queuedJobs = await jobRepository.getQueuedJobs(availableSlots);

            if (queuedJobs.length === 0) {
                // No jobs to process
                return;
            }

            logger.info(`Found ${queuedJobs.length} queued jobs, ${availableSlots} workers available`);

            // Dispatch each job to a worker
            for (const job of queuedJobs) {
                this.executeJob(job);
            }
        } catch (error) {
            logger.error('Error processing job queue:', error);
        }
    }

    /**
     * Execute a job
     * @param {Object} job - Job to execute
     */
    async executeJob(job) {
        const workerId = `worker-${uuidv4().substring(0, 8)}`;
        const abortController = new AbortController();

        logger.info(`Worker ${workerId} starting job ${job.id} (type: ${job.job_type})`);

        // Claim the job (atomic operation)
        try {
            const claimedJob = await jobRepository.claimJob(job.id, workerId);
            if (!claimedJob) {
                logger.warn(`Job ${job.id} already claimed by another worker`);
                return;
            }
        } catch (error) {
            logger.error(`Failed to claim job ${job.id}:`, error);
            return;
        }

        // Track active job
        const jobPromise = this.runGenerationPipeline(job, abortController.signal, workerId)
            .then(async (result) => {
                // Job completed successfully
                await jobRepository.updateStatus(job.id, 'completed', { result });
                logger.info(`Job ${job.id} completed successfully by worker ${workerId}`);
            })
            .catch(async (error) => {
                // Check if job was cancelled
                if (error.message === 'Job cancelled' || abortController.signal.aborted) {
                    logger.info(`Job ${job.id} was cancelled`);
                    // Status already updated to 'cancelled' by cancelJob()
                    return;
                }

                // Job failed
                logger.error(`Job ${job.id} failed:`, error);
                await jobRepository.updateStatus(job.id, 'failed', {
                    errorMessage: error.message,
                    errorStack: error.stack
                });

                // Check if we should retry
                await jobRepository.incrementAttempts(job.id);
                const updatedJob = await jobRepository.getJobById(job.id);

                if (updatedJob.attempts < updatedJob.max_attempts) {
                    logger.info(`Job ${job.id} will be retried (attempt ${updatedJob.attempts}/${updatedJob.max_attempts})`);
                    // Reset to queued for retry
                    await jobRepository.updateStatus(job.id, 'queued', {});
                }
            })
            .finally(() => {
                // Remove from active jobs
                this.activeJobs.delete(job.id);
            });

        this.activeJobs.set(job.id, { workerId, abortController, promise: jobPromise });
    }

    /**
     * Run the video generation pipeline
     * @param {Object} job - Job to execute
     * @param {AbortSignal} signal - Abort signal for cancellation
     * @param {string} workerId - Worker ID
     * @returns {Promise<Object>} Generation result
     */
    async runGenerationPipeline(job, signal, workerId) {
        const { input_params: params, job_type: jobType } = job;

        // Create progress callback
        const progressCallback = async (step, percentage, message, details = {}) => {
            if (signal.aborted) {
                throw new Error('Job cancelled');
            }

            await jobRepository.updateProgress(job.id, {
                currentStep: step,
                progressPercentage: percentage,
                progressMessage: message,
                stepDetails: details
            });

            logger.info(`Job ${job.id} progress: ${step} (${percentage}%) - ${message}`);
        };

        // Execute pipeline based on job type
        switch (jobType) {
            case 'smart_video':
                return await this.executeSmartVideoGeneration(params, signal, progressCallback);

            case 'batch':
                return await this.executeBatchGeneration(params, signal, progressCallback);

            case 'variation':
                return await this.executeVariationGeneration(params, signal, progressCallback);

            case 'auto_variation':
                return await this.executeAutoVariation(params, signal, progressCallback);

            default:
                throw new Error(`Unknown job type: ${jobType}`);
        }
    }

    /**
     * Execute smart video generation pipeline
     * @param {Object} params - Generation parameters
     * @param {AbortSignal} signal - Abort signal
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<Object>} Generation result
     */
    async executeSmartVideoGeneration(params, signal, progressCallback) {
        const { niche, topic, platforms, autoPost } = params;

        // Import required modules dynamically to avoid circular dependencies
        const { analyzeAndGenerateTopic } = await import('../modules/analytics/smart_topic_generator.js');
        const { getMusicByEnergy } = await import('../modules/audio_pro.js');
        const { uploadToMultiplePlatforms } = await import('../modules/unified_uploader.js');

        let finalTopic = topic;
        let storyboard;
        let images;
        let voicePath;
        let musicPath;
        let subtitles;
        let videoPath;
        let uploadResults = {};

        try {
            // Step 1: Topic Generation (if not provided)
            if (!finalTopic) {
                await progressCallback('topic_generation', 5, 'Analyzing winning patterns and generating viral topic...');
                if (signal.aborted) throw new Error('Job cancelled');

                const topicResult = await analyzeAndGenerateTopic(niche);
                finalTopic = topicResult.recommendedTopic;
            }

            // Step 2: Storyboard Generation
            await progressCallback('storyboard', 15, 'Writing viral script with AI...', { topic: finalTopic });
            if (signal.aborted) throw new Error('Job cancelled');

            const scenes = await generateNicheStoryboard(niche, finalTopic, {}, platforms[0] || 'youtube', null);

            // Validate storyboard structure
            if (!scenes || !Array.isArray(scenes)) {
                throw new Error('Failed to generate valid storyboard: expected array of scenes');
            }

            if (scenes.length === 0) {
                throw new Error('Storyboard generation returned no scenes');
            }

            // Wrap scenes in storyboard object for consistency
            storyboard = {
                scenes,
                emotion: 'inspiring', // Default emotion, can be enhanced later
                niche,
                topic: finalTopic
            };

            // Step 3: Image Generation (heaviest step)
            await progressCallback('images', 20, `Generating ${scenes.length} stunning visuals...`);
            if (signal.aborted) throw new Error('Job cancelled');

            const imagePrompts = scenes.map(scene => scene.visualDescription);
            images = await generateProImages(imagePrompts, {
                signal,
                onProgress: (current, total) => {
                    const imageProgress = 20 + ((current / total) * 35); // 20% to 55%
                    progressCallback('images', imageProgress, `Generating images... (${current}/${total})`);
                }
            });

            // Step 4: Voice Generation
            await progressCallback('voice', 60, 'Recording AI voiceover...');
            if (signal.aborted) throw new Error('Job cancelled');

            const fullScript = scenes.map(s => s.narration).join(' ');
            voicePath = await generateSmartVoice(fullScript, '/app/videos', { signal, progressCallback });

            // Step 5: Music Selection
            await progressCallback('music', 70, 'Selecting perfect background music...');
            if (signal.aborted) throw new Error('Job cancelled');

            const emotion = storyboard.emotion || 'inspiring';
            // Map emotion -> energy level for music selection (fixes the undefined
            // selectMusicByEmotion that crashed every job — audit C2).
            const emotionToEnergy = {
                shock: 'high', anger: 'high', excitement: 'high', fear: 'high', outrage: 'high',
                hope: 'medium', inspiring: 'medium', curiosity: 'medium',
                calm: 'low', sadness: 'low'
            };
            musicPath = await getMusicByEnergy(emotionToEnergy[emotion] || 'medium', '/app/videos');

            // Step 6: Subtitle Alignment
            await progressCallback('subtitles', 75, 'Syncing subtitles to voiceover...');
            if (signal.aborted) throw new Error('Job cancelled');

            subtitles = await alignSubtitlesToAudio(voicePath, scenes, { signal, progressCallback });

            // Step 7: Video Rendering
            await progressCallback('rendering', 80, 'Composing video with effects and transitions...');
            if (signal.aborted) throw new Error('Job cancelled');

            videoPath = await renderVideo({
                images,
                voicePath,
                musicPath,
                subtitles,
                storyboard
            }, { signal, progressCallback });

            // Step 8: Upload (if autoPost enabled)
            if (autoPost) {
                await progressCallback('upload', 90, `Uploading to ${platforms.join(', ')}...`);
                if (signal.aborted) throw new Error('Job cancelled');

                uploadResults = await uploadToMultiplePlatforms(videoPath, {
                    platforms,
                    topic: finalTopic,
                    niche,
                    storyboard
                });
            }

            await progressCallback('completed', 100, 'Video generation complete!');

            return {
                videoPath,
                topic: finalTopic,
                storyboard,
                uploadResults,
                platforms,
                niche
            };

        } catch (error) {
            logger.error('Error in smart video generation pipeline:', error);
            throw error;
        }
    }

    /**
     * Execute batch generation (for A/B testing variations)
     * @param {Object} params - Generation parameters
     * @param {AbortSignal} signal - Abort signal
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<Object>} Generation result
     */
    async executeBatchGeneration(params, signal, progressCallback) {
        // Import batch generation module
        const { generateVariations } = await import('../modules/analytics/variation_engine.js');

        await progressCallback('batch_generation', 10, 'Generating topic variations...');
        if (signal.aborted) throw new Error('Job cancelled');

        const variations = await generateVariations(params);

        await progressCallback('completed', 100, `Generated ${variations.length} variations`);

        return { variations };
    }

    /**
     * Execute variation generation (from existing variation queue)
     * @param {Object} params - Generation parameters
     * @param {AbortSignal} signal - Abort signal
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<Object>} Generation result
     */
    async executeVariationGeneration(params, signal, progressCallback) {
        const { variationId, niche, platforms } = params;

        // Load variation from queue
        const { loadVariationQueue } = await import('../utils/dataAccess.js');
        const queue = await loadVariationQueue();
        const variation = queue.variations.find(v => v.id === variationId);

        if (!variation) {
            throw new Error(`Variation ${variationId} not found`);
        }

        // Generate video using variation topic
        return await this.executeSmartVideoGeneration({
            niche,
            topic: variation.title,
            platforms,
            autoPost: true
        }, signal, progressCallback);
    }

    /**
     * Execute auto-scheduler variation generation
     * This is the same as executeSmartVideoGeneration but also updates variation engine status
     * @param {Object} params - Generation parameters
     * @param {AbortSignal} signal - Abort signal
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<Object>} Generation result
     */
    async executeAutoVariation(params, signal, progressCallback) {
        const { niche, topic, variationId, tone, emotion, platforms, autoPost } = params;

        // Import variation engine to update status
        const variationEngine = await import('../modules/analytics/variation_engine.js').then(m => m.default);
        const youtubeAPI = await import('../modules/uploaders/youtube_api_uploader.js').then(m => m.default);
        const tiktokAPI = await import('../modules/uploaders/tiktok_api_uploader.js').then(m => m.default);
        const facebookAPI = await import('../modules/uploaders/facebook_api_uploader.js').then(m => m.default);
        const { generateAllPlatformsContent } = await import('../modules/social_content.js');

        try {
            await progressCallback('initialization', 5, 'Starting auto-variation generation...');

            // Execute the same generation pipeline as smart_video
            const result = await this.executeSmartVideoGeneration({
                niche,
                topic,
                platforms,
                autoPost: false // We'll handle posting manually to update variation status
            }, signal, progressCallback);

            // Update variation status to 'generated'
            if (variationId) {
                variationEngine.updateVariationStatus(variationId, 'generated', {
                    videoPath: result.videoPath,
                    generatedAt: new Date().toISOString()
                });
            }

            // If autoPost is true, upload to platforms
            if (autoPost && result.videoPath) {
                await progressCallback('uploading', 90, 'Uploading to platforms...');

                const metadata = await generateAllPlatformsContent(topic, niche);
                const postResults = {};

                for (const platform of platforms) {
                    logger.info(`   📤 Auto-uploading to ${platform}...`);

                    let postResult = null;
                    try {
                        if (platform === 'youtube') {
                            postResult = await youtubeAPI.uploadToYouTubeAPI(result.videoPath, {
                                title: metadata.youtube.title,
                                description: metadata.youtube.description,
                                hashtags: metadata.youtube.hashtags,
                                tags: metadata.youtube.keywords || [],
                                categoryId: '22'
                            });
                        } else if (platform === 'tiktok') {
                            postResult = await tiktokAPI.uploadToTikTokAPI(result.videoPath, {
                                title: metadata.tiktok.title,
                                hashtags: metadata.tiktok.hashtags
                            });
                        } else if (platform === 'facebook') {
                            postResult = await facebookAPI.uploadToFacebookAPI(result.videoPath, {
                                title: metadata.facebook.title,
                                description: metadata.facebook.description
                            });
                        }

                        postResults[platform] = postResult;

                        if (postResult?.success) {
                            logger.info(`   ✅ ${platform.toUpperCase()}: Posted successfully`);
                        } else {
                            logger.error(`   ❌ ${platform.toUpperCase()}: ${postResult?.error || 'Upload failed'}`);
                        }
                    } catch (err) {
                        logger.error(`   ❌ ${platform.toUpperCase()}: ${err.message}`);
                        postResults[platform] = { success: false, error: err.message };
                    }
                }

                // Update variation status to 'posted' if any platform succeeded
                const anySuccess = Object.values(postResults).some(r => r?.success);
                if (anySuccess && variationId) {
                    variationEngine.updateVariationStatus(variationId, 'posted', {
                        postedAt: new Date().toISOString(),
                        platforms,
                        postResults
                    });

                    const successPlatforms = Object.entries(postResults)
                        .filter(([_, r]) => r?.success)
                        .map(([p]) => p)
                        .join(', ');

                    logger.info(`   ✅ AUTO-POST SUCCESS: "${topic}" to ${successPlatforms}`);
                }

                result.postResults = postResults;
            }

            await progressCallback('completed', 100, 'Auto-variation completed!');

            return result;

        } catch (error) {
            // Update variation status to failed if it exists
            if (variationId) {
                variationEngine.updateVariationStatus(variationId, 'failed', {
                    error: error.message,
                    failedAt: new Date().toISOString()
                });
            }
            throw error;
        }
    }

    /**
     * Cancel a job
     * @param {string} jobId - Job ID to cancel
     * @returns {Promise<boolean>} True if cancelled, false if not found
     */
    async cancelJob(jobId) {
        const activeJob = this.activeJobs.get(jobId);

        if (activeJob) {
            logger.info(`Cancelling active job ${jobId}`);
            activeJob.abortController.abort();
            this.activeJobs.delete(jobId);
        }

        // Update job status in database
        try {
            await jobRepository.cancelJob(jobId);
            return true;
        } catch (error) {
            logger.error(`Error cancelling job ${jobId}:`, error);
            return false;
        }
    }

    /**
     * Get service status
     * @returns {Object} Service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            maxWorkers: this.maxWorkers,
            activeJobs: this.activeJobs.size,
            availableWorkers: this.maxWorkers - this.activeJobs.size,
            activeJobIds: Array.from(this.activeJobs.keys())
        };
    }
}

// Create singleton instance
const jobQueueService = new JobQueueService(
    parseInt(process.env.MAX_CONCURRENT_JOBS) || 3
);

export default jobQueueService;
