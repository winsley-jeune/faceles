# Disable Dev Mode - Fix Authentication Issues

## The Problem

You're being automatically logged in with a **fake "Dev User"** because Dev Mode is enabled on localhost.

**What Dev Mode does:**
- Automatically logs you in with a fake user: `dev@viralshorts.test`
- Lets you access the dashboard without OAuth
- But this fake user has NO real JWT token
- So protected API endpoints return 401 Unauthorized

**Evidence in your console:**
```
⚠️ DEV MODE: Auto-login enabled (localhost + explicit opt-in)
   To disable: localStorage.removeItem("__ALLOW_DEV_MODE__")
```

---

## How to Fix - Disable Dev Mode

### Option 1: Browser Console (Quick Fix)

1. Open your browser console (F12)
2. Go to the **Console** tab
3. Run this command:
   ```javascript
   localStorage.setItem('__DISABLE_DEV_MODE__', 'true')
   ```
4. Refresh the page (F5)
5. Dev mode is now disabled!

---

### Option 2: Check & Disable via Console

1. Open browser console (F12)
2. Check if dev mode is enabled:
   ```javascript
   console.log('Dev mode disabled?', localStorage.getItem('__DISABLE_DEV_MODE__'))
   ```
3. If it returns `null`, dev mode is active
4. Disable it:
   ```javascript
   localStorage.setItem('__DISABLE_DEV_MODE__', 'true')
   location.reload()
   ```

---

## What Happens After Disabling

1. **Page reloads**
2. **You're logged out** (fake dev user removed)
3. **You'll be redirected to login page**
4. **You can now log in with real OAuth**:
   - Google
   - Facebook
   - TikTok
5. **After real login, Jobs page will work!**

---

## Verify Dev Mode is Disabled

After disabling and refreshing:

1. Open console (F12)
2. Look for this message:
   ```
   ⚠️ DEV MODE: Auto-login enabled...
   ```
3. If you DON'T see it = Dev mode is disabled ✅
4. If you DO see it = Dev mode is still active ❌

---

## Re-Enable Dev Mode (If Needed)

If you want dev mode back later:

```javascript
localStorage.removeItem('__DISABLE_DEV_MODE__')
location.reload()
```

---

## Complete Login Flow After Disabling

1. **Disable dev mode** (steps above)
2. **Go to**: http://localhost:5174/login
3. **Click**: "Continue with Google" (or Facebook/TikTok)
4. **Complete OAuth flow**
5. **You're redirected back to dashboard**
6. **Navigate to Jobs tab**
7. **Jobs page now works!** ✅

---

## Why Does Dev Mode Exist?

Dev mode is useful for:
- Quick testing without OAuth setup
- Developing UI without backend
- Skipping login during development

But it **breaks protected endpoints** because the fake user has no real JWT token.

---

## Summary

**Current State:**
- ❌ Dev mode auto-login with fake user
- ❌ No real JWT token
- ❌ 401 errors on Jobs page

**After Fix:**
- ✅ Dev mode disabled
- ✅ Real OAuth login
- ✅ Real JWT token
- ✅ Jobs page works!

**Quick Fix Command:**
```javascript
localStorage.setItem('__DISABLE_DEV_MODE__', 'true'); location.reload()
```

Run this in your browser console, then log in with Google/Facebook/TikTok!
