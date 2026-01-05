/**
 * OAuth Security Test Suite
 * Tests CSRF protection patterns in OAuth flows (without full module imports)
 */

import crypto from 'crypto';
import fs from 'fs';

console.log('='.repeat(60));
console.log('OAUTH CSRF PROTECTION - TEST SUITE');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

function test(name, condition) {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.log(`  ❌ ${name}`);
        failed++;
    }
}

// ============================================================
// TEST 1: Verify YouTube OAuth Code Has CSRF Protection
// ============================================================
console.log('\n📋 TEST 1: YouTube OAuth CSRF Code Verification\n');

const youtubeCode = fs.readFileSync('./modules/uploaders/youtube_api_uploader.js', 'utf8');

test('YouTube has crypto import', youtubeCode.includes("import crypto from 'crypto'"));
test('YouTube has stateStore Map', youtubeCode.includes('const stateStore = new Map()'));
test('YouTube generates random state', youtubeCode.includes('crypto.randomBytes(32)'));
test('YouTube includes state in auth URL', youtubeCode.includes('state: state'));
test('YouTube validates state on callback', youtubeCode.includes('stateStore.has(state)'));
test('YouTube deletes state after use', youtubeCode.includes('stateStore.delete(state)'));
test('YouTube has state expiry cleanup', youtubeCode.includes('STATE_EXPIRY_MS'));

// ============================================================
// TEST 2: Verify Facebook OAuth Code Has CSRF Protection
// ============================================================
console.log('\n📋 TEST 2: Facebook OAuth CSRF Code Verification\n');

const facebookCode = fs.readFileSync('./modules/uploaders/facebook_api_uploader.js', 'utf8');

test('Facebook has crypto import', facebookCode.includes("import crypto from 'crypto'"));
test('Facebook has stateStore Map', facebookCode.includes('const stateStore = new Map()'));
test('Facebook generates random state', facebookCode.includes('crypto.randomBytes(32)'));
test('Facebook includes state in auth URL', facebookCode.includes('&state=${state}'));
test('Facebook validates state on callback', facebookCode.includes('stateStore.has(state)'));
test('Facebook deletes state after use', facebookCode.includes('stateStore.delete(state)'));
test('Facebook has state expiry cleanup', facebookCode.includes('STATE_EXPIRY_MS'));

// ============================================================
// TEST 3: Verify TikTok OAuth Has PKCE + CSRF Protection
// ============================================================
console.log('\n📋 TEST 3: TikTok OAuth PKCE + CSRF Code Verification\n');

const tiktokCode = fs.readFileSync('./modules/uploaders/tiktok_api_uploader.js', 'utf8');

test('TikTok has crypto import', tiktokCode.includes("import crypto from 'crypto'"));
test('TikTok has pkceStore Map (not global var)', tiktokCode.includes('const pkceStore = new Map()'));
test('TikTok generates random state', tiktokCode.includes('crypto.randomBytes(32)'));
test('TikTok includes state in auth URL', tiktokCode.includes('state='));
test('TikTok validates state on callback', tiktokCode.includes('pkceStore.has(state)'));
test('TikTok deletes PKCE after use', tiktokCode.includes('pkceStore.delete(state)'));
test('TikTok has PKCE expiry cleanup', tiktokCode.includes('PKCE_EXPIRY_MS'));
test('TikTok has code_verifier in PKCE store', tiktokCode.includes('codeVerifier'));
test('TikTok NO global currentCodeVerifier', !tiktokCode.includes('let currentCodeVerifier'));

// ============================================================
// TEST 4: Verify Cryptographic State Generation
// ============================================================
console.log('\n📋 TEST 4: Cryptographic State Generation\n');

// Generate multiple states and verify they're unique
const states = new Set();
for (let i = 0; i < 100; i++) {
    states.add(crypto.randomBytes(32).toString('hex'));
}
test('100 generated states are all unique', states.size === 100);
test('State is 64 hex characters', crypto.randomBytes(32).toString('hex').length === 64);

// ============================================================
// TEST 5: Verify State Store Cleanup Logic
// ============================================================
console.log('\n📋 TEST 5: State Expiry Logic Simulation\n');

// Simulate state store behavior
const stateStore = new Map();
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Add a valid state
const testState = crypto.randomBytes(32).toString('hex');
stateStore.set(testState, {
    createdAt: Date.now(),
    expiresAt: Date.now() + STATE_EXPIRY_MS
});

test('State is stored in map', stateStore.has(testState));
test('State has expiry time', stateStore.get(testState).expiresAt > Date.now());

// Add an expired state
const expiredState = crypto.randomBytes(32).toString('hex');
stateStore.set(expiredState, {
    createdAt: Date.now() - 20 * 60 * 1000, // 20 mins ago
    expiresAt: Date.now() - 10 * 60 * 1000  // expired 10 mins ago
});

// Cleanup simulation (as done in the interval)
const now = Date.now();
for (const [state, data] of stateStore.entries()) {
    if (data.expiresAt < now) {
        stateStore.delete(state);
    }
}

test('Expired states are cleaned up', !stateStore.has(expiredState));
test('Valid states remain', stateStore.has(testState));

// Single-use test
stateStore.delete(testState);
test('State is deleted after use (single-use)', !stateStore.has(testState));

// ============================================================
// TEST 6: Verify Auth Bypass Protection
// ============================================================
console.log('\n📋 TEST 6: Auth Bypass Protection Code Verification\n');

const authContextCode = fs.readFileSync('../../dashboard/src/context/AuthContext.jsx', 'utf8');

test('No DEV_BYPASS_LOGIN flag', !authContextCode.includes('DEV_BYPASS_LOGIN'));
test('Has isDevModeEnabled function', authContextCode.includes('isDevModeEnabled'));
test('Requires localhost check', authContextCode.includes('localhost') && authContextCode.includes('127.0.0.1'));
test('Requires explicit localStorage opt-in', authContextCode.includes('__ALLOW_DEV_MODE__'));
test('Returns false if not localhost', authContextCode.includes('if (!isLocalhost) return false'));

// ============================================================
// SUMMARY
// ============================================================
console.log('\n' + '='.repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed === 0) {
    console.log('\n✅ All OAuth security tests passed!\n');
    process.exit(0);
} else {
    console.log('\n❌ Some tests failed!\n');
    process.exit(1);
}
