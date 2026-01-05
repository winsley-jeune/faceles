-- ============================================
-- Migration: Add OAuth States Table
-- Purpose: Store OAuth state tokens for CSRF protection
-- ============================================

CREATE TABLE IF NOT EXISTS oauth_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state VARCHAR(64) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL,
    code_verifier VARCHAR(128), -- For PKCE (TikTok)
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '10 minutes'
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- Add comment for documentation
COMMENT ON TABLE oauth_states IS 'Stores OAuth state tokens for CSRF protection during login flow';
COMMENT ON COLUMN oauth_states.state IS 'Random state token sent to OAuth provider';
COMMENT ON COLUMN oauth_states.code_verifier IS 'PKCE code verifier for TikTok OAuth flow';
COMMENT ON COLUMN oauth_states.expires_at IS 'State expires after 10 minutes for security';
