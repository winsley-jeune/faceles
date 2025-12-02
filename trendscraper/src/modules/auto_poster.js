import fs from 'fs';
import path from 'path';
import schedule from 'node-schedule';

import { generateAllPlatformsContent } from './social_content.js';
import { uploadToYouTube, youtubeLogin, checkYouTubeSession } from './uploaders/youtube_uploader.js';
import { uploadToTikTok, tiktokLogin, checkTikTokSession } from './uploaders/tiktok_uploader.js';
import { uploadToInstagram, instagramLogin, checkInstagramSession } from './uploaders/instagram_uploader.js';
import { uploadToFacebook, facebookLogin, checkFacebookSession } from './uploaders/facebook_uploader.js';

/**
 * Auto-Poster Module
 * Automatically posts videos to TikTok, Instagram, YouTube Shorts, and Facebook Reels
 * Supports 2x daily posting schedule
 */

const QUEUE_PATH = '/app/data/post_queue.json';
const HISTORY_PATH = '/app/data/post_history.json';
const SETTINGS_PATH = '/app/data/poster_settings.json';

// Default posting times (24h format)
const DEFAULT_POSTING_TIMES = ['09:00', '18:00']; // 9 AM and 6 PM

/**
 * Load/Save helper functions
 */
const loadJSON = (filepath, defaultValue = []) => {
    try {
        if (fs.existsSync(filepath)) {
            return JSON.parse(fs.readFileSync(filepath, 'utf8'));
        }
    } catch { }
    return defaultValue;
};

const saveJSON = (filepath, data) => {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
};

/**
 * Get settings
 */
export const getSettings = () => {
    return loadJSON(SETTINGS_PATH, {
        enabled: false,
        postingTimes: DEFAULT_POSTING_TIMES,
        platforms: {
            youtube: { enabled: true, autoPost: true },
            tiktok: { enabled: true, autoPost: true },
            instagram: { enabled: true, autoPost: true },
            facebook: { enabled: true, autoPost: true }
        },
        timezone: 'America/New_York'
    });
};

export const saveSettings = (settings) => {
    saveJSON(SETTINGS_PATH, settings);
};

/**
 * Add video to posting queue
 */
export const addToQueue = async (videoPath, topic, niche) => {
    console.log('📋 Adding video to posting queue...');

    // Generate platform-specific content
    const platformContent = await generateAllPlatformsContent(topic, niche);

    const queueItem = {
        id: Date.now().toString(),
        videoPath,
        topic,
        niche,
        content: platformContent,
        addedAt: new Date().toISOString(),
        status: 'pending',
        posts: {}
    };

    const queue = loadJSON(QUEUE_PATH, []);
    queue.push(queueItem);
    saveJSON(QUEUE_PATH, queue);

    console.log(`   ✅ Added to queue: ${topic}`);
    return queueItem;
};

/**
 * Get posting queue
 */
export const getQueue = () => loadJSON(QUEUE_PATH, []);

/**
 * Get posting history
 */
export const getHistory = () => loadJSON(HISTORY_PATH, []);

/**
 * Post to a single platform
 * Uses SEO-optimized content from social_content.js (Money Printer strategy)
 */
export const postToPlatform = async (queueItem, platform) => {
    const content = queueItem.content[platform];
    if (!content) {
        return { success: false, error: 'No content generated for platform' };
    }

    console.log(`📤 Posting to ${platform}...`);
    console.log(`   📋 Title: ${content.title}`);
    console.log(`   #️⃣ Tags: ${content.hashtagString}`);

    let result;
    switch (platform) {
        case 'youtube':
            // YouTube: Uses CAPS title format + emoji + #Shorts
            result = await uploadToYouTube(queueItem.videoPath, {
                title: content.title,
                description: content.fullCaption,
                hashtags: content.hashtags
            });
            break;
        case 'tiktok':

            result = await uploadToTikTok(queueItem.videoPath, {
                title: content.title,
                description: content.fullCaption,
                hashtags: content.hashtags
            });
            break;
        case 'instagram':

            result = await uploadToInstagram(queueItem.videoPath, {
                description: content.fullCaption,
                hashtags: content.hashtags
            });
            break;
        case 'facebook':
            result = await uploadToFacebook(queueItem.videoPath, {
                description: content.fullCaption,
                hashtags: content.hashtags,
                pinnedComment: content.pinnedComment
            });
            break;
        default:
            result = { success: false, error: 'Unknown platform' };
    }

    return result;
};

/**
 * Post to all enabled platforms
 */
export const postToAllPlatforms = async (queueItem) => {
    const settings = getSettings();
    const results = {};

    for (const [platform, config] of Object.entries(settings.platforms)) {
        if (config.enabled && config.autoPost) {
            results[platform] = await postToPlatform(queueItem, platform);
            // Small delay between platforms
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    // Update queue item status
    const queue = loadJSON(QUEUE_PATH, []);
    const itemIndex = queue.findIndex(q => q.id === queueItem.id);
    if (itemIndex !== -1) {
        queue[itemIndex].posts = results;
        queue[itemIndex].status = 'posted';
        queue[itemIndex].postedAt = new Date().toISOString();
        saveJSON(QUEUE_PATH, queue);
    }

    // Add to history
    const history = loadJSON(HISTORY_PATH, []);
    history.unshift({
        ...queueItem,
        posts: results,
        postedAt: new Date().toISOString()
    });
    saveJSON(HISTORY_PATH, history.slice(0, 100)); // Keep last 100

    return results;
};

/**
 * Process next item in queue
 */
export const processNextInQueue = async () => {
    const queue = loadJSON(QUEUE_PATH, []);
    const pendingItem = queue.find(q => q.status === 'pending');

    if (!pendingItem) {
        console.log('📭 No pending items in queue');
        return null;
    }

    console.log(`🚀 Processing queue item: ${pendingItem.topic}`);
    const results = await postToAllPlatforms(pendingItem);

    return { item: pendingItem, results };
};

/**
 * Check all platform sessions
 */
export const checkAllSessions = async () => {
    console.log('🔍 Checking platform sessions...');

    const results = {
        youtube: await checkYouTubeSession(),
        tiktok: await checkTikTokSession(),
        instagram: await checkInstagramSession(),
        facebook: await checkFacebookSession()
    };

    for (const [platform, status] of Object.entries(results)) {
        const icon = status.valid ? '✅' : '❌';
        console.log(`   ${icon} ${platform}: ${status.message}`);
    }

    return results;
};

/**
 * Login to a specific platform
 */
export const loginToPlatform = async (platform) => {
    switch (platform) {
        case 'youtube': return await youtubeLogin();
        case 'tiktok': return await tiktokLogin();
        case 'instagram': return await instagramLogin();
        case 'facebook': return await facebookLogin();
        default: return { success: false, error: 'Unknown platform' };
    }
};

/**
 * Login to all platforms
 */
export const loginToAllPlatforms = async () => {
    console.log('🔐 Starting login process for all platforms...');
    console.log('   A browser window will open for each platform.');
    console.log('   Complete the login in each window.\n');

    const results = {};
    const platforms = ['youtube', 'tiktok', 'instagram', 'facebook'];

    for (const platform of platforms) {
        console.log(`\n--- ${platform.toUpperCase()} ---`);
        results[platform] = await loginToPlatform(platform);
        await new Promise(r => setTimeout(r, 2000));
    }

    return results;
};

// Scheduled jobs storage
let scheduledJobs = [];

/**
 * Start the auto-posting scheduler
 */
export const startScheduler = () => {
    const settings = getSettings();

    if (!settings.enabled) {
        console.log('⏸️ Auto-posting is disabled');
        return;
    }

    // Clear existing jobs
    scheduledJobs.forEach(job => job.cancel());
    scheduledJobs = [];

    console.log('⏰ Starting auto-post scheduler...');

    settings.postingTimes.forEach(time => {
        const [hour, minute] = time.split(':').map(Number);

        const job = schedule.scheduleJob({ hour, minute, tz: settings.timezone }, async () => {
            console.log(`\n⏰ Scheduled post time: ${time}`);
            await processNextInQueue();
        });

        scheduledJobs.push(job);
        console.log(`   📅 Scheduled: ${time} (${settings.timezone})`);
    });

    return scheduledJobs;
};

/**
 * Stop the scheduler
 */
export const stopScheduler = () => {
    scheduledJobs.forEach(job => job.cancel());
    scheduledJobs = [];
    console.log('⏹️ Scheduler stopped');
};

/**
 * Manual post - post immediately to all platforms
 */
export const postNow = async (videoPath, topic, niche) => {
    console.log('🚀 Posting immediately to all platforms...');

    // Add to queue first
    const queueItem = await addToQueue(videoPath, topic, niche);

    // Post to all platforms
    const results = await postToAllPlatforms(queueItem);

    console.log('\n📊 Posting Results:');
    for (const [platform, result] of Object.entries(results)) {
        const icon = result.success ? '✅' : '❌';
        console.log(`   ${icon} ${platform}: ${result.success ? 'Posted!' : result.error}`);
    }

    return results;
};

export default {
    addToQueue,
    getQueue,
    getHistory,
    postToPlatform,
    postToAllPlatforms,
    processNextInQueue,
    checkAllSessions,
    loginToPlatform,
    loginToAllPlatforms,
    startScheduler,
    stopScheduler,
    postNow,
    getSettings,
    saveSettings
};
