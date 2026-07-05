import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { generateText } from './llm.js';
import dataService from '../services/dataService.js';

const CACHE_PATH = '/app/data/viral_cache.json';
const CACHE_TTL = 1800000; // 30 minutes

/**
 * Viral Content Cloner
 *
 * Fetches viral content from TikTok, YouTube, Instagram, Facebook
 * Then uses Gemini to create unique versions aligned with your niche
 */

// Claude-backed adapter exposing the minimal Gemini-shaped interface the call sites
// below use: getGenerativeModel().generateContent(prompt) -> result.response.text().
// Provider lives in llm.js (claude-opus-4-8); the model argument is ignored.
const genAI = {
    getGenerativeModel: () => ({
        generateContent: async (prompt) => {
            const _text = await generateText(prompt);
            return { response: { text: () => _text } };
        }
    })
};

// ============================================
// TIKTOK VIRAL FETCHER
// ============================================

/**
 * Fetch viral TikTok videos from Creative Center
 */
export const fetchTikTokVirals = async (options = {}) => {
    const { region = 'US', industry = '', limit = 20 } = options;

    console.log('📱 Fetching viral TikTok content...');

    try {
        // Trending videos API
        const url = `https://ads.tiktok.com/creative_radar_api/v1/popular_trend/video/list?` +
            `page=1&limit=${limit}&period=7&country_code=${region}&sort_by=popular`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Referer': 'https://ads.tiktok.com/business/creativecenter/'
            }
        });

        const data = await response.json();

        if (data.code === 0 && data.data?.list) {
            const virals = data.data.list.map(item => ({
                platform: 'tiktok',
                videoId: item.video_id,
                description: item.video_desc || item.text,
                views: item.play_count,
                likes: item.digg_count,
                comments: item.comment_count,
                shares: item.share_count,
                duration: item.duration,
                author: item.author?.nick_name || item.author?.unique_id,
                hashtags: extractHashtags(item.video_desc || ''),
                hook: extractHook(item.video_desc || ''),
                coverUrl: item.cover_url,
                industry: item.industry_name
            }));

            console.log(`   ✅ Found ${virals.length} viral TikTok videos`);
            return { success: true, virals };
        }

        return { success: false, virals: [], error: 'API returned no data' };

    } catch (error) {
        console.log(`   ❌ TikTok fetch failed: ${error.message}`);
        return { success: false, virals: [], error: error.message };
    }
};

/**
 * Fetch trending TikTok sounds
 */
export const fetchTikTokSounds = async (options = {}) => {
    const { region = 'US', limit = 20 } = options;

    console.log('🎵 Fetching viral TikTok sounds...');

    try {
        const url = `https://ads.tiktok.com/creative_radar_api/v1/popular_trend/sound/list?` +
            `page=1&limit=${limit}&period=7&country_code=${region}&sort_by=popular`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        const data = await response.json();

        if (data.code === 0 && data.data?.list) {
            const sounds = data.data.list.map(item => ({
                platform: 'tiktok',
                soundId: item.sound_id,
                title: item.sound_title,
                artist: item.author,
                usageCount: item.usage_count,
                duration: item.duration,
                previewUrl: item.play_url,
                coverUrl: item.cover_url
            }));

            console.log(`   ✅ Found ${sounds.length} viral sounds`);
            return { success: true, sounds };
        }

        return { success: false, sounds: [] };

    } catch (error) {
        console.log(`   ❌ Sounds fetch failed: ${error.message}`);
        return { success: false, sounds: [], error: error.message };
    }
};

// ============================================
// YOUTUBE VIRAL FETCHER
// ============================================

/**
 * Fetch viral YouTube Shorts (requires API key)
 */
export const fetchYouTubeVirals = async (options = {}) => {
    const { query = 'shorts', maxResults = 20, niche = '' } = options;

    console.log('📺 Fetching viral YouTube Shorts...');

    const apiKey = process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_CLIENT_ID;

    if (!apiKey) {
        // Use trending page scraping as fallback
        return await scrapeYouTubeTrending(niche);
    }

    try {
        // Search for popular shorts in niche
        const searchQuery = niche ? `${niche} #shorts` : '#shorts';
        const url = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&type=video&videoDuration=short&order=viewCount` +
            `&maxResults=${maxResults}&q=${encodeURIComponent(searchQuery)}` +
            `&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.items) {
            // Get video statistics
            const videoIds = data.items.map(i => i.id.videoId).join(',');
            const statsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
                `part=statistics,contentDetails&id=${videoIds}&key=${apiKey}`;

            const statsResponse = await fetch(statsUrl);
            const statsData = await statsResponse.json();

            const statsMap = {};
            statsData.items?.forEach(item => {
                statsMap[item.id] = item.statistics;
            });

            const virals = data.items.map(item => ({
                platform: 'youtube',
                videoId: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                channel: item.snippet.channelTitle,
                publishedAt: item.snippet.publishedAt,
                thumbnail: item.snippet.thumbnails?.high?.url,
                views: parseInt(statsMap[item.id.videoId]?.viewCount || 0),
                likes: parseInt(statsMap[item.id.videoId]?.likeCount || 0),
                hook: extractHook(item.snippet.title),
                hashtags: extractHashtags(item.snippet.title + ' ' + item.snippet.description)
            }));

            console.log(`   ✅ Found ${virals.length} viral YouTube Shorts`);
            return { success: true, virals };
        }

        return { success: false, virals: [] };

    } catch (error) {
        console.log(`   ❌ YouTube fetch failed: ${error.message}`);
        return { success: false, virals: [], error: error.message };
    }
};

/**
 * Scrape YouTube trending (fallback)
 */
const scrapeYouTubeTrending = async (niche) => {
    try {
        // YouTube trending shorts page
        const url = 'https://www.youtube.com/feed/trending?bp=6gQJRkVzaG9ydHM%3D';

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const html = await response.text();

        // Extract video data from ytInitialData
        const dataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
        if (dataMatch) {
            const ytData = JSON.parse(dataMatch[1]);
            // Parse trending videos from the data structure
            // This is simplified - actual parsing would need to navigate the nested structure

            console.log('   ⚠️ YouTube scraping requires more complex parsing');
            return { success: false, virals: [], error: 'Scraping not fully implemented' };
        }

        return { success: false, virals: [] };

    } catch (error) {
        return { success: false, virals: [], error: error.message };
    }
};

// ============================================
// INSTAGRAM VIRAL FETCHER
// ============================================

/**
 * Fetch viral Instagram Reels (via Facebook Graph API)
 * @param {string} userId - User ID (required for multi-tenant)
 * @param {object} options - Fetch options
 */
export const fetchInstagramVirals = async (userId, options = {}) => {
    if (!userId) {
        return {
            success: false,
            virals: [],
            error: 'userId is required to fetch Instagram virals'
        };
    }

    const { hashtag = '', limit = 20 } = options;

    console.log(`📸 [User: ${userId}] Fetching viral Instagram Reels...`);

    try {
        // Load tokens from database
        const tokenData = await dataService.tokens.getToken(userId, 'instagram') ||
                          await dataService.tokens.getToken(userId, 'facebook');

        if (!tokenData) {
            return {
                success: false,
                virals: [],
                error: 'Facebook/Instagram not authorized. Connect via /facebook-api/auth first.'
            };
        }

        const accessToken = tokenData.metadata?.pageAccessToken || tokenData.accessToken;

        if (!accessToken) {
            return { success: false, virals: [], error: 'No access token found' };
        }

        // Search hashtag media (requires Instagram Graph API)
        // Note: This requires additional permissions
        const igAccountId = tokenData.metadata?.instagramAccountId;

        if (!igAccountId) {
            return {
                success: false,
                virals: [],
                error: 'Instagram account not linked. Connect via /instagram-api/account-id first.'
            };
        }

        // Get recent hashtag media
        if (hashtag) {
            const hashtagUrl = `https://graph.facebook.com/v19.0/ig_hashtag_search?` +
                `user_id=${igAccountId}&q=${hashtag}&access_token=${accessToken}`;

            const hashtagRes = await fetch(hashtagUrl);
            const hashtagData = await hashtagRes.json();

            if (hashtagData.data?.[0]?.id) {
                const hashtagId = hashtagData.data[0].id;

                // Get top media for this hashtag
                const mediaUrl = `https://graph.facebook.com/v19.0/${hashtagId}/top_media?` +
                    `user_id=${igAccountId}&fields=id,caption,media_type,permalink,like_count,comments_count` +
                    `&access_token=${accessToken}`;

                const mediaRes = await fetch(mediaUrl);
                const mediaData = await mediaRes.json();

                if (mediaData.data) {
                    const virals = mediaData.data
                        .filter(m => m.media_type === 'VIDEO' || m.media_type === 'REELS')
                        .map(item => ({
                            platform: 'instagram',
                            mediaId: item.id,
                            caption: item.caption,
                            permalink: item.permalink,
                            likes: item.like_count,
                            comments: item.comments_count,
                            hook: extractHook(item.caption || ''),
                            hashtags: extractHashtags(item.caption || '')
                        }));

                    console.log(`   ✅ Found ${virals.length} viral Instagram Reels`);
                    return { success: true, virals };
                }
            }
        }

        return { success: false, virals: [], error: 'Could not fetch Instagram virals' };

    } catch (error) {
        console.log(`   ❌ Instagram fetch failed: ${error.message}`);
        return { success: false, virals: [], error: error.message };
    }
};

// ============================================
// FACEBOOK VIRAL FETCHER
// ============================================

/**
 * Fetch viral Facebook Reels
 * @param {string} userId - User ID (required for multi-tenant)
 * @param {object} options - Fetch options
 */
export const fetchFacebookVirals = async (userId, options = {}) => {
    if (!userId) {
        return {
            success: false,
            virals: [],
            error: 'userId is required to fetch Facebook virals'
        };
    }

    const { limit = 20 } = options;

    console.log(`👥 [User: ${userId}] Fetching viral Facebook Reels...`);

    try {
        // Load tokens from database
        const tokenData = await dataService.tokens.getToken(userId, 'facebook');

        if (!tokenData) {
            return { success: false, virals: [], error: 'Facebook not authorized. Connect via /facebook-api/auth first.' };
        }

        const accessToken = tokenData.metadata?.pageAccessToken || tokenData.accessToken;
        const pageId = tokenData.metadata?.pageId;

        if (!accessToken || !pageId) {
            return { success: false, virals: [], error: 'Missing Facebook credentials' };
        }

        // Get page's video insights (can only access own page data)
        // Facebook doesn't provide public trending reels API
        const url = `https://graph.facebook.com/v19.0/${pageId}/videos?` +
            `fields=id,title,description,length,views,likes.summary(true),comments.summary(true)` +
            `&limit=${limit}&access_token=${accessToken}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.data) {
            const virals = data.data.map(item => ({
                platform: 'facebook',
                videoId: item.id,
                title: item.title,
                description: item.description,
                duration: item.length,
                views: item.views,
                likes: item.likes?.summary?.total_count || 0,
                comments: item.comments?.summary?.total_count || 0,
                hook: extractHook(item.title || item.description || ''),
                hashtags: extractHashtags(item.description || '')
            }));

            console.log(`   ✅ Found ${virals.length} Facebook videos`);
            return { success: true, virals };
        }

        return { success: false, virals: [] };

    } catch (error) {
        console.log(`   ❌ Facebook fetch failed: ${error.message}`);
        return { success: false, virals: [], error: error.message };
    }
};

// ============================================
// GEMINI CONTENT CLONER
// ============================================

/**
 * Use Gemini to create a unique version of viral content
 */
export const cloneViralContent = async (viralPost, options = {}) => {
    const { niche = 'general', style = 'educational', avoidCopy = true } = options;

    console.log('🤖 Generating unique version with Gemini...');

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `You are a viral content strategist. Analyze this viral post and create a COMPLETELY UNIQUE version that captures the same psychological triggers but with original content.

VIRAL POST ANALYSIS:
- Platform: ${viralPost.platform}
- Hook/Title: ${viralPost.hook || viralPost.title || viralPost.description?.substring(0, 100)}
- Views: ${formatNumber(viralPost.views)}
- Likes: ${formatNumber(viralPost.likes)}
- Description: ${viralPost.description || 'N/A'}
- Hashtags: ${viralPost.hashtags?.join(', ') || 'N/A'}

YOUR TASK:
Create a unique video concept for the "${niche}" niche that:
1. Uses the SAME psychological trigger (curiosity gap, controversy, transformation, etc.)
2. Has a DIFFERENT topic/angle (don't copy the exact subject)
3. Matches our style: ${style}
4. Is optimized for short-form video (30-90 seconds)

${avoidCopy ? 'IMPORTANT: Do NOT copy the content. Create something inspired by it but totally original.' : ''}

Respond in this JSON format:
{
    "originalAnalysis": {
        "psychologicalTrigger": "what made it viral",
        "hookType": "question/shock/story/list/controversy",
        "emotionalAppeal": "curiosity/fear/aspiration/etc"
    },
    "newConcept": {
        "topic": "your unique topic",
        "hook": "attention-grabbing first line",
        "angle": "your unique angle on the topic",
        "keyPoints": ["point 1", "point 2", "point 3"],
        "callToAction": "ending CTA",
        "estimatedDuration": "30-60s"
    },
    "seoOptimization": {
        "title": "video title with keywords",
        "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4"],
        "description": "platform description"
    },
    "viralPotential": {
        "score": 8,
        "reasoning": "why this will perform well"
    }
}`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const clonedContent = JSON.parse(jsonMatch[0]);
            console.log(`   ✅ Generated unique content: "${clonedContent.newConcept.topic}"`);
            return {
                success: true,
                original: viralPost,
                cloned: clonedContent
            };
        }

        throw new Error('Could not parse Gemini response');

    } catch (error) {
        console.log(`   ❌ Clone failed: ${error.message}`);
        return { success: false, error: error.message };
    }
};

/**
 * Batch clone multiple viral posts
 */
export const batchCloneVirals = async (virals, options = {}) => {
    const { niche = 'general', limit = 5 } = options;

    console.log(`🔄 Batch cloning ${Math.min(virals.length, limit)} viral posts...`);

    const results = [];
    const toProcess = virals.slice(0, limit);

    for (const viral of toProcess) {
        const result = await cloneViralContent(viral, { niche });
        if (result.success) {
            results.push(result.cloned);
        }
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`   ✅ Successfully cloned ${results.length} concepts`);
    return { success: true, concepts: results };
};

// ============================================
// UNIFIED VIRAL DISCOVERY
// ============================================

/**
 * Fetch virals from all platforms and generate unique content ideas
 * @param {string} userId - User ID (required for authenticated platforms)
 * @param {object} options - Discovery options
 */
export const discoverAndClone = async (userId, options = {}) => {
    const {
        niche = 'general',
        platforms = ['tiktok', 'youtube'],
        limit = 10,
        cloneTop = 5
    } = options;

    console.log(`🚀 [User: ${userId}] Starting viral discovery and cloning...`);
    console.log(`   Niche: ${niche}`);
    console.log(`   Platforms: ${platforms.join(', ')}`);

    const allVirals = [];

    // Fetch from each platform
    if (platforms.includes('tiktok')) {
        const tiktok = await fetchTikTokVirals({ limit });
        if (tiktok.success) allVirals.push(...tiktok.virals);
    }

    if (platforms.includes('youtube')) {
        const youtube = await fetchYouTubeVirals({ niche, maxResults: limit });
        if (youtube.success) allVirals.push(...youtube.virals);
    }

    if (platforms.includes('instagram')) {
        const instagram = await fetchInstagramVirals(userId, { limit });
        if (instagram.success) allVirals.push(...instagram.virals);
    }

    if (platforms.includes('facebook')) {
        const facebook = await fetchFacebookVirals(userId, { limit });
        if (facebook.success) allVirals.push(...facebook.virals);
    }

    console.log(`   📊 Total virals found: ${allVirals.length}`);

    if (allVirals.length === 0) {
        return { success: false, error: 'No viral content found' };
    }

    // Sort by views and take top performers
    const topVirals = allVirals
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, cloneTop);

    // Clone top performers
    const cloned = await batchCloneVirals(topVirals, { niche });

    return {
        success: true,
        discovered: allVirals.length,
        topVirals: topVirals.map(v => ({
            platform: v.platform,
            hook: v.hook || v.title,
            views: formatNumber(v.views),
            likes: formatNumber(v.likes)
        })),
        concepts: cloned.concepts,
        readyToGenerate: cloned.concepts.map(c => ({
            topic: c.newConcept.topic,
            hook: c.newConcept.hook,
            viralScore: c.viralPotential.score
        }))
    };
};

/**
 * Generate video from cloned concept
 */
export const generateFromConcept = async (concept, options = {}) => {
    const { niche = 'general' } = options;

    // This returns the topic in a format ready for /create-full-video
    return {
        topic: concept.newConcept.topic,
        niche: niche,
        metadata: {
            title: concept.seoOptimization.title,
            description: concept.seoOptimization.description,
            hashtags: concept.seoOptimization.hashtags
        },
        hook: concept.newConcept.hook,
        keyPoints: concept.newConcept.keyPoints,
        cta: concept.newConcept.callToAction
    };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract hashtags from text
 */
const extractHashtags = (text) => {
    const matches = text.match(/#[\w\u0080-\uFFFF]+/g) || [];
    return [...new Set(matches)].slice(0, 10);
};

/**
 * Extract hook (first sentence or attention grabber)
 */
const extractHook = (text) => {
    if (!text) return '';

    // Get first line or sentence
    const firstLine = text.split(/[\n.!?]/)[0].trim();

    // Limit to reasonable length
    if (firstLine.length > 150) {
        return firstLine.substring(0, 150) + '...';
    }

    return firstLine;
};

/**
 * Format large numbers
 */
const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
};

/**
 * Save discovered virals to cache
 */
const saveToCache = (data) => {
    try {
        const dir = path.dirname(CACHE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CACHE_PATH, JSON.stringify({
            timestamp: Date.now(),
            data
        }, null, 2));
    } catch (e) {
        console.log('   Cache save error:', e.message);
    }
};

export default {
    // Fetchers
    fetchTikTokVirals,
    fetchTikTokSounds,
    fetchYouTubeVirals,
    fetchInstagramVirals,
    fetchFacebookVirals,

    // Cloning
    cloneViralContent,
    batchCloneVirals,

    // Unified
    discoverAndClone,
    generateFromConcept
};
