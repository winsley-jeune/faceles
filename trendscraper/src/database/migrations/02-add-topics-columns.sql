-- ============================================
-- Migration: Add missing columns to topics table
-- Date: 2025-12-28
-- Description: Adds hook, script, visual_style, voice_style,
--              parent_topic_id, performance_score, metadata, and updated_at
-- ============================================

-- Add missing columns to topics table
ALTER TABLE topics
ADD COLUMN IF NOT EXISTS hook TEXT,
ADD COLUMN IF NOT EXISTS script TEXT,
ADD COLUMN IF NOT EXISTS visual_style VARCHAR(100),
ADD COLUMN IF NOT EXISTS voice_style VARCHAR(100),
ADD COLUMN IF NOT EXISTS parent_topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS performance_score DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create trigger for updated_at
CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON topics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create index on parent_topic_id for faster queries
CREATE INDEX IF NOT EXISTS idx_topics_parent ON topics(parent_topic_id);
