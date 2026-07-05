/**
 * Job Controller
 * Handles HTTP requests for video generation job management
 * All operations are user-scoped for security and isolation
 */

import jobRepository from '../database/repositories/jobRepository.js';
import jobQueueService from '../services/jobQueueService.js';
import logger from '../utils/logger.js';

/**
 * Create a new video generation job
 * POST /jobs
 */
export const createJob = async (req, res) => {
    const userId = req.user.id;
    const { jobType, niche, topic, platforms, autoPost, priority } = req.body;

    // Validate required fields
    if (!jobType) {
        return res.status(400).json({
            success: false,
            error: 'jobType is required (smart_video, batch, variation, etc)'
        });
    }

    try {
        // Create job in database
        const job = await jobRepository.createJob({
            userId,
            jobType,
            inputParams: {
                niche: niche || 'general',
                topic,
                platforms: platforms || ['youtube'],
                autoPost: autoPost !== false // Default to true
            },
            priority: priority || 0
        });

        logger.info(`Job ${job.id} created by user ${userId || 'anonymous'}`);

        res.json({
            success: true,
            jobId: job.id,
            status: job.status,
            message: 'Video generation job created. Poll GET /jobs/:id for progress.'
        });
    } catch (error) {
        logger.error('Error creating job:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create job',
            details: error.message
        });
    }
};

/**
 * Get job status and progress
 * GET /jobs/:id
 */
export const getJob = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Get job (enforces ownership if userId provided)
        const job = await jobRepository.getJobById(id, userId);

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found or access denied'
            });
        }

        res.json({
            success: true,
            job: {
                id: job.id,
                jobType: job.job_type,
                status: job.status,
                progress: {
                    currentStep: job.current_step,
                    percentage: parseFloat(job.progress_percentage),
                    message: job.progress_message,
                    completedSteps: job.completed_steps,
                    totalSteps: job.total_steps,
                    stepDetails: job.step_details
                },
                result: job.result,
                error: job.error_message,
                timing: {
                    queuedAt: job.queued_at,
                    startedAt: job.started_at,
                    completedAt: job.completed_at,
                    cancelledAt: job.cancelled_at
                },
                inputParams: job.input_params,
                attempts: job.attempts,
                maxAttempts: job.max_attempts
            }
        });
    } catch (error) {
        logger.error(`Error getting job ${id}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get job status',
            details: error.message
        });
    }
};

/**
 * List user's jobs
 * GET /jobs?status=queued&limit=50&offset=0
 */
export const listJobs = async (req, res) => {
    const userId = req.user?.id;
    const { status, limit, offset } = req.query;

    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required to list jobs'
        });
    }

    try {
        const jobs = await jobRepository.getUserJobs(userId, {
            status,
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0
        });

        // Transform jobs for client
        const transformedJobs = jobs.map(job => ({
            id: job.id,
            jobType: job.job_type,
            status: job.status,
            progress: {
                currentStep: job.current_step,
                percentage: parseFloat(job.progress_percentage),
                message: job.progress_message
            },
            result: job.result,
            error: job.error_message,
            createdAt: job.created_at,
            startedAt: job.started_at,
            completedAt: job.completed_at,
            inputParams: job.input_params
        }));

        res.json({
            success: true,
            jobs: transformedJobs,
            count: transformedJobs.length
        });
    } catch (error) {
        logger.error(`Error listing jobs for user ${userId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to list jobs',
            details: error.message
        });
    }
};

/**
 * Cancel a job
 * POST /jobs/:id/cancel
 */
export const cancelJob = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Cancel in job queue service (aborts if running)
        await jobQueueService.cancelJob(id);

        // Cancel in database (enforces ownership)
        const job = await jobRepository.cancelJob(id, userId);

        logger.info(`Job ${id} cancelled by user ${userId || 'anonymous'}`);

        res.json({
            success: true,
            message: 'Job cancelled successfully',
            job: {
                id: job.id,
                status: job.status,
                cancelledAt: job.cancelled_at
            }
        });
    } catch (error) {
        logger.error(`Error cancelling job ${id}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel job',
            details: error.message
        });
    }
};

/**
 * Get user's job statistics
 * GET /jobs/stats
 */
export const getStats = async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required to view stats'
        });
    }

    try {
        const stats = await jobRepository.getUserJobStats(userId);

        res.json({
            success: true,
            stats: {
                total: parseInt(stats.total),
                queued: parseInt(stats.queued),
                processing: parseInt(stats.processing),
                completed: parseInt(stats.completed),
                failed: parseInt(stats.failed),
                cancelled: parseInt(stats.cancelled)
            }
        });
    } catch (error) {
        logger.error(`Error getting stats for user ${userId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get job statistics',
            details: error.message
        });
    }
};

/**
 * Get global queue statistics (admin only)
 * GET /jobs/queue/stats
 */
export const getQueueStats = async (req, res) => {
    try {
        const stats = await jobRepository.getQueueStats();
        const serviceStatus = jobQueueService.getStatus();

        res.json({
            success: true,
            queue: {
                total: parseInt(stats.total),
                queued: parseInt(stats.queued),
                processing: parseInt(stats.processing),
                completed: parseInt(stats.completed),
                failed: parseInt(stats.failed),
                cancelled: parseInt(stats.cancelled),
                avgDurationSeconds: parseFloat(stats.avg_duration_seconds) || 0
            },
            service: {
                isRunning: serviceStatus.isRunning,
                maxWorkers: serviceStatus.maxWorkers,
                activeJobs: serviceStatus.activeJobs,
                availableWorkers: serviceStatus.availableWorkers
            }
        });
    } catch (error) {
        logger.error('Error getting queue stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get queue statistics',
            details: error.message
        });
    }
};

export default {
    createJob,
    getJob,
    listJobs,
    cancelJob,
    getStats,
    getQueueStats
};
