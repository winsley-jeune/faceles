/**
 * Auto-Poster (API-only, multi-tenant)
 *
 * Posts videos to platforms via their OFFICIAL APIs (through unified_uploader),
 * scoped to a userId so the correct tenant's OAuth tokens are used.
 *
 * Browser-automation login/session (Playwright) has been removed. Connecting a
 * platform is done via OAuth at the /{platform}-api/auth endpoints, not a backend
 * "login". NOTE: the JSON queue/history below is process-global legacy state; the
 * modern per-user scheduling path is services/autoScheduler.js + the job queue.
 */
import fs from 'fs';
import path from 'path';

import { generateAllPlatformsContent } from './social_content.js';
import unifiedUploader from './unified_uploader.js';
import { checkYouTubeAPIStatus } from './uploaders/youtube_api_uploader.js';
import { checkTikTokAPIStatus } from './uploaders/tiktok_api_uploader.js';
import { checkInstagramAPIStatus } from './uploaders/instagram_api_uploader.js';
import { checkFacebookAPIStatus } from './uploaders/facebook_api_uploader.js';

const QUEUE_PATH = '/app/data/post_queue.json';
const HISTORY_PATH = '/app/data/post_history.json';
const SETTINGS_PATH = '/app/data/poster_settings.json';

const DEFAULT_POSTING_TIMES = ['09:00', '18:00'];

const loadJSON = (filepath, defaultValue = []) => {
    try {
        if (fs.existsSync(filepath)) return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch (e) {
        console.warn(`[auto_poster] Failed to load JSON from ${filepath}: ${e.message}`);
    }
    return defaultValue;
};

const saveJSON = (filepath, data) => {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
};

export const getSettings = () => loadJSON(SETTINGS_PATH, {
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

export const saveSettings = (settings) => { saveJSON(SETTINGS_PATH, settings); return settings; };

/** Add a video to the posting queue (records the owning userId). */
export const addToQueue = async (userId, videoPath, topic, niche) => {
    if (!userId) throw new Error('auto_poster.addToQueue: userId is required');
    const platformContent = await generateAllPlatformsContent(topic, niche);
    const queueItem = {
        id: Date.now().toString(),
        userId, videoPath, topic, niche,
        content: platformContent,
        addedAt: new Date().toISOString(),
        status: 'pending',
        posts: {}
    };
    const queue = loadJSON(QUEUE_PATH, []);
    queue.push(queueItem);
    saveJSON(QUEUE_PATH, queue);
    console.log(`   ✅ [${userId}] Added to queue: ${topic}`);
    return queueItem;
};

export const getQueue = () => loadJSON(QUEUE_PATH, []);
export const getHistory = () => loadJSON(HISTORY_PATH, []);

/** Post one queue item to a single platform via the official API. */
export const postToPlatform = async (userId, queueItem, platform) => {
    if (!userId) throw new Error('auto_poster.postToPlatform: userId is required');
    const content = queueItem.content?.[platform];
    if (!content) return { success: false, error: 'No content generated for platform' };

    return unifiedUploader.upload(userId, platform, queueItem.videoPath, {
        title: content.title,
        description: content.fullCaption,
        caption: content.fullCaption,
        hashtags: content.hashtags
    });
};

/** Post one queue item to all platforms enabled in settings. */
export const postToAllPlatforms = async (userId, queueItem) => {
    if (!userId) throw new Error('auto_poster.postToAllPlatforms: userId is required');
    const settings = getSettings();
    const results = {};

    for (const [platform, config] of Object.entries(settings.platforms)) {
        if (config.enabled && config.autoPost) {
            results[platform] = await postToPlatform(userId, queueItem, platform);
            await new Promise((r) => setTimeout(r, 3000));
        }
    }

    const queue = loadJSON(QUEUE_PATH, []);
    const i = queue.findIndex((q) => q.id === queueItem.id);
    if (i !== -1) {
        queue[i].posts = results;
        queue[i].status = 'posted';
        queue[i].postedAt = new Date().toISOString();
        saveJSON(QUEUE_PATH, queue);
    }

    const history = loadJSON(HISTORY_PATH, []);
    history.unshift({ ...queueItem, posts: results, postedAt: new Date().toISOString() });
    saveJSON(HISTORY_PATH, history.slice(0, 100));

    return results;
};

/** Process the next pending item owned by this user. */
export const processNextInQueue = async (userId) => {
    if (!userId) throw new Error('auto_poster.processNextInQueue: userId is required');
    const queue = loadJSON(QUEUE_PATH, []);
    const pendingItem = queue.find((q) => q.status === 'pending' && q.userId === userId);
    if (!pendingItem) {
        console.log(`📭 [${userId}] No pending items in queue`);
        return null;
    }
    const results = await postToAllPlatforms(userId, pendingItem);
    return { item: pendingItem, results };
};

/** Check which platforms this user has connected (via OAuth / official API). */
export const checkConnections = async (userId) => {
    if (!userId) throw new Error('auto_poster.checkConnections: userId is required');
    return {
        youtube: await checkYouTubeAPIStatus(userId).catch((e) => ({ connected: false, error: e.message })),
        tiktok: await checkTikTokAPIStatus(userId).catch((e) => ({ connected: false, error: e.message })),
        instagram: await checkInstagramAPIStatus(userId).catch((e) => ({ connected: false, error: e.message })),
        facebook: await checkFacebookAPIStatus(userId).catch((e) => ({ connected: false, error: e.message }))
    };
};

/** Post immediately to all enabled platforms for a user. */
export const postNow = async (userId, videoPath, topic, niche) => {
    if (!userId) throw new Error('auto_poster.postNow: userId is required');
    const queueItem = await addToQueue(userId, videoPath, topic, niche);
    return postToAllPlatforms(userId, queueItem);
};

export default {
    getSettings,
    saveSettings,
    addToQueue,
    getQueue,
    getHistory,
    postToPlatform,
    postToAllPlatforms,
    processNextInQueue,
    checkConnections,
    postNow
};
