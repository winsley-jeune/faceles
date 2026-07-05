/**
 * Two-tenant isolation suite (permanent regression guard).
 *
 * Proves the multi-tenant data layer keeps each user's data separate and that
 * userId is a required boundary. Runs against the real Postgres (no mocks).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initDatabase } from '../database/index.js';
import { query } from '../database/db.js';
import ds from '../services/dataService.js';

const A = '00000000-0000-0000-0000-000000000000';
const B = '11111111-1111-1111-1111-111111111111';

beforeAll(async () => {
    await initDatabase();
    // Seed both tenants (idempotent)
    await query(
        "INSERT INTO users (id, email, name) VALUES ($1, 'system@faceles.local', 'System') ON CONFLICT (id) DO NOTHING",
        [A]
    );
    await query(
        "INSERT INTO users (id, email, name) VALUES ($1, 'tenantB@faceles.local', 'Tenant B') ON CONFLICT (id) DO NOTHING",
        [B]
    );
});

describe('multi-tenant isolation', () => {
    it('keeps per-user viral intelligence isolated', async () => {
        await ds.viralIntelligence.saveViralIntelligence(A, { winningPatterns: ['A-only'] });
        await ds.viralIntelligence.saveViralIntelligence(B, { winningPatterns: ['B-only'] });

        const viA = await ds.viralIntelligence.getViralIntelligence(A);
        const viB = await ds.viralIntelligence.getViralIntelligence(B);

        expect(viA.winningPatterns).toContain('A-only');
        expect(JSON.stringify(viA)).not.toContain('B-only');
        expect(viB.winningPatterns).toContain('B-only');
        expect(JSON.stringify(viB)).not.toContain('A-only');
    });

    it('keeps per-user emotion cache isolated', async () => {
        await ds.viralIntelligence.saveEmotionCache(A, { titleA: 'joy' });
        await ds.viralIntelligence.saveEmotionCache(B, { titleB: 'anger' });

        const ecA = await ds.viralIntelligence.getEmotionCache(A);
        const ecB = await ds.viralIntelligence.getEmotionCache(B);

        expect(ecA.titleA).toBe('joy');
        expect(ecA.titleB).toBeUndefined();
        expect(ecB.titleB).toBe('anger');
        expect(ecB.titleA).toBeUndefined();
    });

    it('enforces userId as a required boundary (rejects unscoped access)', async () => {
        await expect(ds.viralIntelligence.getViralIntelligence()).rejects.toThrow(/userId is required/);
        await expect(ds.analytics.getAnalyticsByPlatform(undefined, 'youtube')).rejects.toThrow(/userId is required/);
    });
});
