import { query } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

/**
 * Job Repository
 * Handles all database operations for the video_jobs table
 * Enforces user isolation - users can only access their own jobs
 */

/**
 * Create a new job
 * @param {Object} data - Job data
 * @param {string} data.userId - User ID (required for user isolation)
 * @param {string} data.jobType - Type of job (smart_video, batch, variation, etc)
 * @param {Object} data.inputParams - Job input parameters
 * @param {number} [data.priority=0] - Job priority (higher = processed first)
 * @returns {Promise<Object>} Created job
 */
export async function createJob(data) {
    const { userId, jobType, inputParams, priority = 0 } = data;

    const queryText = `
        INSERT INTO video_jobs (
            id, user_id, job_type, input_params, priority, status
        ) VALUES ($1, $2, $3, $4, $5, 'queued')
        RETURNING *
    `;

    const jobId = uuidv4();
    const values = [
        jobId,
        userId || null,
        jobType,
        JSON.stringify(inputParams),
        priority
    ];

    try {
        const result = await query(queryText, values);
        logger.info(`Job created: ${jobId} (type: ${jobType}, user: ${userId || 'anonymous'})`);
        return result.rows[0];
    } catch (error) {
        logger.error('Error creating job:', error);
        throw error;
    }
}

/**
 * Get job by ID (enforces user ownership)
 * @param {string} id - Job ID
 * @param {string} [userId] - User ID (if provided, checks ownership)
 * @returns {Promise<Object|null>} Job or null if not found/not owned
 */
export async function getJobById(id, userId = null) {
    let queryText = 'SELECT * FROM video_jobs WHERE id = $1';
    const values = [id];

    // If userId provided, enforce ownership
    if (userId) {
        queryText += ' AND user_id = $2';
        values.push(userId);
    }

    try {
        const result = await query(queryText, values);
        return result.rows[0] || null;
    } catch (error) {
        logger.error(`Error getting job ${id}:`, error);
        throw error;
    }
}

/**
 * Update job progress
 * @param {string} id - Job ID
 * @param {Object} progressData - Progress data
 * @param {string} [progressData.currentStep] - Current pipeline step
 * @param {number} [progressData.progressPercentage] - Progress percentage (0-100)
 * @param {string} [progressData.progressMessage] - Human-readable progress message
 * @param {Object} [progressData.stepDetails] - Detailed step information
 * @param {number} [progressData.completedSteps] - Number of completed steps
 * @returns {Promise<Object>} Updated job
 */
export async function updateProgress(id, progressData) {
    const {
        currentStep,
        progressPercentage,
        progressMessage,
        stepDetails,
        completedSteps
    } = progressData;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (currentStep !== undefined) {
        updates.push(`current_step = $${paramIndex++}`);
        values.push(currentStep);
    }

    if (progressPercentage !== undefined) {
        updates.push(`progress_percentage = $${paramIndex++}`);
        values.push(progressPercentage);
    }

    if (progressMessage !== undefined) {
        updates.push(`progress_message = $${paramIndex++}`);
        values.push(progressMessage);
    }

    if (stepDetails !== undefined) {
        updates.push(`step_details = $${paramIndex++}`);
        values.push(JSON.stringify(stepDetails));
    }

    if (completedSteps !== undefined) {
        updates.push(`completed_steps = $${paramIndex++}`);
        values.push(completedSteps);
    }

    if (updates.length === 0) {
        throw new Error('No progress data provided');
    }

    values.push(id);

    const queryText = `
        UPDATE video_jobs
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `;

    try {
        const result = await query(queryText, values);
        return result.rows[0];
    } catch (error) {
        logger.error(`Error updating progress for job ${id}:`, error);
        throw error;
    }
}

/**
 * Update job status
 * @param {string} id - Job ID
 * @param {string} status - New status (completed, failed, cancelled)
 * @param {Object} [data] - Additional data
 * @param {Object} [data.result] - Job result (for completed jobs)
 * @param {string} [data.errorMessage] - Error message (for failed jobs)
 * @param {string} [data.errorStack] - Error stack trace (for failed jobs)
 * @returns {Promise<Object>} Updated job
 */
export async function updateStatus(id, status, data = {}) {
    const { result, errorMessage, errorStack } = data;

    const updates = ['status = $1'];
    const values = [status];
    let paramIndex = 1;

    // Set completion timestamp based on status
    if (status === 'completed') {
        updates.push('completed_at = CURRENT_TIMESTAMP');
        updates.push(`progress_percentage = 100`);
    } else if (status === 'cancelled') {
        updates.push('cancelled_at = CURRENT_TIMESTAMP');
    } else if (status === 'failed') {
        updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    // Add result if provided
    if (result !== undefined) {
        paramIndex++;
        updates.push(`result = $${paramIndex}`);
        values.push(JSON.stringify(result));
    }

    // Add error details if provided
    if (errorMessage !== undefined) {
        paramIndex++;
        updates.push(`error_message = $${paramIndex}`);
        values.push(errorMessage);
    }

    if (errorStack !== undefined) {
        paramIndex++;
        updates.push(`error_stack = $${paramIndex}`);
        values.push(errorStack);
    }

    // Add id as the last parameter
    paramIndex++;
    values.push(id);

    const queryText = `
        UPDATE video_jobs
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `;

    try {
        const updateResult = await query(queryText, values);
        logger.info(`Job ${id} status updated to ${status}`);
        return updateResult.rows[0];
    } catch (error) {
        logger.error(`Error updating status for job ${id}:`, error);
        throw error;
    }
}

/**
 * Cancel a job (enforces user ownership)
 * @param {string} id - Job ID
 * @param {string} [userId] - User ID (if provided, checks ownership)
 * @returns {Promise<Object>} Updated job
 */
export async function cancelJob(id, userId = null) {
    let queryText = `
        UPDATE video_jobs
        SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status IN ('queued', 'processing')
    `;
    const values = [id];

    // If userId provided, enforce ownership
    if (userId) {
        queryText += ' AND user_id = $2';
        values.push(userId);
    }

    queryText += ' RETURNING *';

    try {
        const result = await query(queryText, values);
        if (result.rows.length === 0) {
            throw new Error('Job not found, already completed, or not owned by user');
        }
        logger.info(`Job ${id} cancelled`);
        return result.rows[0];
    } catch (error) {
        logger.error(`Error cancelling job ${id}:`, error);
        throw error;
    }
}

/**
 * Get queued jobs for processing (ordered by priority, then queued time)
 * @param {number} [limit=10] - Maximum number of jobs to return
 * @returns {Promise<Array>} Array of queued jobs
 */
export async function getQueuedJobs(limit = 10) {
    const queryText = `
        SELECT * FROM video_jobs
        WHERE status = 'queued'
        ORDER BY priority DESC, created_at ASC
        LIMIT $1
    `;

    try {
        const result = await query(queryText, [limit]);
        return result.rows;
    } catch (error) {
        logger.error('Error getting queued jobs:', error);
        throw error;
    }
}

/**
 * Get user's jobs (enforces user ownership)
 * @param {string} userId - User ID
 * @param {Object} [options] - Query options
 * @param {string} [options.status] - Filter by status
 * @param {number} [options.limit=50] - Maximum number of jobs to return
 * @param {number} [options.offset=0] - Offset for pagination
 * @returns {Promise<Array>} Array of user's jobs
 */
export async function getUserJobs(userId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    let queryText = 'SELECT * FROM video_jobs WHERE user_id = $1';
    const values = [userId];
    let paramIndex = 2;

    if (status) {
        queryText += ` AND status = $${paramIndex++}`;
        values.push(status);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    values.push(limit, offset);

    try {
        const result = await query(queryText, values);
        return result.rows;
    } catch (error) {
        logger.error(`Error getting jobs for user ${userId}:`, error);
        throw error;
    }
}

/**
 * Get user's job statistics
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Job statistics
 */
export async function getUserJobStats(userId) {
    const queryText = `
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'queued') as queued,
            COUNT(*) FILTER (WHERE status = 'processing') as processing,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
        FROM video_jobs
        WHERE user_id = $1
    `;

    try {
        const result = await query(queryText, [userId]);
        return result.rows[0];
    } catch (error) {
        logger.error(`Error getting job stats for user ${userId}:`, error);
        throw error;
    }
}

/**
 * Claim a job for processing (atomic operation)
 * Sets status to 'processing', records worker_id and started_at
 * @param {string} jobId - Job ID
 * @param {string} workerId - Worker ID
 * @returns {Promise<Object|null>} Updated job or null if already claimed
 */
export async function claimJob(jobId, workerId) {
    const queryText = `
        UPDATE video_jobs
        SET
            status = 'processing',
            worker_id = $2,
            started_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'queued'
        RETURNING *
    `;

    try {
        const result = await query(queryText, [jobId, workerId]);
        if (result.rows.length > 0) {
            logger.info(`Job ${jobId} claimed by worker ${workerId}`);
            return result.rows[0];
        }
        return null;
    } catch (error) {
        logger.error(`Error claiming job ${jobId}:`, error);
        throw error;
    }
}

/**
 * Increment job attempt counter (for retry logic)
 * @param {string} id - Job ID
 * @returns {Promise<Object>} Updated job
 */
export async function incrementAttempts(id) {
    const queryText = `
        UPDATE video_jobs
        SET attempts = attempts + 1
        WHERE id = $1
        RETURNING *
    `;

    try {
        const result = await query(queryText, [id]);
        return result.rows[0];
    } catch (error) {
        logger.error(`Error incrementing attempts for job ${id}:`, error);
        throw error;
    }
}

/**
 * Get job queue statistics (global)
 * @returns {Promise<Object>} Queue statistics
 */
export async function getQueueStats() {
    const queryText = `
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'queued') as queued,
            COUNT(*) FILTER (WHERE status = 'processing') as processing,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
            AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE status = 'completed') as avg_duration_seconds
        FROM video_jobs
    `;

    try {
        const result = await query(queryText);
        return result.rows[0];
    } catch (error) {
        logger.error('Error getting queue stats:', error);
        throw error;
    }
}

export default {
    createJob,
    getJobById,
    updateProgress,
    updateStatus,
    cancelJob,
    getQueuedJobs,
    getUserJobs,
    getUserJobStats,
    claimJob,
    incrementAttempts,
    getQueueStats
};
