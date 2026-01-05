# ⚠️ Business Logic & Lifecycle Conflicts Report

**Platform**: Viral Faceless Shorts Generator
**Analysis Date**: December 30, 2025
**Severity**: 4 CRITICAL, 3 HIGH, 3 MEDIUM conflicts found
**Status**: **PRODUCTION BLOCKERS IDENTIFIED**

---

## 🚨 EXECUTIVE SUMMARY

A comprehensive code scan identified **10 significant business logic conflicts** that affect:
- **Multi-tenant data isolation** (users seeing each other's data)
- **Auto-posting functionality** (scheduled posts failing)
- **New user onboarding** (cold start problem)
- **Token lifecycle** (OAuth expiration not handled)
- **API consistency** (confusing endpoint design)

### Critical Issues Requiring Immediate Fix:
1. ❌ **Multi-tenant isolation broken** - User A's analytics affect User B's topics
2. ❌ **Auto-posting fails** - Missing userId parameters cause upload errors
3. ❌ **Function signature mismatches** - Wrong parameters passed to core functions
4. ❌ **Fallback path broken** - Database fallback doesn't work

---

## 🔴 CRITICAL CONFLICTS (Fix Immediately)

### CONFLICT 1: Multi-Tenant Isolation Broken - Missing userId in Emotion Analysis

**Severity**: 🔴 CRITICAL
**Impact**: Privacy violation, data leakage between users

**Problem**:
The `analyzeEmotionsWithAI()` function expects `(userId, videos)` but is being called with only `(videos)` in 3 locations, breaking user isolation.

**Location**:
```javascript
// FUNCTION SIGNATURE (viral_intelligence.js line 39):
export const analyzeEmotionsWithAI = async (userId, videos) => { ... }

// WRONG CALLS:
// autoScheduler.js line 47:
const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(videos); ❌

// autoScheduler.js line 185:
const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(videos); ❌

// autoScheduler.js line 391:
const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(videos); ❌
```

**Current Behavior**:
- User A's videos are analyzed for emotions
- Emotion cache stores results GLOBALLY (not per-user)
- User B generates topics and gets User A's emotion analysis
- Topic generation becomes non-deterministic
- Privacy violation - cross-user data leakage

**Expected Behavior**:
```javascript
// All calls should include userId:
const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);
```

**Data Flow Impact**:
```
User A (Tech YouTuber):
  - Video: "iPhone 16 Review" → Emotion: "curiosity"

User B (Cooking Channel):
  - Generates topic using WRONG emotion cache
  - Gets "curiosity" pattern from User A's tech content
  - Generates inappropriate cooking topic
```

**Fix**:
Update `trendscraper/src/services/autoScheduler.js`:

**Line 47** (inside `generateVideoDirectly`):
```javascript
// BEFORE:
const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(videos);

// AFTER:
// Note: userId needs to be passed to generateVideoDirectly() function first
const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);
```

**Line 185** (inside `generateAndPostPromotionalVideo`):
```javascript
// BEFORE:
const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(videos);

// AFTER:
const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);
```

**Line 391** (inside auto-scheduler loop):
```javascript
// BEFORE:
const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(videos);

// AFTER:
const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);
```

**Testing**:
1. Create User A with tech videos
2. Create User B with cooking videos
3. Generate smart topic for User B
4. Verify topic uses User B's emotion patterns only (not User A's)

---

### CONFLICT 2: Function Signature Mismatch - analyzeForOutliers

**Severity**: 🔴 CRITICAL
**Impact**: Smart topic generation crashes

**Problem**:
The `analyzeForOutliers()` function is defined with signature `(videos, emotionMap)` but is being called with 3 parameters `(userId, videos, emotionMap)` in one location.

**Location**:
```javascript
// FUNCTION DEFINITION (viral_intelligence.js line 381):
export const analyzeForOutliers = (videos, emotionMap = null) => { ... }

// WRONG CALL (smart_topic_generator.js line 1012):
viralData = await viralIntelligence.analyzeForOutliers(userId, videos, emotionMap); ❌

// CORRECT CALLS (autoScheduler.js lines 48, 186, 392):
const viralData = viralIntelligence.analyzeForOutliers(videos, emotionMap); ✓
```

**Current Behavior**:
When `smart_topic_generator.js` calls the function:
- `userId` becomes the `videos` parameter
- `videos` becomes the `emotionMap` parameter
- `emotionMap` is ignored
- Function tries to iterate over a string (userId) as if it were an array
- Crash or garbage data returned

**Expected Behavior**:
Either:
1. Remove userId from the call (quick fix)
2. Or add userId to function signature (proper isolation)

**Fix Option 1** (Quick Fix):
Update `trendscraper/src/modules/analytics/smart_topic_generator.js` line 1012:

```javascript
// BEFORE:
viralData = await viralIntelligence.analyzeForOutliers(userId, videos, emotionMap);

// AFTER:
viralData = await viralIntelligence.analyzeForOutliers(videos, emotionMap);
```

**Fix Option 2** (Proper Isolation):
Update `trendscraper/src/modules/analytics/viral_intelligence.js` line 381:

```javascript
// BEFORE:
export const analyzeForOutliers = (videos, emotionMap = null) => {

// AFTER:
export const analyzeForOutliers = (userId, videos, emotionMap = null) => {
    // Add user-specific analysis storage
    // Store viral thresholds per-user
    // Return user-scoped outlier analysis
}
```

Then update ALL callers in `autoScheduler.js` to include userId.

**Recommendation**: Use Option 2 for proper multi-tenant isolation.

**Testing**:
1. Call smart topic generation endpoint
2. Verify no crashes
3. Verify returned topics are valid

---

### CONFLICT 3: Missing userId in generateVideoDirectly Fallback

**Severity**: 🔴 CRITICAL
**Impact**: Database fallback completely non-functional

**Problem**:
The `generateVideoDirectly()` function (fallback when database unavailable) calls `youtubeAnalytics.fetchAllVideoStats()` without userId parameter.

**Location**:
```javascript
// trendscraper/src/services/autoScheduler.js line 46:
const generateVideoDirectly = async (variation, niche, platforms, schedule) => {
    // ...
    const { videos } = await youtubeAnalytics.fetchAllVideoStats(); // ❌ Missing userId!
}

// BUT youtubeAnalytics.fetchAllVideoStats() requires userId (line 187):
export const fetchAllVideoStats = async (userId) => {
    if (!userId) throw new Error('userId required for analytics');
}
```

**Current Behavior**:
- If database becomes unavailable, auto-scheduler tries fallback
- `generateVideoDirectly()` is called
- Crashes immediately with "userId required for analytics"
- Auto-scheduler halts completely
- No videos generated until database restored

**Expected Behavior**:
```javascript
const generateVideoDirectly = async (userId, variation, niche, platforms, schedule) => {
    const { videos } = await youtubeAnalytics.fetchAllVideoStats(userId);
    // ...
}
```

**Fix**:
Update `trendscraper/src/services/autoScheduler.js`:

**Line 43** (function signature):
```javascript
// BEFORE:
const generateVideoDirectly = async (variation, niche, platforms, schedule) => {

// AFTER:
const generateVideoDirectly = async (userId, variation, niche, platforms, schedule) => {
```

**Line 46** (analytics call):
```javascript
// BEFORE:
const { videos } = await youtubeAnalytics.fetchAllVideoStats();

// AFTER:
const { videos } = await youtubeAnalytics.fetchAllVideoStats(userId);
```

**Line 90** (emotion analysis - also needs userId):
```javascript
// BEFORE:
variationEngine.updateVariationStatus(variation.id, 'generated', {

// AFTER:
variationEngine.updateVariationStatus(userId, variation.id, 'generated', {
```

**Line 420, 426** (wherever generateVideoDirectly is called):
```javascript
// BEFORE:
await generateVideoDirectly(variation, niche, platforms, schedule);

// AFTER:
await generateVideoDirectly(userId, variation, niche, platforms, schedule);
```

**Testing**:
1. Stop PostgreSQL database
2. Trigger auto-scheduler
3. Verify fallback works without crashing
4. Verify videos are generated

---

### CONFLICT 4: Missing userId in Upload API Calls

**Severity**: 🔴 CRITICAL
**Impact**: **ALL AUTO-POSTING FAILS**

**Problem**:
Platform upload APIs (YouTube, TikTok, Facebook) require `userId` as the first parameter, but `autoScheduler.js` is calling them without userId.

**Location**:
```javascript
// UPLOAD FUNCTION SIGNATURE (youtube_api_uploader.js line 269):
export const uploadToYouTubeAPI = async (userId, videoPath, metadata = {}) => {
    if (!userId) {
        throw new Error('userId is required for YouTube upload');
    }
}

// WRONG CALLS IN autoScheduler.js:
// Line 104:
postResult = await youtubeAPI.uploadToYouTubeAPI(destPath, {
    title: metadata.youtube.title,
    // ...
}); // ❌ Missing userId!

// Line 112:
postResult = await tiktokAPI.uploadToTikTokAPI(destPath, {
    title: metadata.tiktok.title,
    // ...
}); // ❌ Missing userId!

// Line 120:
postResult = await facebookAPI.uploadToFacebookAPI(destPath, {
    title: metadata.facebook.title,
    // ...
}); // ❌ Missing userId!
```

**Current Behavior**:
- Auto-scheduler generates video successfully
- Tries to upload to YouTube
- Crashes with `Error: userId is required for YouTube upload`
- Job marked as failed
- Video never posted
- **This breaks the entire auto-posting feature you just configured!**

**Expected Behavior**:
All upload calls should include userId as first parameter.

**Fix**:
Update `trendscraper/src/services/autoScheduler.js`:

**Line 104** (YouTube upload):
```javascript
// BEFORE:
postResult = await youtubeAPI.uploadToYouTubeAPI(destPath, {
    title: metadata.youtube.title,
    description: metadata.youtube.description,
    hashtags: metadata.youtube.hashtags,
    tags: metadata.youtube.keywords || [],
    categoryId: '22'
});

// AFTER:
postResult = await youtubeAPI.uploadToYouTubeAPI(userId, destPath, {
    title: metadata.youtube.title,
    description: metadata.youtube.description,
    hashtags: metadata.youtube.hashtags,
    tags: metadata.youtube.keywords || [],
    categoryId: '22'
});
```

**Line 112** (TikTok upload):
```javascript
// BEFORE:
postResult = await tiktokAPI.uploadToTikTokAPI(destPath, {
    title: metadata.tiktok.title,
    hashtags: metadata.tiktok.hashtags
});

// AFTER:
postResult = await tiktokAPI.uploadToTikTokAPI(userId, destPath, {
    title: metadata.tiktok.title,
    hashtags: metadata.tiktok.hashtags
});
```

**Line 120** (Facebook upload):
```javascript
// BEFORE:
postResult = await facebookAPI.uploadToFacebookAPI(destPath, {
    title: metadata.facebook.title,
    description: metadata.facebook.description
});

// AFTER:
postResult = await facebookAPI.uploadToFacebookAPI(userId, destPath, {
    title: metadata.facebook.title,
    description: metadata.facebook.description
});
```

**SAME ISSUE in generateAndPostPromotionalVideo function**:

**Line 268** (YouTube):
```javascript
// BEFORE:
postResult = await youtubeAPI.uploadToYouTubeAPI(destPath, {

// AFTER:
postResult = await youtubeAPI.uploadToYouTubeAPI(userId, destPath, {
```

**Line 276** (TikTok):
```javascript
// BEFORE:
postResult = await tiktokAPI.uploadToTikTokAPI(destPath, {

// AFTER:
postResult = await tiktokAPI.uploadToTikTokAPI(userId, destPath, {
```

**Line 280** (Facebook):
```javascript
// BEFORE:
postResult = await facebookAPI.uploadToFacebookAPI(destPath, {

// AFTER:
postResult = await facebookAPI.uploadToFacebookAPI(userId, destPath, {
```

**Note**: The `userId` is available in scope:
- In `generateVideoDirectly`: Need to add to function signature (see Conflict 3)
- In `generateAndPostPromotionalVideo`: Need to add to function signature (line 159)
- In auto-scheduler loop: Available as `userId = userRow.id` (line 365)

**Testing** (CRITICAL - Test immediately after fix):
1. Wait for auto-scheduler to trigger (or manually trigger)
2. Check logs for "userId is required" errors
3. Verify video uploads succeed
4. Check YouTube/TikTok/Facebook for posted videos

---

## 🟠 HIGH SEVERITY CONFLICTS (Fix Soon)

### CONFLICT 5: Cold Start Problem - New Users Have No Analytics

**Severity**: 🟠 HIGH
**Impact**: New users can't generate personalized smart topics

**Problem**:
When a new user signs up with zero videos, the system has no analytics data to learn from. The `smart_topic_generator.js` falls back to hardcoded default patterns that are identical for ALL new users.

**Location**:
```javascript
// trendscraper/src/modules/analytics/smart_topic_generator.js line 539:
if (videos.length === 0) {
    return getDefaultPatterns();
}

// Lines 583-594 - Default patterns (STATIC, shared across all users):
const getDefaultPatterns = () => ({
    hooks: [
        { name: 'rule-breaking', avgViews: 800, winRate: 80, total: 1 },
        { name: 'secrets-exposed', avgViews: 500, winRate: 60, total: 1 },
        { name: 'underdog-wins', avgViews: 400, winRate: 50, total: 1 }
    ],
    emotions: [...],
    structures: [...]
});
```

**Current Behavior**:
```
New User A (tech niche):
  - Gets: "rule-breaking", "secrets-exposed", "underdog-wins"

New User B (cooking niche):
  - Gets: "rule-breaking", "secrets-exposed", "underdog-wins"

New User C (finance niche):
  - Gets: "rule-breaking", "secrets-exposed", "underdog-wins"

All users get identical generic patterns!
```

**Expected Behavior**:
```
New User A (tech niche):
  - Gets: tech-specific patterns ("tutorial", "review", "comparison")

New User B (cooking niche):
  - Gets: cooking-specific patterns ("recipe", "how-to", "tips")

New User C (finance niche):
  - Gets: finance-specific patterns ("investing", "save money", "explained")
```

**Lifecycle Flow**:
```
User signs up
  ↓
Has 0 videos → No analytics
  ↓
Tries to generate smart topic
  ↓
System uses generic defaults (not personalized)
  ↓
User needs to manually create 3+ videos FIRST
  ↓
Then system can analyze and learn patterns
  ↓
ONLY THEN can smart topics be personalized
```

**Impact on User Experience**:
- First 3 videos are generic, not optimized for their niche
- No competitive advantage for new users
- Viral intelligence system doesn't work until they have history
- No differentiation from competitors on cold start

**Fix Option 1** (Niche-Based Defaults):
```javascript
const getDefaultPatterns = (niche = 'general') => {
    const nichePatterns = {
        tech: {
            hooks: [
                { name: 'tutorial', avgViews: 1000, winRate: 85 },
                { name: 'review', avgViews: 900, winRate: 80 },
                { name: 'comparison', avgViews: 800, winRate: 75 }
            ],
            emotions: ['curiosity', 'excitement', 'problem-solving'],
            structures: ['how-to', 'review', 'comparison']
        },
        cooking: {
            hooks: [
                { name: 'recipe', avgViews: 1200, winRate: 90 },
                { name: 'tips', avgViews: 900, winRate: 80 },
                { name: 'quick-meal', avgViews: 850, winRate: 75 }
            ],
            emotions: ['hunger', 'satisfaction', 'curiosity'],
            structures: ['step-by-step', 'hack', 'showcase']
        },
        finance: {
            hooks: [
                { name: 'save-money', avgViews: 1100, winRate: 88 },
                { name: 'investing', avgViews: 950, winRate: 82 },
                { name: 'explained', avgViews: 900, winRate: 78 }
            ],
            emotions: ['fear', 'hope', 'urgency'],
            structures: ['explainer', 'advice', 'case-study']
        },
        general: { /* existing defaults */ }
    };

    return nichePatterns[niche] || nichePatterns.general;
};
```

**Fix Option 2** (Force Seed Videos):
```javascript
if (videos.length === 0) {
    return {
        isColdStart: true,
        minVideosNeeded: 3,
        patterns: getDefaultPatterns(niche),
        message: 'Create 3 videos manually first to enable AI learning'
    };
}

if (videos.length < 3) {
    return {
        isWarmingUp: true,
        videosNeeded: 3 - videos.length,
        patterns: getDefaultPatterns(niche),
        message: `${3 - videos.length} more videos needed for full AI optimization`
    };
}
```

**Frontend Changes Needed**:
```javascript
// dashboard/src/pages/CreateVideo.jsx
if (smartTopic?.isColdStart) {
    return (
        <div className="cold-start-banner">
            ⚠️ AI Learning Disabled
            <p>Upload 3 videos manually to enable viral intelligence</p>
            <button>Upload Your First Video</button>
        </div>
    );
}
```

**Recommended Fix**: Combine both options:
1. Use niche-based defaults for better initial topics
2. Show warning banner to user about cold start state
3. Encourage manual upload of 3 seed videos
4. Gradually improve as more videos are added

**Testing**:
1. Create new user account
2. Generate smart topic immediately (0 videos)
3. Verify receives niche-appropriate defaults
4. Verify cold start warning shown in UI

---

### CONFLICT 6: Promotional Video Generation Missing userId

**Severity**: 🟠 HIGH
**Impact**: Promotional content uses shared analytics across users

**Problem**:
The `generateAndPostPromotionalVideo()` function needs to accept userId parameter and pass it to analytics calls.

**Location**:
```javascript
// trendscraper/src/services/autoScheduler.js line 159:
const generateAndPostPromotionalVideo = async (schedule) => {
    // userId is NOT in function signature! ❌

    // Line 183:
    const { videos } = await youtubeAnalytics.fetchAllVideoStats(); // ❌ Missing userId

    // Line 185:
    const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(videos); // ❌ Missing userId
}
```

**Current Behavior**:
- Promotional video generation uses GLOBAL analytics
- User A's promotional content can be influenced by User B's video data
- Cross-user data leakage in promotional content

**Fix**:
```javascript
// Line 159 - Add userId parameter:
const generateAndPostPromotionalVideo = async (userId, schedule) => {

    // Line 183:
    const { videos } = await youtubeAnalytics.fetchAllVideoStats(userId);

    // Line 185:
    const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);

    // Line 186:
    const viralData = viralIntelligence.analyzeForOutliers(videos, emotionMap);
}

// Line 350 - Update call site:
await generateAndPostPromotionalVideo(userId, schedule);
```

**Testing**:
1. Enable promotional content for User A
2. Wait for promo post to trigger
3. Verify uses User A's analytics only

---

### CONFLICT 7: OAuth Token Expiration Not Handled

**Severity**: 🟠 HIGH
**Impact**: Auto-posts fail after 1 hour when tokens expire

**Problem**:
OAuth access tokens expire (typically after 3600 seconds), but the upload functions don't check expiration or refresh tokens automatically.

**Location**:
```javascript
// trendscraper/src/modules/uploaders/youtube_api_uploader.js line 275:
const tokens = await loadTokens(userId);
if (!tokens) {
    throw new Error('Not authorized');
}

const oauth2Client = getOAuth2Client();
oauth2Client.setCredentials(tokens);
// ❌ No check for tokens.expiry_date!
// ❌ No automatic refresh!

// Line 93 - loadTokens returns expiry_date but never checks it:
return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expiry_date: tokenData.expires_at ? new Date(tokenData.expires_at).getTime() : null,
    // expiry_date is loaded but never validated!
};
```

**Current Behavior**:
```
User connects YouTube at 9:00 AM
  ↓
Token expires at 10:00 AM (1 hour later)
  ↓
Auto-scheduler tries to post at 10:30 AM
  ↓
Upload fails with "Invalid Credentials" error
  ↓
Job marked as failed
  ↓
User never notified
```

**Expected Behavior**:
```
Token expiry detected
  ↓
Automatic refresh using refresh_token
  ↓
New access_token obtained
  ↓
Upload succeeds
  ↓
New token saved to database
```

**Fix**:
Update `trendscraper/src/modules/uploaders/youtube_api_uploader.js`:

```javascript
// Add before line 275:
const ensureFreshToken = async (userId, oauth2Client, tokens) => {
    // Check if token is expired or will expire soon (5 min buffer)
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    if (tokens.expiry_date && now >= (tokens.expiry_date - expiryBuffer)) {
        console.log(`Token expired for user ${userId}, refreshing...`);

        try {
            // Use refresh_token to get new access_token
            const { credentials } = await oauth2Client.refreshAccessToken();

            // Save new tokens
            await saveTokens(userId, {
                access_token: credentials.access_token,
                refresh_token: credentials.refresh_token || tokens.refresh_token,
                expires_at: new Date(credentials.expiry_date).toISOString(),
                scope: credentials.scope
            });

            console.log(`Token refreshed for user ${userId}`);
            return credentials;
        } catch (error) {
            console.error(`Token refresh failed for user ${userId}:`, error);
            throw new Error('YouTube authorization expired. Please reconnect your account.');
        }
    }

    return tokens;
};

// Then update uploadToYouTubeAPI (line 275):
const tokens = await loadTokens(userId);
if (!tokens) {
    throw new Error('Not authorized. Please connect your YouTube account first.');
}

const oauth2Client = getOAuth2Client();

// ✅ Ensure token is fresh before upload:
const freshTokens = await ensureFreshToken(userId, oauth2Client, tokens);
oauth2Client.setCredentials(freshTokens);
```

**Apply Same Fix To**:
- `tiktok_api_uploader.js`
- `facebook_api_uploader.js`
- `instagram_api_uploader.js`

**Add User Notification**:
If refresh fails (refresh_token also expired), notify user:

```javascript
// In catch block:
// Send email or in-app notification:
await notifyUser(userId, {
    type: 'authorization_expired',
    platform: 'youtube',
    message: 'Your YouTube connection expired. Please re-authorize.',
    actionUrl: '/settings/connections'
});
```

**Testing**:
1. Connect YouTube account
2. Manually set expiry_date to past time in database:
   ```sql
   UPDATE platform_tokens
   SET expires_at = NOW() - INTERVAL '1 hour'
   WHERE user_id = 'xxx' AND platform = 'youtube';
   ```
3. Try to upload video
4. Verify token auto-refreshes
5. Verify upload succeeds

---

## 🟡 MEDIUM SEVERITY CONFLICTS (Fix Eventually)

### CONFLICT 8: Variation Queue Isolation Audit Needed

**Severity**: 🟡 MEDIUM
**Impact**: Depends on dataService implementation

**Problem**:
The variation engine attempts to isolate queues by userId, but the actual storage implementation in `dataService.variationEngine.*` methods was just added today. Need to audit that user isolation is properly enforced at database level.

**Location**:
```javascript
// trendscraper/src/services/dataService.js lines 389-451:
export const variationEngineService = {
    async getVariationQueue(userId) {
        validateUserId(userId, 'variationEngineService.getVariationQueue');
        const result = await database.query(
            'SELECT setting_value FROM user_settings WHERE user_id = $1 AND setting_key = $2',
            [userId, 'variation_queue']
        );
        // ✓ Filters by userId - looks good!
    },

    async saveVariationQueue(userId, queue) {
        validateUserId(userId, 'variationEngineService.saveVariationQueue');
        await database.query(
            `INSERT INTO user_settings (user_id, setting_key, setting_value)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, setting_key) DO UPDATE...`,
            [userId, 'variation_queue', JSON.stringify(queue)]
        );
        // ✓ Scoped to userId - looks good!
    }
};
```

**Audit Checklist**:
- [x] `getVariationQueue()` filters by userId ✓
- [x] `saveVariationQueue()` scopes to userId ✓
- [x] `getPostingSchedule()` filters by userId ✓
- [x] `savePostingSchedule()` scopes to userId ✓
- [ ] Test: User A cannot access User B's queue via direct database query
- [ ] Test: User A cannot modify User B's queue
- [ ] Test: Ensure unique constraint on (user_id, setting_key)

**Testing**:
```sql
-- Verify unique constraint exists:
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'user_settings'
  AND constraint_type = 'UNIQUE';

-- Expected: user_settings_user_id_setting_key_key UNIQUE

-- Verify isolation:
SELECT user_id, setting_key, setting_value->'variations' as variations
FROM user_settings
WHERE setting_key = 'variation_queue';
-- Should see separate queues per user_id
```

**Recommendation**: Code looks correct, just needs validation testing.

---

### CONFLICT 9: Stale Analytics - No Periodic Refresh

**Severity**: 🟡 MEDIUM
**Impact**: Topic quality degrades over time

**Problem**:
Analytics are only refreshed:
1. Once at server startup (`index.js` line 121)
2. When variation queue runs low (less than 3 pending)

If queue stays healthy, analytics can be 24+ hours old, missing recent viral hits.

**Location**:
```javascript
// trendscraper/src/index.js line 121:
await youtubeAnalytics.refreshAnalyticsIfNeeded();
// Only runs ONCE at startup!

// trendscraper/src/services/autoScheduler.js line 387:
const pendingCount = queue.variations.filter(v => v.status === 'pending').length;

if (pendingCount < 3) {
    // Only refreshes if queue is LOW
    const { videos } = await youtubeAnalytics.fetchAllVideoStats(userId);
}
```

**Current Behavior**:
```
Day 1, 9:00 AM: Server starts, fetches analytics
  ↓
Day 1, 9:30 AM: Generate batch (uses 9:00 AM analytics)
  ↓
Day 1, 10:00 PM: Generate video (uses 9:00 AM analytics - 13 hours old!)
  ↓
Day 2, 9:00 AM: Generate video (uses Day 1 analytics - 24 hours old!)
  ↓
Never refreshes unless queue depletes or server restarts
```

**Expected Behavior**:
```
Refresh analytics every 24 hours
OR before each batch generation
OR on-demand when user requests
```

**Fix**:
Add timestamp tracking to schedule:

```javascript
// In autoScheduler.js, before generating batch:
const schedule = await variationEngine.loadSchedule(userId);

// Check last analytics refresh
const lastRefresh = schedule.lastAnalyticsRefresh
    ? new Date(schedule.lastAnalyticsRefresh)
    : new Date(0);

const hoursSinceRefresh = (Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60);

// Refresh if stale (>24 hours)
if (hoursSinceRefresh > 24) {
    console.log(`Analytics stale (${hoursSinceRefresh.toFixed(1)}h old), refreshing...`);
    const { videos } = await youtubeAnalytics.fetchAllVideoStats(userId);
    const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);
    const viralData = viralIntelligence.analyzeForOutliers(videos, emotionMap);

    // Regenerate batch with fresh data
    await variationEngine.generateBatch(userId, viralData, schedule.niche || 'general');

    // Update timestamp
    schedule.lastAnalyticsRefresh = new Date().toISOString();
    await variationEngine.saveSchedule(userId, schedule);
}
```

**Alternative**: Add cron job to refresh analytics for all users daily:

```javascript
// New file: trendscraper/src/services/analyticsRefreshService.js
export const refreshAllUsersAnalytics = async () => {
    const users = await getUsersWithAutoPostEnabled();

    for (const user of users) {
        try {
            await youtubeAnalytics.fetchAllVideoStats(user.id);
            console.log(`Analytics refreshed for ${user.email}`);
        } catch (error) {
            console.error(`Failed to refresh analytics for ${user.email}:`, error);
        }
    }
};

// Run daily at 3 AM:
setInterval(refreshAllUsersAnalytics, 24 * 60 * 60 * 1000);
```

**Testing**:
1. Start server
2. Wait 25 hours without queue depleting
3. Trigger generation
4. Verify analytics are refreshed automatically

---

### CONFLICT 10: Inconsistent API Design - Sync vs Async Endpoints

**Severity**: 🟡 MEDIUM
**Impact**: Confusing API, poor developer experience

**Problem**:
Two different endpoints for the same purpose with completely different behaviors:

**Location**:
```javascript
// trendscraper/src/routes/smartRoutes.js:

// LEGACY (Synchronous):
POST /smart/create-and-post
  → Blocks for 5-15 minutes
  → Returns complete video data
  → Times out on slow networks
  → Response: { success: true, video: {...}, uploads: {...} }

// NEW (Asynchronous):
POST /smart/create-job
  → Returns immediately
  → Returns job ID
  → Requires polling
  → Response: { success: true, jobId: "xxx", status: "queued" }
```

**Current Behavior**:
- Developers don't know which endpoint to use
- Old code uses `/create-and-post` (blocks browser)
- New code uses `/create-job` (async)
- Inconsistent error handling
- Inconsistent response formats
- Timeouts on slow connections with sync endpoint

**Expected Behavior**:
```
ALL video generation should be async:
  ↓
Create job immediately
  ↓
Return job ID
  ↓
Client polls for completion
  ↓
Consistent experience
```

**Fix**:
**Phase 1**: Deprecate sync endpoint (don't break existing users):

```javascript
// trendscraper/src/routes/smartRoutes.js:
router.post('/create-and-post', asyncHandler(async (req, res) => {
    // Log deprecation warning
    console.warn('DEPRECATED: /smart/create-and-post called. Use /smart/create-job instead.');

    // Create job (same as /create-job)
    const job = await jobRepository.createJob({
        userId: req.user?.id,
        jobType: 'smart_video',
        inputParams: req.body,
        priority: 0
    });

    // Return deprecation notice
    res.status(200).json({
        success: true,
        deprecated: true,
        message: 'This endpoint is deprecated. Use POST /smart/create-job for async generation.',
        jobId: job.id,
        pollUrl: `/jobs/${job.id}`,
        redirectUrl: `/jobs`
    });
}));
```

**Phase 2**: Update all frontend calls:

```javascript
// dashboard/src/api.js - Remove old createSmartVideo():
// OLD (DELETE):
async createSmartVideo(niche, platforms, topic) {
    const response = await fetch('/smart/create-and-post', ...);
}

// NEW (USE):
async createSmartVideo(niche, platforms, topic) {
    return this.createSmartVideoJob(niche, platforms, topic);
}
```

**Phase 3**: Add webhook support (avoid polling):

```javascript
// When job completes:
await notifyWebhook(userId, {
    event: 'video.generation.completed',
    jobId: job.id,
    videoPath: job.result.videoPath,
    platforms: job.result.platforms
});
```

**Documentation Update**:
```markdown
# Video Generation API

All video generation is **asynchronous** via job queue.

## Create Video Job
POST /smart/create-job

Returns immediately with job ID. Poll GET /jobs/{jobId} for status.

## Monitor Job Progress
GET /jobs/{jobId}

Returns:
- status: queued | processing | completed | failed
- progress: 0-100
- currentStep: "Generating images..."
- result: (when completed) { videoPath, uploads }

## Alternative: Webhooks
Configure webhook URL in settings to receive completion notifications.
```

**Testing**:
1. Call deprecated endpoint
2. Verify returns job ID
3. Verify deprecation warning logged
4. Update all frontend code to use new endpoint
5. Remove deprecated endpoint after migration period

---

## 📋 FIX PRIORITY MATRIX

| Priority | Conflict | Est. Time | Impact if Not Fixed |
|----------|----------|-----------|---------------------|
| P0 (NOW) | #1: Missing userId in analyzeEmotionsWithAI | 30 min | Multi-tenant data leakage |
| P0 (NOW) | #2: analyzeForOutliers signature mismatch | 15 min | Smart topics crash |
| P0 (NOW) | #4: Upload calls missing userId | 30 min | **Auto-posting completely broken** |
| P0 (NOW) | #3: generateVideoDirectly missing userId | 20 min | Fallback doesn't work |
| P1 (Week 1) | #5: Cold start problem | 2 hours | Poor new user experience |
| P1 (Week 1) | #6: Promotional video missing userId | 15 min | Promo content data leakage |
| P1 (Week 1) | #7: Token expiration handling | 3 hours | Posts fail after 1 hour |
| P2 (Week 2) | #8: Variation queue audit | 1 hour | Verify isolation works |
| P2 (Week 2) | #9: Stale analytics refresh | 2 hours | Topic quality degrades |
| P3 (Month 1) | #10: API consistency | 4 hours | Confusing API design |

**Total Estimated Fix Time**: ~13 hours

---

## 🔧 QUICK FIX SCRIPT

Here's the exact changes needed for P0 (critical) fixes:

### File 1: `trendscraper/src/services/autoScheduler.js`

```javascript
// LINE 43 - Add userId parameter:
const generateVideoDirectly = async (userId, variation, niche, platforms, schedule) => {

// LINE 46 - Add userId:
const { videos } = await youtubeAnalytics.fetchAllVideoStats(userId);

// LINE 47 - Add userId:
const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);

// LINE 90 - Add userId:
await variationEngine.updateVariationStatus(userId, variation.id, 'generated', {

// LINE 104 - Add userId to YouTube upload:
postResult = await youtubeAPI.uploadToYouTubeAPI(userId, destPath, {

// LINE 112 - Add userId to TikTok upload:
postResult = await tiktokAPI.uploadToTikTokAPI(userId, destPath, {

// LINE 120 - Add userId to Facebook upload:
postResult = await facebookAPI.uploadToFacebookAPI(userId, destPath, {

// LINE 159 - Add userId parameter:
const generateAndPostPromotionalVideo = async (userId, schedule) => {

// LINE 183 - Add userId:
const { videos } = await youtubeAnalytics.fetchAllVideoStats(userId);

// LINE 185 - Add userId:
const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);

// LINE 268 - Add userId to YouTube upload:
postResult = await youtubeAPI.uploadToYouTubeAPI(userId, destPath, {

// LINE 276 - Add userId to TikTok upload:
postResult = await tiktokAPI.uploadToTikTokAPI(userId, destPath, {

// LINE 280 - Add userId to Facebook upload:
postResult = await facebookAPI.uploadToFacebookAPI(userId, destPath, {

// LINE 350 - Update function call:
await generateAndPostPromotionalVideo(userId, schedule);

// LINE 391 - Add userId:
const emotionMap = await viralIntelligence.analyzeEmotionsWithAI(userId, videos);

// LINE 420, 426 - Update function calls:
await generateVideoDirectly(userId, variation, niche, platforms, schedule);
```

### File 2: `trendscraper/src/modules/analytics/smart_topic_generator.js`

```javascript
// LINE 1012 - Remove extra userId parameter:
// BEFORE:
viralData = await viralIntelligence.analyzeForOutliers(userId, videos, emotionMap);

// AFTER:
viralData = await viralIntelligence.analyzeForOutliers(videos, emotionMap);
```

---

## ✅ TESTING CHECKLIST

After applying all P0 fixes:

### Test 1: Multi-Tenant Isolation
- [ ] Create User A with tech videos
- [ ] Create User B with cooking videos
- [ ] Generate smart topic for User B
- [ ] Verify topic uses only User B's emotion patterns (not User A's)

### Test 2: Auto-Posting
- [ ] Wait for auto-scheduler to run (or manually trigger)
- [ ] Check logs for "userId is required" errors (should be NONE)
- [ ] Verify video uploads succeed to YouTube/Facebook
- [ ] Check platforms for posted videos

### Test 3: Smart Topic Generation
- [ ] Call smart topic endpoint
- [ ] Verify no crashes
- [ ] Verify returned topics are valid and relevant

### Test 4: Database Fallback
- [ ] Stop PostgreSQL temporarily
- [ ] Trigger auto-scheduler
- [ ] Verify fallback path works without crashing
- [ ] Restart PostgreSQL

### Test 5: Token Refresh (After P1 Fix)
- [ ] Set token expiry to past time in database
- [ ] Try to upload video
- [ ] Verify token auto-refreshes
- [ ] Verify upload succeeds

---

## 📞 SUPPORT

**Questions about these fixes?**
- Each conflict has detailed explanation
- Code locations specified with line numbers
- Before/after examples provided
- Testing procedures included

**Need Help?**
- Reference conflict number (e.g., "Conflict #4")
- Check file and line number
- Review "Current Behavior" vs "Expected Behavior"
- Follow "Fix" section step-by-step

---

**Report Generated**: December 30, 2025
**Platform**: Viral Faceless Shorts Generator
**Analysis Depth**: Full codebase scan with cross-reference validation
**Critical Issues**: 4 MUST FIX NOW
**High Issues**: 3 FIX THIS WEEK
**Medium Issues**: 3 FIX THIS MONTH
