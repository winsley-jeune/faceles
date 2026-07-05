/**
 * Idempotent schema migration runner.
 *
 * Applies database/migrations/*.sql once each, tracked in a schema_migrations table.
 * Resilient by design: a migration that errors is ROLLED BACK, logged, and recorded
 * as failed (so it does not retry and spam every boot) rather than crashing startup.
 * This matters because several legacy migration files are known-buggy/obsolete
 * (superseded by schema.sql) — the good ones (002_video_jobs, 003_oauth_states,
 * 004_seed_system_user) must still apply cleanly.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getClient, query } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export const runMigrations = async () => {
    await query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename   TEXT PRIMARY KEY,
            success    BOOLEAN NOT NULL DEFAULT true,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    const alreadyRun = new Set(
        (await query('SELECT filename FROM schema_migrations')).rows.map(r => r.filename)
    );

    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

    let applied = 0;
    let skipped = 0;
    for (const file of files) {
        if (alreadyRun.has(file)) continue;
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        const client = await getClient();
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('COMMIT');
            await query(
                'INSERT INTO schema_migrations (filename, success) VALUES ($1, true) ON CONFLICT (filename) DO NOTHING',
                [file]
            );
            console.log(`   ✅ migration applied: ${file}`);
            applied++;
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            await query(
                'INSERT INTO schema_migrations (filename, success) VALUES ($1, false) ON CONFLICT (filename) DO NOTHING',
                [file]
            );
            console.warn(`   ⚠️ migration SKIPPED (error recorded, will not retry): ${file} — ${err.message}`);
            skipped++;
        } finally {
            client.release();
        }
    }
    console.log(`   📦 Migrations: ${applied} applied, ${skipped} skipped, ${alreadyRun.size} already present`);
};

export default runMigrations;
