# Instagram Business Account Setup Guide

## Error Message
```
❌ Failed to get Instagram account: No Instagram Business Account linked to this Facebook Page
```

## Why This Happens
Instagram API integration requires:
1. A **Facebook Page** (not personal profile)
2. An **Instagram Business Account** (not personal account)
3. The Instagram Business Account must be **linked** to your Facebook Page

## How to Fix

### Step 1: Convert Instagram to Business Account

1. Open Instagram app on mobile
2. Go to your profile → Menu (☰) → Settings → Account
3. Tap "Switch to Professional Account"
4. Choose "Business" (not Creator)
5. Complete the setup

### Step 2: Link Instagram to Facebook Page

**Option A: Via Instagram App (Recommended)**

1. Instagram app → Profile → Menu (☰) → Settings
2. Tap "Account" → "Linked accounts"
3. Select "Facebook"
4. Login to Facebook if needed
5. **Select the correct Facebook Page** to link to
6. Grant permissions

**Option B: Via Facebook Business Settings**

1. Go to [Facebook Business Manager](https://business.facebook.com)
2. Select your business
3. Click "Settings" → "Instagram accounts"
4. Click "Add" → "Connect Instagram account"
5. Login to Instagram
6. Select the account to connect

### Step 3: Verify Page Settings

1. Go to your [Facebook Page](https://www.facebook.com/pages)
2. Click "Settings" (left sidebar)
3. Click "Linked Accounts" or "Instagram"
4. Verify Instagram Business Account is shown as connected
5. Make sure the account has "Full Control" permissions

### Step 4: Grant App Permissions

After linking, you need to grant your Facebook App access:

1. Go to [Facebook App Dashboard](https://developers.facebook.com/apps)
2. Select your app (ID: 1511679313241633)
3. Click "Add Product" → Find "Instagram Basic Display" or "Instagram Graph API"
4. Complete the setup wizard
5. Request permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
   - `pages_manage_posts`

### Step 5: Test Connection

After setup, test in your dashboard:

1. Go to Dashboard → Social Connections
2. Click "Connect Instagram"
3. Or use the "Publish" page to check Instagram status

## Verification Checklist

✅ Instagram account is a Business Account (not Personal)
✅ Facebook Page exists (not personal profile)
✅ Instagram Business Account is linked to Facebook Page
✅ App has Instagram Graph API product added
✅ Proper permissions granted (instagram_content_publish, pages_manage_posts)
✅ Access token has not expired

## Common Issues

### "Account not found"
- Make sure you selected a **Business Account**, not Creator
- Wait 24 hours after converting to Business (Instagram processing time)

### "Permission denied"
- Re-authenticate Facebook OAuth
- Check App Review status (some permissions require Facebook approval)

### "Cannot publish to Instagram"
- Instagram Container requirements:
  - Image: JPEG, max 8MB, aspect ratio 4:5 to 1.91:1
  - Video: MP4, max 100MB, max 60s, aspect ratio 4:5 to 1.91:1 (shorts: 9:16)
- Make sure caption is under 2,200 characters

## Testing Command

After setup, test from terminal:

```bash
# Check Instagram connection status
curl http://localhost:3000/instagram-api/status

# Expected response (when working):
{
  "connected": true,
  "username": "your_username",
  "account_type": "BUSINESS"
}
```

## Support Links

- [Instagram Business Account Setup](https://help.instagram.com/502981923235522)
- [Link Instagram to Facebook Page](https://www.facebook.com/business/help/connect-instagram-to-page)
- [Instagram Graph API Docs](https://developers.facebook.com/docs/instagram-api)
- [Facebook Business Manager](https://business.facebook.com)

## Need Help?

If you continue to see errors after following these steps:

1. Check logs: `docker-compose logs -f trendscraper | grep -i instagram`
2. Verify Facebook App ID is correct in .env: `FACEBOOK_APP_ID=1511679313241633`
3. Re-authenticate via Dashboard → Social Connections
4. Check Facebook App Review status (Business verification may be required)

---

**Note**: Instagram API has strict rate limits. After setup:
- Stories: 25 per day
- Feed posts: No official limit, but throttling applies
- Avoid rapid consecutive posts (use scheduling)
