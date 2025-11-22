import fs from "fs";
import path from "path";
import fetch from "node-fetch";

// Voice presets for different content types
// Includes both male and female voices for variety
const VOICE_PRESETS = {
    // Male voices
    dramatic: {
        voiceId: "JBFqnCBsd6RMkjVDRZzb", // Adam - Deep, authoritative
        stability: 0.4,
        similarity_boost: 0.8,
        style: 0.5,
        gender: "male",
        description: "Deep narrator voice, perfect for conspiracy/dramatic content"
    },
    urgent: {
        voiceId: "ErXwobaYiN019PkySvjV", // Antoni - Clear, energetic
        stability: 0.3,
        similarity_boost: 0.75,
        style: 0.6,
        gender: "male",
        description: "Urgent, news-anchor style delivery"
    },
    mysterious: {
        voiceId: "VR6AewLTigWG4xSOukaG", // Arnold - Deep, mysterious
        stability: 0.5,
        similarity_boost: 0.7,
        style: 0.4,
        gender: "male",
        description: "Deep, mysterious storyteller"
    },
    friendly: {
        voiceId: "pNInz6obpgDQGcFmaJgB", // Adam - Warm, approachable
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        gender: "male",
        description: "Friendly, conversational tone"
    },
    // Female voices
    female_professional: {
        voiceId: "EXAVITQu4vr4xnSDxMaL", // Bella - Professional female
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.4,
        gender: "female",
        description: "Professional, confident female voice for business/educational content"
    },
    female_friendly: {
        voiceId: "MF3mGyEYCl7XYWbV9V6O", // Elli - Warm female
        stability: 0.55,
        similarity_boost: 0.75,
        style: 0.3,
        gender: "female",
        description: "Warm, approachable female voice for lifestyle/wellness content"
    },
    female_energetic: {
        voiceId: "jBpfuIE2acCO8z3wKNLl", // Gigi - Energetic female
        stability: 0.35,
        similarity_boost: 0.8,
        style: 0.7,
        gender: "female",
        description: "Energetic, enthusiastic female voice for exciting content"
    },
    female_calm: {
        voiceId: "oWAxZDx7w5VEj9dCyTzz", // Grace - Calm female
        stability: 0.6,
        similarity_boost: 0.7,
        style: 0.2,
        gender: "female",
        description: "Calm, soothing female voice for psychology/meditation content"
    },
    // British accent
    british: {
        voiceId: "nPczCjzI2devNBz1zQrb", // Brian - British male
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.4,
        gender: "male",
        description: "British accent, sophisticated storyteller"
    }
};

// Content type to optimal voice mapping based on audience research
const CONTENT_VOICE_MAP = {
    // Topics where female voices perform better
    health: ["female_professional", "female_calm", "female_friendly"],
    wellness: ["female_calm", "female_friendly", "female_professional"],
    psychology: ["female_calm", "female_professional", "mysterious"],
    relationships: ["female_friendly", "female_calm", "friendly"],
    lifestyle: ["female_friendly", "female_energetic", "friendly"],
    beauty: ["female_friendly", "female_energetic", "female_professional"],
    parenting: ["female_friendly", "female_calm", "friendly"],

    // Topics where male voices perform better
    finance: ["dramatic", "british", "mysterious"],
    money: ["dramatic", "urgent", "british"],
    tech: ["urgent", "dramatic", "british"],
    business: ["dramatic", "british", "female_professional"],
    crypto: ["urgent", "dramatic", "mysterious"],
    sports: ["urgent", "dramatic", "friendly"],

    // Topics that work well with either
    science: ["british", "female_professional", "dramatic"],
    history: ["british", "mysterious", "dramatic"],
    education: ["friendly", "female_professional", "british"],
    howto: ["friendly", "female_friendly", "urgent"],
    news: ["urgent", "dramatic", "female_professional"],

    // Default fallback
    default: ["dramatic", "female_professional", "friendly"]
};

// Default voice for viral content
const DEFAULT_VOICE = "dramatic";

/**
 * Generate voiceover using ElevenLabs API
 */
export const generateProVoice = async (text, outputDir, options = {}) => {
    console.log("🎙️ Generating Voiceover via ElevenLabs...");

    const {
        preset = DEFAULT_VOICE,
        customVoiceId = null,
        model = "eleven_multilingual_v2"
    } = options;

    const voiceConfig = VOICE_PRESETS[preset] || VOICE_PRESETS.dramatic;
    const voiceId = customVoiceId || voiceConfig.voiceId;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
        throw new Error("ELEVENLABS_API_KEY is missing in .env!");
    }

    // Optimize text for better TTS delivery
    const optimizedText = optimizeTextForSpeech(text);

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text: optimizedText,
                model_id: model,
                voice_settings: {
                    stability: voiceConfig.stability,
                    similarity_boost: voiceConfig.similarity_boost,
                    style: voiceConfig.style || 0,
                    use_speaker_boost: true
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ElevenLabs API Error (${response.status}): ${errorText}`);
        }

        const buffer = await response.arrayBuffer();

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const audioPath = path.join(outputDir, "voiceover.mp3");
        fs.writeFileSync(audioPath, Buffer.from(buffer));

        console.log(`   ✅ Voiceover saved: ${audioPath}`);
        console.log(`   🎭 Voice preset: ${preset} (${voiceConfig.description})`);

        // Return audio as Base64 for the renderer
        return fs.readFileSync(audioPath).toString('base64');

    } catch (error) {
        console.error("❌ Voice generation failed:", error.message);
        throw error;
    }
};

/**
 * Optimize text for better TTS delivery
 * Adds pauses, fixes common issues, enhances dramatic effect
 */
const optimizeTextForSpeech = (text) => {
    let optimized = text;

    // Add slight pauses after dramatic phrases
    const dramaticPhrases = [
        "But here's the thing",
        "And it gets worse",
        "Think about it",
        "Here's what they don't tell you",
        "The truth is",
        "Listen carefully"
    ];

    dramaticPhrases.forEach(phrase => {
        optimized = optimized.replace(
            new RegExp(phrase, 'gi'),
            `${phrase}...`
        );
    });

    // Add pauses after questions
    optimized = optimized.replace(/\?(?!\s*\.\.\.)/g, '?...');

    // Ensure proper spacing
    optimized = optimized.replace(/\s+/g, ' ').trim();

    // Add emphasis to numbers and percentages
    optimized = optimized.replace(/(\d+%)/g, ' $1 ');
    optimized = optimized.replace(/\$(\d+)/g, ' $$$1 ');

    return optimized;
};

/**
 * Detect content category from topic text
 */
const detectContentCategory = (text) => {
    const textLower = text.toLowerCase();

    const categoryKeywords = {
        health: ['health', 'medical', 'doctor', 'disease', 'symptom', 'treatment', 'diet', 'nutrition', 'exercise', 'fitness'],
        wellness: ['wellness', 'mindfulness', 'meditation', 'stress', 'anxiety', 'mental health', 'self-care', 'relaxation'],
        psychology: ['psychology', 'brain', 'mind', 'behavior', 'habit', 'motivation', 'procrastination', 'dopamine', 'emotion'],
        relationships: ['relationship', 'dating', 'love', 'marriage', 'partner', 'family', 'friend'],
        lifestyle: ['lifestyle', 'productivity', 'morning routine', 'life hack', 'minimalism'],
        beauty: ['beauty', 'skincare', 'makeup', 'hair', 'fashion', 'style'],
        finance: ['finance', 'invest', 'stock', 'market', 'portfolio', 'retirement', 'compound'],
        money: ['money', 'budget', 'save', 'income', 'debt', 'credit', 'tax', 'wealth', 'rich'],
        tech: ['tech', 'technology', 'ai', 'artificial intelligence', 'software', 'app', 'algorithm', 'code', 'programming'],
        crypto: ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'nft', 'web3'],
        science: ['science', 'study', 'research', 'experiment', 'discover', 'physicist', 'chemistry', 'biology'],
        history: ['history', 'historical', 'ancient', 'war', 'civilization', 'century', 'empire'],
        business: ['business', 'entrepreneur', 'startup', 'company', 'ceo', 'leadership', 'management'],
        news: ['news', 'breaking', 'update', 'report', 'announcement', 'latest'],
        sports: ['sport', 'athlete', 'game', 'team', 'championship', 'football', 'basketball', 'soccer']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => textLower.includes(keyword))) {
            return category;
        }
    }

    return 'default';
};

/**
 * Select optimal voice based on content analysis
 * Returns the best voice preset for the detected content type
 */
const selectOptimalVoice = (text, options = {}) => {
    const { preferGender = null, preferPreset = null } = options;

    // If user specified a preset, use it
    if (preferPreset && VOICE_PRESETS[preferPreset]) {
        return preferPreset;
    }

    // Detect content category
    const category = detectContentCategory(text);
    const voiceOptions = CONTENT_VOICE_MAP[category] || CONTENT_VOICE_MAP.default;

    // If user prefers a gender, filter options
    if (preferGender) {
        const genderFiltered = voiceOptions.filter(v =>
            VOICE_PRESETS[v]?.gender === preferGender
        );
        if (genderFiltered.length > 0) {
            return genderFiltered[0];
        }
    }

    // Return the top recommended voice for this content type
    return voiceOptions[0];
};

/**
 * Generate voiceover with automatic voice selection based on content
 * Now uses intelligent content analysis to pick the best voice
 */
export const generateSmartVoice = async (text, outputDir, options = {}) => {
    const {
        contentType = null,
        preferGender = null,
        preferPreset = null
    } = options;

    // Select the optimal voice based on content analysis
    const preset = preferPreset || selectOptimalVoice(text, { preferGender });

    console.log(`   🎯 Smart voice selection: ${preset} (detected from content analysis)`);

    return generateProVoice(text, outputDir, { preset });
};

/**
 * Get available voice presets
 */
export const getVoicePresets = () => {
    return Object.entries(VOICE_PRESETS).map(([key, config]) => ({
        id: key,
        voiceId: config.voiceId,
        description: config.description
    }));
};

/**
 * Test voice generation with a short sample
 */
export const testVoiceGeneration = async (outputDir = "/app/videos") => {
    console.log("🧪 Testing voice generation...");

    const testText = "This is a test of the viral video voice generation system. If you can hear this clearly, the system is working.";

    try {
        const base64 = await generateProVoice(testText, outputDir, { preset: 'dramatic' });
        console.log("✅ Voice test successful!");
        return { success: true, audioLength: base64.length };
    } catch (error) {
        console.error("❌ Voice test failed:", error.message);
        return { success: false, error: error.message };
    }
};

export { VOICE_PRESETS, CONTENT_VOICE_MAP, optimizeTextForSpeech, detectContentCategory, selectOptimalVoice };
