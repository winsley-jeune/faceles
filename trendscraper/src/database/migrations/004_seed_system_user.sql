-- Seed the default "system" user referenced by SYSTEM_USER_ID
-- (00000000-0000-0000-0000-000000000000). System/default-scoped operations
-- (settings KV, background jobs, analytics) reference this user via FK, so it
-- must exist. Idempotent.
INSERT INTO users (id, email, name)
VALUES ('00000000-0000-0000-0000-000000000000', 'system@faceles.local', 'System')
ON CONFLICT (id) DO NOTHING;
