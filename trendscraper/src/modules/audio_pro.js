import fs from "fs";
import path from "path";
import fetch from "node-fetch";

// Expanded royalty-free background music library
// Multiple tracks per mood category for variety
const MUSIC_LIBRARY = {
    // Dramatic/Dark category - for conspiracy, mystery content
    dramatic: [
        {
            name: "Dark Ambient 1",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            bpm: 90,
            mood: "tense, mysterious, conspiracy"
        },
        {
            name: "Dark Ambient 2",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
            bpm: 85,
            mood: "dark, brooding, atmospheric"
        },
        {
            name: "Cinematic Dark",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3",
            bpm: 95,
            mood: "cinematic, intense, dramatic"
        }
    ],
    // Epic/Inspiring category - for wealth, success content
    epic: [
        {
            name: "Epic Background",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
            bpm: 120,
            mood: "powerful, dramatic, inspiring"
        },
        {
            name: "Motivational Rise",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
            bpm: 115,
            mood: "uplifting, triumphant, motivational"
        },
        {
            name: "Cinematic Epic",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3",
            bpm: 125,
            mood: "grand, heroic, cinematic"
        }
    ],
    // Suspense category - for thriller, forbidden content
    suspense: [
        {
            name: "Suspenseful Beat",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
            bpm: 85,
            mood: "thriller, dark, building tension"
        },
        {
            name: "Tension Build",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3",
            bpm: 80,
            mood: "suspenseful, creeping, anxious"
        },
        {
            name: "Mystery Pulse",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3",
            bpm: 90,
            mood: "mysterious, pulsing, intriguing"
        }
    ],
    // Tech/Electronic category - for technology, AI content
    tech: [
        {
            name: "Electronic",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
            bpm: 128,
            mood: "electronic, futuristic, tech"
        },
        {
            name: "Digital Pulse",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
            bpm: 130,
            mood: "digital, modern, innovative"
        },
        {
            name: "Cyber Groove",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3",
            bpm: 125,
            mood: "cyberpunk, electronic, edgy"
        }
    ],
    // News/Urgent category - for breaking news, urgent content
    news: [
        {
            name: "Upbeat News",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
            bpm: 110,
            mood: "urgent, news, alert"
        },
        {
            name: "Breaking Update",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
            bpm: 115,
            mood: "urgent, informative, attention-grabbing"
        },
        {
            name: "News Pulse",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3",
            bpm: 105,
            mood: "professional, news, dynamic"
        }
    ],
    // Upbeat/Friendly category - for lifestyle, howto content
    upbeat: [
        {
            name: "Positive Vibes",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
            bpm: 120,
            mood: "happy, positive, friendly"
        },
        {
            name: "Cheerful Energy",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3",
            bpm: 118,
            mood: "cheerful, energetic, light"
        }
    ],
    // Calm/Relaxing category - for wellness, psychology content
    calm: [
        {
            name: "Peaceful Ambient",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
            bpm: 70,
            mood: "calm, peaceful, meditative"
        },
        {
            name: "Gentle Flow",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
            bpm: 75,
            mood: "soothing, gentle, relaxing"
        }
    ]
};

// Expanded content-to-music mapping
const CONTENT_TO_MUSIC = {
    // Dramatic/Mystery
    conspiracy: 'dramatic',
    mystery: 'dramatic',
    secret: 'dramatic',
    hidden: 'dramatic',

    // Epic/Inspiring
    wealth: 'epic',
    success: 'epic',
    money: 'epic',
    motivation: 'epic',
    business: 'epic',

    // Suspense
    scandal: 'suspense',
    forbidden: 'suspense',
    danger: 'suspense',
    warning: 'suspense',

    // Tech
    tech: 'tech',
    ai: 'tech',
    crypto: 'tech',
    future: 'tech',
    science: 'tech',

    // News
    news: 'news',
    breaking: 'news',
    update: 'news',
    alert: 'news',

    // Upbeat
    howto: 'upbeat',
    tutorial: 'upbeat',
    lifestyle: 'upbeat',
    productivity: 'upbeat',
    tips: 'upbeat',

    // Calm
    psychology: 'calm',
    wellness: 'calm',
    health: 'calm',
    meditation: 'calm',
    mindfulness: 'calm'
};

/**
 * Select a random track from a music category
 */
const selectRandomTrack = (category) => {
    const tracks = MUSIC_LIBRARY[category];
    if (!tracks || tracks.length === 0) {
        // Fallback to dramatic if category not found
        return MUSIC_LIBRARY.dramatic[0];
    }
    return tracks[Math.floor(Math.random() * tracks.length)];
};

/**
 * Detect music category from topic text
 */
const detectMusicCategory = (topic) => {
    const topicLower = topic.toLowerCase();

    for (const [keyword, category] of Object.entries(CONTENT_TO_MUSIC)) {
        if (topicLower.includes(keyword)) {
            return category;
        }
    }

    return 'dramatic'; // Default fallback
};

/**
 * Download background music for a given content type
 * Now supports multiple tracks per category with random selection
 */
export const getBackgroundMusic = async (contentType, outputDir, options = {}) => {
    const { topic = '', forceCategory = null } = options;

    // Determine music category
    let musicCategory = forceCategory || CONTENT_TO_MUSIC[contentType];

    // If no direct match, try to detect from topic
    if (!musicCategory && topic) {
        musicCategory = detectMusicCategory(topic);
    }

    // Fallback to dramatic
    musicCategory = musicCategory || 'dramatic';

    // Select a random track from the category
    const music = selectRandomTrack(musicCategory);

    console.log(`🎵 Selecting background music: ${music.name} (${musicCategory})...`);

    // Create unique filename with track name to support caching multiple tracks
    const safeName = music.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const musicPath = path.join(outputDir, `bgm_${musicCategory}_${safeName}.mp3`);

    // Check if already downloaded
    if (fs.existsSync(musicPath)) {
        console.log(`   ✅ Using cached: ${music.name}`);
        return { path: musicPath, ...music, category: musicCategory };
    }

    try {
        const response = await fetch(music.url);

        if (!response.ok) {
            throw new Error(`Failed to download music: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        fs.writeFileSync(musicPath, Buffer.from(buffer));

        console.log(`   ✅ Downloaded: ${music.name} (BPM: ${music.bpm})`);
        return { path: musicPath, ...music, category: musicCategory };

    } catch (error) {
        console.error(`   ⚠️ Music download failed: ${error.message}`);
        return null;
    }
};

/**
 * Get music that matches the content's energy level
 * Based on BPM - faster BPM for energetic content, slower for calm
 */
export const getMusicByEnergy = async (energyLevel, outputDir) => {
    const energyToCategory = {
        high: ['tech', 'epic', 'news'],
        medium: ['upbeat', 'dramatic'],
        low: ['calm', 'suspense']
    };

    const categories = energyToCategory[energyLevel] || energyToCategory.medium;
    const selectedCategory = categories[Math.floor(Math.random() * categories.length)];

    return getBackgroundMusic(selectedCategory, outputDir, { forceCategory: selectedCategory });
};

/**
 * Sound effect URLs for emphasis
 */
const SOUND_EFFECTS = {
    whoosh: "https://cdn.pixabay.com/audio/2022/03/15/audio_8cb749e9aa.mp3",
    impact: "https://cdn.pixabay.com/audio/2022/03/10/audio_f12e8e820d.mp3",
    reveal: "https://cdn.pixabay.com/audio/2021/08/04/audio_1c9bb03f8a.mp3",
    tension: "https://cdn.pixabay.com/audio/2022/10/30/audio_9d76e69e97.mp3"
};

/**
 * Download a sound effect
 */
export const getSoundEffect = async (effectName, outputDir) => {
    const url = SOUND_EFFECTS[effectName];
    if (!url) return null;

    const effectPath = path.join(outputDir, `sfx_${effectName}.mp3`);

    if (fs.existsSync(effectPath)) {
        return effectPath;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const buffer = await response.arrayBuffer();
        fs.writeFileSync(effectPath, Buffer.from(buffer));
        return effectPath;
    } catch {
        return null;
    }
};

export { MUSIC_LIBRARY, CONTENT_TO_MUSIC, SOUND_EFFECTS, selectRandomTrack, detectMusicCategory };
