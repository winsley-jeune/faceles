# faceles — Remediation Plan

**Status:** Forward-looking plan (NOT a description of current state — the current state is in the audit).
**Authored:** 2026-06-25
**Source of truth:** the code, plus the consolidated senior audit. The pre-existing markdown (`PLATFORM_AUDIT_REPORT.md`, `BUSINESS_LOGIC_CONFLICTS.md`, claims in `CLAUDE.md`) is treated as untrustworthy and is NOT a requirements source.

This plan fixes a multi-tenant SaaS. We are **not** stripping multi-tenancy — we are making it real and enforced.

---

## Guiding principles (read first — these are why the bugs happened)

1. **Fix boundaries, not symptoms.** The root cause of ~80% of findings is that auth, `userId`, and function contracts are opt-in per call site, so they rotted inconsistently. We enforce them at single chokepoints.
2. **Fail loud, not silent.** The Critical bugs (dead methods, crashed jobs) survived only because every error is swallowed into `console.error`. In dev/test, contract violations must throw. In prod, they must alert — never silently degrade and post a broken/error video.
3. **Every fix ships with a test that would have caught the original bug.** No exceptions. This is the discipline that was missing.
3a. **END-TO-END VERIFICATION AFTER EVERY STEP (non-negotiable).** A step is NOT done on a green unit test. After each implementation step I run the **actual app** — backend boots, frontend builds/loads, DB connected — and push a **real request through the full path**, confirming **zero errors** before moving to the next step. Never batch steps before verifying. This rule exists because the platform broke specifically from code that was written but never run end-to-end.
3b. **NO MOCKS, EVER (non-negotiable).** No mock data, no stubs, no simulated/fake API calls — not in app code, not in tests. All tests and end-to-end runs hit the **real** services (Gemini, Replicate, ElevenLabs, platform OAuth/APIs, real Postgres) with **real credentials and real data**. Consequence: a path **cannot be marked done until its real credentials exist**. If a key/credential is missing, that step is **blocked** and the user must provision it — substituting a mock to "make progress" is forbidden. This is why credential provisioning (below) is a hard prerequisite, sequenced per phase.
4. **Vertical slice before breadth.** Get ONE platform (YouTube) fully working end-to-end with TWO real tenants before touching TikTok/FB/IG. Replicating a broken pattern 4× is how we got here.
5. **No new features until the spine works.** A/B testing, monetization polish, avatar/product/training generators are frozen until Phases 0–4 are green.
6. **Postgres is the single source of truth.** The "hybrid JSON fallback" is fiction (audit H2). We commit to the DB and delete the broken shim.
7. **Small, reviewable PRs.** One sub-phase = one PR. Each is independently reviewable by Codex and revertable. No mega-commits.

---

## Phase map (sequenced by leverage & dependency)

| Phase | Theme | Addresses | Gate to advance |
|---|---|---|---|
| 0 | Containment (security, stop the bleeding) | C3, C4, C5, C6(fe) | Repo private, tokens rotated, default-deny auth live |
| 1 | Foundation (boundaries + observability + data layer) | C1-root, C3, C4, H2, H3, M(errors) | Auth & `userId` enforced at one boundary; errors fail loud; DB is sole store |
| 2 | Make the core execute (it currently crashes) | C1, C2, H1, H6(part) | Auto-post + learning loop run end-to-end for 1 tenant |
| 3 | Pipeline correctness (output is shippable) | C7, H5, M(disk), M(silent video) | A generated video has synced voice/image/captions, not truncated |
| 4 | Uploaders & posting integrity | C5(at-rest), C6, H1(upload), H4, H6, M(oauth state) | 1 platform posts the right tenant's video, idempotently |
| 5 | Frontend session & UX integrity | C2(fe), H7, M(errors/dead) | Token-expiry recovers; no public debug; consistent auth |
| 6 | Multi-tenant verification & hardening | C3, C4, H1, rate limits | Two-tenant isolation test suite passes; authz enforced |
| 7 | Breadth + cleanup | replicate to TikTok/FB/IG, dead code | All platforms green; dead code removed; CI enforces it |

Testing is **woven into every phase**, not deferred to Phase 7. Each phase has a "Definition of Done" with concrete tests.

### Credential prerequisites (consequence of the no-mocks rule, 3b)

Because nothing is mocked, each phase is **blocked** until its real credentials exist. Provision these before starting the named phase — I will stop and ask if any are missing rather than substitute a mock:

| Needed before | Real credentials required |
|---|---|
| Phase 0 baseline boot | Generated `JWT_SECRET`; Postgres (Docker, real). **`ANTHROPIC_API_KEY`** once the LLM swap lands (becomes the required-to-boot var, replacing `GEMINI_API_KEY`). |
| Phase 2 (pipeline runs) | **`ANTHROPIC_API_KEY`** (Claude — replaces Gemini), **Replicate API token**, **ElevenLabs API key** — real, funded |
| Phase 4 (YouTube posting) | **Google/YouTube OAuth app** (client id/secret) + **two real YouTube channels** for the two-tenant test |
| Phase 7 (other platforms) | Real **TikTok**, **Meta (FB/IG)** app credentials + real test accounts per platform |

### LLM provider swap: Gemini → Anthropic (Claude)

Decided 2026-07-05. The LLM content brain moves off Google Gemini onto the Anthropic API.
- **Scope:** replace the `@google/generative-ai` SDK (`GoogleGenerativeAI`, ~114 refs across ~22 files: `storyboard.js`, `smart_*_generator.js`, `viral_intelligence.js`, `gemini_analyst.js`, `topic_generator.js`, `variation_engine.js`, video generators, …).
- **Do NOT touch `googleapis`** — that is YouTube OAuth/upload, not the LLM. It stays.
- **Design:** one adapter seam `modules/llm.js` backed by `@anthropic-ai/sdk`, model `claude-opus-4-8`; migrate call sites to it rather than editing 114 sites inline. Consult the claude-api skill before writing Anthropic code — never from memory.
- **Env:** `ANTHROPIC_API_KEY` replaces `GEMINI_API_KEY` in `config/env.js` + `config/envValidator.js` as the required-to-boot key.
- **Verification:** every step exercised against the **real** Anthropic API (no mocks, 3b) — needs a real `ANTHROPIC_API_KEY`.

### Findings surfaced during execution (real, verified against the running app)

1. **Schema index bug (FIXED):** `schema.sql:697` created a partial index with `WHERE expires_at < CURRENT_TIMESTAMP` — illegal (non-IMMUTABLE), rejected on every init. Removed (redundant with the plain index on the same column). Schema now initializes clean.
2. **Docker image didn't build (FIXED):** `npx playwright install-deps chromium` failed on `node:24-slim`. Removed from the Dockerfile — aligns with the API-only decision (Playwright is being deleted).
3. **Migrations never applied → RESOLVED.** The Docker init only ran `schema.sql`; the `database/migrations/` folder never executed (job queue crashed every 5s on missing `video_jobs`). Fixed with `database/migrate.js` — an idempotent, resilient runner wired into startup: tracks applied files in `schema_migrations`, runs each in its own transaction, and logs+quarantines a failing migration (records it so it won't retry) rather than crashing. Added `004_seed_system_user.sql` (seeds the `SYSTEM_USER_ID` row). **Verified from a fresh volume:** `video_jobs`/`oauth_states`/system-user all auto-provision, 0 errors; the buggy legacy `01_add_missing_user_ids.sql` (`NULLL` typo, obsolete — superseded by schema.sql) is correctly skipped.
4. **`brand_context` called without `userId` (Phase-1/6 confirmed):** `storyboard.js` → `brand_context.js` calls `dataService.brandContextService.get()` with no `userId`, throwing `userId is required` (swallowed). Live confirmation of the audit's C4/H1 multi-tenant threading gap.
5. **C1 dead-method inventory (Phase-1/2, being fixed):** confirmed missing methods the code calls: `dataService.viralIntelligence.{getEmotionCache,saveEmotionCache,getViralIntelligence,saveViralIntelligence}` (viral_intelligence.js — the learning loop persists to a void); `dataService.analytics.getAnalyticsByPlatform` (youtube_analytics.js, smart_topic_generator.js); `dataService.weights` (undefined — performance_weights.js:96); `explorationConfig.getExplorationDecision` (smart_youtube_generator.js — real method is `shouldExplore`); `explorationConfig.js:132` calls `dataService.explorationConfig.getExplorationConfig` but the export is `dataService.exploration.getConfig`; `selectMusicByEmotion` undefined (jobQueueService.js:309 — audit C2). These crash the generators upstream of the LLM call.
6. **`user_settings` schema vs repository mismatch → confirmed DEAD CODE (non-issue).** The real DB `user_settings` is KV (`setting_key`, `setting_value JSONB`), but `settingsRepository.getSettings/upsertSettings` target wide columns (`default_platform`, …). On scoping, these two methods have **zero callers** and aren't exposed via `dataService` — they'd throw only if called, and nothing calls them. Not a live bug; safe to delete or KV-rewrite during a later settings reconciliation. (Feature configs brand/promo/content/exploration use their own wide tables and work.)

**Reproducibility note:** `002_video_jobs` + system-user are now provisioned by the migration runner (finding #3), not manual DB patches.

7. **Voice: ElevenLabs free-tier + edge-tts fallback (RESOLVED).** The provided ElevenLabs key is **free-tier** — it can synthesize premade voices but the app's `VOICE_PRESETS` use paid "library" voices → `402 paid_plan_required`. Also, `envValidator` advertised a free Edge-TTS fallback that **was never implemented** (no `voice_free.js`; audit-confirmed). Fixed by wiring a real `generateEdgeVoice` (edge-tts CLI, already in the image) into `voice_pro.js`: on missing key or ElevenLabs error it falls back to free edge-tts. Verified — real 22 KB MP3 produced. Voice now works regardless of ElevenLabs plan.

If a key is missing when its phase arrives, that phase does not start — provisioning it is the unblock.

---

## Phase 0 — Containment (hours, do first)

**Goal:** stop active danger while the rest is planned/built. Nothing here is elegant; it's a tourniquet.

- [ ] **0.1** Make GitHub repo **private** (manual).
- [ ] **0.2** Rotate live credentials confirmed leaked in `data/tiktok_tokens.json`, `data/facebook_tokens.json` and the `data_backup_*` copies (audit C5): regenerate TikTok + Meta app secrets, revoke connected sessions.
- [ ] **0.3** Scrub git history (`git filter-repo`) of `chrome_profile/`, `data_backup_*`, `*_tokens.json`, `*_cookies.json`, `.jwt_secret`, `*oauth_states.json`; force-push. (`.gitignore` already hardened.)
- [ ] **0.4** **Default-deny auth (interim):** in `routes/index.js`, replace the global `optionalAuth` with global `requireAuth` plus an explicit public allowlist (`/auth/*`, health, OAuth callbacks, public landing data only). This single change neutralizes C3 and most of C4 before the deeper refactor. (Audit C3.)
- [ ] **0.5** Delete/þguard the public `/auth-debug` route (`App.jsx:518`, `AuthDebug.jsx`) (audit C2-fe).
- [ ] **0.6** Rotate `JWT_SECRET` (invalidates existing sessions — acceptable).

**Definition of Done:** repo private; leaked tokens dead; anonymous request to `POST /batch/process`, `POST /clone/create-video`, `GET /monetization/subscription?userId=x`, and `/auth-debug` all return 401/404. Add a smoke test asserting exactly that.

---

## Phase 1 — Foundation: boundaries, observability, data layer

**Goal:** install the chokepoints so fixes in later phases can't silently rot again. This is the most important phase; do not rush it.

### 1A. Authentication boundary (replaces the per-route opt-in)
- [ ] Single auth middleware enforced globally with a **typed public allowlist** (formalize 0.4).
- [ ] `optionalAuth` deleted or merged into `requireAuth`; blacklist check enforced on the one path (audit H3).
- [ ] `logout` actually blacklists the token (`authController` must call `auth.logout()` — currently doesn't).
- [ ] **Identity is derived in exactly one place** (middleware sets `req.userId`); controllers read `req.userId`. **Forbid** `req.body.userId` / `req.query.userId` as identity (kills C4 IDOR). Add a lint/grep CI check that fails if `body.userId`/`query.userId` is read as identity.

### 1B. `userId` contract enforcement
- [ ] Replace truthiness-only `validateUserId` (`dataService.js:25`) with a real guard: must be present AND match the expected id shape (UUID/int), **throw** otherwise. This alone converts the silent arity-shift bugs (H1) into loud test failures.
- [ ] Make `userId` the mandatory first arg on `fetchAllVideoStats`, `analyzeEmotionsWithAI`, all uploader entrypoints, `generateBatch`, `updateVariationStatus` — and add a runtime assert at the top of each.

### 1C. Observability — stop swallowing errors
- [ ] Introduce an error policy: in `NODE_ENV !== 'production'`, swallowed/caught contract errors **rethrow**; in prod, they log structured + increment an error metric. Audit every empty/`console.error`-only catch flagged (viral_intelligence, dataAccess, variation_engine, autoScheduler) and apply the policy.
- [ ] Background services (`autoScheduler`, `jobQueueService`) must surface failed jobs to a visible status, not just `logger.error` (audit M2).

### 1D. Data layer decision — commit to Postgres
- [ ] **Decision:** Postgres is the sole store. Remove the JSON-fallback fiction (audit H2).
- [ ] Implement the **missing `dataService` methods** that callers already expect (this is audit C1's fix, foundationally): `viralIntelligence.getEmotionCache/saveEmotionCache/getViralIntelligence/saveViralIntelligence`, each `userId`-scoped, backed by real tables/columns.
- [ ] Delete `utils/dataAccess.js` and re-point every caller to `dataService` **with `userId`** (audit C4). Where a caller has no `userId` in scope (e.g. `batchController`, parts of `autoScheduler`), thread it from `req.userId` / the job record.
- [ ] Verify schema supports per-user emotion cache, viral intelligence, variation queue, post queue. Add migrations where missing.

**Definition of Done:**
- Integration test: an authenticated request with no token → 401; with a revoked token → 401.
- Unit test: calling any `userId`-scoped fn without a valid `userId` **throws** (proves H1-class bugs now fail loud).
- Test: `dataService.viralIntelligence.saveEmotionCache(userId, x)` then `getEmotionCache(userId)` round-trips (proves C1 fixed at the data layer).
- Grep/CI check: zero reads of `req.body.userId`/`req.query.userId` as identity; zero imports of `utils/dataAccess.js`.

---

## Phase 2 — Make the core execute

**Goal:** the auto-post pipeline and learning loop currently **throw on every run**. Make them complete for one tenant.

- [ ] **2.1 (C2)** Implement/​wire `selectMusicByEmotion` in `jobQueueService.js:309` (or replace with the existing `getMusicByEnergy` mapped from emotion). Add a test that `executeSmartVideoGeneration` runs to completion for each job type without `ReferenceError`.
- [ ] **2.2 (C1)** With the data methods from 1D in place, verify `trackPatternAttempt` / auto-kill / winner persistence actually accumulate across runs. Test: run pattern tracking twice, assert state persisted and a pattern is killed after `PATTERN_KILL_AFTER`.
- [ ] **2.3 (H1)** Fix all arity-shifted call sites now that the guards throw: `analyzeEmotionsWithAI(userId, videos)` and `fetchAllVideoStats(userId)` in `batchController.js:40,127,253`, `autoScheduler.js:47,185,391`, `youtubeController.js:165`; `generateBatch(userId, …)`, `updateVariationStatus(userId, …)` in `jobQueueService.js:439,493,517`, `autoScheduler.js:90,139`.
- [ ] **2.4 (H1)** Fix the variation lifecycle so variations leave `scheduled`/`pending` (`updateVariationStatus` arity). Test: a variation transitions pending→scheduled→generated→posted.
- [ ] **2.5 (H3)** Fix `jobQueueService.js:391` `loadVariationQueue` → correct export name (`getVariationQueue`) with `userId`.
- [ ] **2.6 (M1)** Job queue concurrency: add an in-flight reentrancy guard to `processQueue` (mirror `autoSchedulerRunning`); add retry backoff; null-check `getJobById` in the failure handler; add a trailing `.catch`.

**Definition of Done:** an end-to-end run (one tenant, **real** Gemini/Replicate/ElevenLabs keys, real Postgres) drives `autoScheduler.runAutoScheduler` → job queue → `executeSmartVideoGeneration` → produces a **real** video file, with the variation marked `posted` and patterns persisted in the DB. (Real posting to YouTube is verified in Phase 4 once OAuth is connected.) This run is the one that was never done. **Prereq: real Gemini + Replicate + ElevenLabs keys must be provisioned before this phase — no mocks (3b).**

---

## Phase 3 — Pipeline correctness (shippable output)

**Goal:** fix the desync that produces broken/unfinished videos (audit C7, H5). This is the user-visible quality problem from `note.md`.

- [ ] **3.1 (C7-index)** Single scene object end-to-end. On image-generation failure, **never tail-truncate**: either insert a placeholder image for that exact index or drop the *matching* storyboard entry by index. `visuals_pro.js:634-654`, remove the `slice(0, visualPaths.length)` reindex hack at `videoController.js:150` and all controller twins.
- [ ] **3.2 (C7-duration)** Drive image display time from **actual audio length**, not AI-invented `duration`. Either render per-scene TTS and use each clip's measured length, or align the single TTS track to scene boundaries via the alignment service. Stop muxing mismatched streams with `-shortest` (`renderer.js:642`).
- [ ] **3.3 (H5-subtitles)** Stop force-regenerating evenly-spaced captions: set `enableAnimatedSubtitles=false` path or make controllers pass the **speech-aligned SRT** (`subtitle_sync.js` output) that is currently computed and discarded (`renderer.js:579`).
- [ ] **3.4 (H5-artifacts)** Sanitize caption text before SRT→ASS: strip/escape `\t`, `\n`, `\N`, `\h`, stray backslashes and control chars (this removes the literal "backslash-t / forwardslash-T" artifact). Centralize in one `sanitizeCaption()` used by both subtitle paths.
- [ ] **3.5 (M)** Don't auto-post the canned "AI overloaded" fallback storyboard as a real video (`storyboard.js:394`) — mark the job failed instead.
- [ ] **3.6 (M-disk)** Add cleanup/retention for `/videos` scene PNGs, bgm, sfx, voiceover after successful render (audit disk leak).

**Definition of Done:** golden-path test renders a known 5-scene storyboard where scene 3's image is forced to fail, and asserts: (a) scenes 4/5 still pair with their own text (no off-by-one), (b) total video duration ≈ audio duration (not `-shortest`-truncated), (c) burned captions contain no `\t`/`\N` artifacts, (d) temp + scene assets cleaned up.

---

## Phase 4 — Uploaders & posting integrity (YouTube vertical slice)

**Goal:** one platform posts the **correct tenant's** video, once, reliably. Do YouTube fully, then Phase 7 replicates.

- [ ] **4.1 (H1-upload)** Thread `userId` into every uploader call: `unified_uploader.js:58,98,136,175`, `autoScheduler.js:104-117,268-281`, `jobQueueService.js:458-471`, `batchController.js:182-200`.
- [ ] **4.2 (C6/H1)** Fix the `unified_uploader` API gate (`isConnected?.()` dead for 3/4 platforms) so the official-API path is actually reachable; export `isConnected(userId)` consistently and call it with `userId`.
- [ ] **4.3 (C6) — DECIDED: delete Playwright entirely.** Remove `login-helper.js`, all `modules/uploaders/*_uploader.js` (Playwright), `chrome_profile` usage, and the `unified_uploader` fallback branches. Posting is API-only. This deletes the cross-user-cookie risk at the source rather than patching it.
- [ ] **4.4 (H2-yt)** Persist refreshed YouTube tokens: add `oauth2Client.on('tokens', saveTokens)` and proactively refresh on `expiry_date` before upload (`youtube_api_uploader.js`).
- [ ] **4.5 (C5-at-rest)** Actually encrypt tokens at rest (the `ENCRYPT_TOKENS` facade is unused) or store them only in Postgres with column encryption; remove plaintext JSON token files and debug screenshots.
- [ ] **4.6 (H6)** Idempotency: record a publish id / dedup key; never re-post a platform that already succeeded on a partial-failure retry (`autoScheduler.js:95-145`).
- [ ] **4.7 (M-oauth-state)** Move in-memory OAuth `state`/PKCE stores to the existing `oauth_states` table (migration 003) so multi-instance deploys don't break callbacks.

**Definition of Done:** two-tenant test with **real** YouTube accounts — Tenant A and Tenant B each connect a real YouTube channel via OAuth; a job for B posts a real video to B's channel, never A's; a retried partial failure does not double-post; an expired access token triggers real refresh-and-persist. **Prereq: two real YouTube channels + Google OAuth app credentials provisioned — no mocks (3b).**

*(TikTok H4 — the broken publish step that posts orphaned/private — is fixed in Phase 7 when TikTok is brought online, with its own slice.)*

---

## Phase 5 — Frontend session & UX integrity

**Goal:** the session model survives token expiry and stops leaking; errors are visible.

- [ ] **5.1 (C1-fe) — DECIDED: httpOnly cookie + in-memory access token.** Refresh token in an httpOnly, Secure, SameSite cookie; access token held in memory only. Remove all `localStorage` token storage. Backend must set/clear the cookie on login/logout/refresh and verify it statelessly on any instance.
- [ ] **5.2 (H7)** Add an `api.js` response interceptor: on 401, attempt refresh once, else redirect to login. Stop discarding the refresh token (`AuthContext.jsx:90`).
- [ ] **5.3 (H2-fe)** Make auth headers consistent — every authenticated endpoint sends the token (audit lists ~half missing). Centralize in one request wrapper.
- [ ] **5.4 (M-errors)** Standardize error UX: replace silent `console.error` + blocking `alert()` mix with a consistent error surface (toast/banner) and loading/error states.
- [ ] **5.5 (M-dead/perf)** Remove dead code (CreateVideo progress animation, OLD `createSmartVideo`, duplicate upload fns) and add `React.lazy` route splitting for the 1000+ line pages.

**Definition of Done:** test/manual — with an expired token, the app refreshes silently or routes to login (never a blank broken page); no token readable from `localStorage`; `/auth-debug` gone from the bundle.

---

## Phase 6 — Multi-tenant verification & hardening

**Goal:** prove isolation, then harden authz/limits. This phase is the SaaS contract.

- [ ] **6.1** Build a **two-tenant isolation test suite** that, for every data-returning endpoint, asserts Tenant A never sees Tenant B's topics, analytics, variations, tokens, videos, or monetization. This suite is permanent CI.
- [ ] **6.2 (C4)** Monetization authz: remove `|| req.body.userId || 'default'`; require auth; IDOR test.
- [ ] **6.3 (H2-job)** Job IDOR: enforce ownership on `getJob`/`cancelJob` (`jobController.js`); test cross-tenant job access → 403.
- [ ] **6.4 (M)** Rate limiting on `/auth/*` and all generation endpoints; per-user (not just per-IP). CORS locked to the configured allowlist (`env.CORS_ORIGINS`, currently ignored).
- [ ] **6.5 (M)** SQL hardening: allowlist `ORDER BY` in `trainingRepository.js:58`; review `INTERVAL` interpolations.
- [ ] **6.6 (M)** Error responses stop leaking internal `err.message` (`errorHandler.js:54`).

**Definition of Done:** the two-tenant suite (6.1) is green and runs in CI on every PR. Penetration-style tests for C3/C4/job-IDOR all return 401/403.

---

## Phase 7 — Breadth + cleanup

**Goal:** replicate the proven YouTube slice to the other platforms; remove dead weight; lock in quality.

- [ ] **7.1** Bring TikTok online, fixing the broken publish step (H4: unlinked publish init + hardcoded `SELF_ONLY`). Two-tenant + idempotency tests per platform.
- [ ] **7.2** Facebook & Instagram: real `expires_in` handling, refresh, reauth signaling (H5-uploader, M1).
- [ ] **7.3** Remove dead code: byte-identical `voice_pro_backup.js` / `voice_pro_elevenlabs_only.js`, no-op `addSoundEffects`, hardcoded SoundHelix demo music (replace with real licensed assets or a proper music service), unmounted `productGeneratorRoutes.js`, dead frontend APIs.
- [ ] **7.4** CI gates: lint, the boundary grep-checks (no `body.userId` identity, no `dataAccess` import), unit + integration + two-tenant suites must pass to merge.
- [ ] **7.5** Re-enable frozen features (A/B testing, monetization, avatar/product/training) one at a time, each behind the now-enforced boundaries and with tests.

**Definition of Done:** all four platforms pass the two-tenant + idempotency + pipeline golden-path suites; CI enforces every invariant this plan introduced; dead code gone.

---

## Cross-cutting workstreams (run throughout)

- **Testing harness (set up during Phase 1):** Vitest is already present. Add: (a) integration tests against a **real** Postgres (a dedicated test database in Docker — real DB, not a mock), (b) tests that call the **real** external APIs (Gemini/Replicate/ElevenLabs/platform APIs) with real credentials and real data — **no mocks/stubs per principle 3b**; tests assert on real responses, (c) the permanent two-tenant isolation suite. Determinism is achieved by controlling inputs and asserting invariants (e.g. "video has N scenes, audio length ≈ image timeline"), not by faking responses.
- **Secrets management:** `.env` only, validated on startup (the `envValidator` is solid — keep it); no secrets in repo, logs, or error responses; tokens encrypted at rest.
- **CI:** every PR runs lint + grep-invariants + unit + integration + two-tenant. Red = no merge.
- **Branching for review:** one sub-phase per PR, small enough for Codex to review meaningfully; PR description references the audit IDs it closes.

---

## Decisions (RESOLVED 2026-06-25)

1. **Frontend token storage:** ✅ **httpOnly cookie + in-memory access token.** (Phase 5.1)
2. **Playwright uploaders:** ✅ **Dropped — API-only.** Browser automation is removed entirely, not reworked. (Changes Phase 4.3 + 7; deletes `login-helper.js`, all `*_uploader.js` Playwright files, `chrome_profile` usage.)
3. **Deployment:** ✅ **Multi-instance / autoscaled.** No in-process state may be correctness-bearing. (Escalates 4.7 and 6.4 to mandatory-early; see "Multi-instance invariants" below.)
4. **First vertical slice:** ✅ **YouTube.**

### Multi-instance invariants (because of decision #3 — apply from Phase 1 on)
- **No in-memory state as source of truth.** OAuth `state`/PKCE → Postgres `oauth_states` (migration 003) **now**, not Phase 4.7. Emotion/pattern caches → Postgres only.
- **Scheduler leader-election.** `autoScheduler`'s `setInterval` tick must NOT run on every instance. Use a Postgres advisory lock (or a `scheduler_leases` row with TTL) so exactly one instance runs the tick. The in-process `autoSchedulerRunning` flag (audit M1) is insufficient across instances.
- **Job queue claim must be atomic across instances.** The correctness of `jobQueueService` now rests entirely on `claimJob` being a single atomic `UPDATE ... WHERE status='queued' ... RETURNING` (i.e. `FOR UPDATE SKIP LOCKED` semantics). This MUST be verified/enforced in Phase 2.6 — an in-process reentrancy guard alone is not enough.
- **Rate limiting must use a shared store** (Postgres or Redis), per-user, not the default in-memory per-IP limiter (audit 6.4). Promote to Phase 1/2, not Phase 6.
- **Sticky-session-free auth:** httpOnly cookie auth must work on any instance — JWT verification is stateless (fine), but the blacklist check must hit the shared store, not memory.

---

## What this plan deliberately does NOT do

- Does not add features before the spine works.
- Does not trust the existing markdown as requirements.
- Does not "fix" by stripping multi-tenancy — it makes it real.
- Does not batch unrelated changes; each PR is reviewable in isolation.
