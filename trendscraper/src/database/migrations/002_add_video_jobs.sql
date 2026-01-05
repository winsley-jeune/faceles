-- Migration: Add video_jobs table for background job queue system
-- Created: 2025-12-23
-- Purpose: Enable asynchronous video generation with progress tracking and user isolation

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create video_jobs table
CREATE TABLE IF NOT EXISTS video_jobs (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Job classification
    job_type VARCHAR(50) NOT NULL, -- 'smart_video', 'batch', 'variation', 'promo', 'training', 'product'
    status VARCHAR(50) NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed', 'cancelled'
    priority INTEGER DEFAULT 0, -- Higher number = higher priority (0-100 range)

    -- Input parameters (stored as JSONB for flexibility)
    input_params JSONB NOT NULL, -- {niche, topic, platforms, autoPost, etc}

    -- Progress tracking
    current_step VARCHAR(50), -- 'topic_generation', 'storyboard', 'images', 'voice', 'music', 'subtitles', 'rendering', 'upload'
    total_steps INTEGER DEFAULT 8,
    completed_steps INTEGER DEFAULT 0,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00, -- 0.00 to 100.00
    progress_message TEXT, -- Human-readable status message
    step_details JSONB DEFAULT '{}', -- Detailed progress per step

    -- Results and errors
    result JSONB, -- {videoPath, filename, metadata, uploadResults}
    error_message TEXT,
    error_stack TEXT, -- Full error stack for debugging

    -- Timing information
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    estimated_completion TIMESTAMP WITH TIME ZONE, -- Calculated based on average job duration

    -- Worker tracking
    worker_id VARCHAR(100), -- ID of worker currently processing this job

    -- Retry logic
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_user_status ON video_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_queued_at ON video_jobs(queued_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_video_jobs_priority ON video_jobs(priority DESC, queued_at ASC) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_video_jobs_worker ON video_jobs(worker_id) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_video_jobs_user_created ON video_jobs(user_id, created_at DESC);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_video_jobs_updated_at ON video_jobs;
CREATE TRIGGER update_video_jobs_updated_at
    BEFORE UPDATE ON video_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE video_jobs IS 'Background job queue for asynchronous video generation with progress tracking and user isolation';
COMMENT ON COLUMN video_jobs.job_type IS 'Type of video generation job: smart_video, batch, variation, promo, training, product';
COMMENT ON COLUMN video_jobs.status IS 'Current job status: queued, processing, completed, failed, cancelled';
COMMENT ON COLUMN video_jobs.priority IS 'Job priority (0-100), higher values processed first';
COMMENT ON COLUMN video_jobs.input_params IS 'JSONB containing all job parameters (niche, topic, platforms, etc)';
COMMENT ON COLUMN video_jobs.progress_percentage IS 'Overall job progress from 0.00 to 100.00';
COMMENT ON COLUMN video_jobs.current_step IS 'Current pipeline step being executed';
COMMENT ON COLUMN video_jobs.step_details IS 'JSONB containing detailed progress information for each pipeline step';
COMMENT ON COLUMN video_jobs.worker_id IS 'ID of worker currently processing this job (for distributed processing)';
