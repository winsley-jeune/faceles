import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Platform-specific content generator
 * Creates optimized titles, descriptions, and hashtags for each platform
 */

const PLATFORM_CONFIG = {
    tiktok: {
        name: "TikTok",
        maxHashtags: 4,  // TikTok search optimization: fewer, strategic tags
        style: "question-based for TikTok search engine, direct answer format",
        viralHooks: ["How to", "Why you should", "The truth about", "Stop doing this", "Here's why"],
        // TikTok is a SEARCH ENGINE - caption must contain the exact question the video answers
        promptExtra: "Caption MUST be formatted as a question/answer. Start with 'How to...' or 'Why...' followed by the answer. This is for TikTok SEO."
    },
    instagram: {
        name: "Instagram Reels",
        maxHashtags: 5,  // Reduced from 15 to 3-5 strategic tags (per Money Printer strategy)
        style: "aesthetic, save-worthy, clean professional",
        viralHooks: ["Save this for later", "Share with someone who needs this", "Stop scrolling", "This changed everything"],
        promptExtra: "Keep it clean and aesthetic. Use 3-5 SPECIFIC hashtags only (not 30). Focus on save-worthy content."
    },
    youtube: {
        name: "YouTube Shorts",
        maxHashtags: 5,
        style: "SEO-friendly with CAPS on keywords, provocative statement format",
        viralHooks: ["Banks are LYING", "You NEED to know", "The TRUTH about", "Why NOBODY tells you"],
        // YouTube title format: [Provocative Statement with CAPS] + [Emoji] #Shorts
        promptExtra: "Title MUST have 1-2 keywords in ALL CAPS. End with an emoji and #Shorts. Example: 'Banks are LYING to you about Interest 📉 #Shorts'"
    },
    facebook: {
        name: "Facebook Reels",
        maxHashtags: 5,
        style: "conversational, older demographic (35-65), high purchasing power audience",
        viralHooks: ["What do you think?", "Share if you agree", "Tag someone who needs this", "This is important"],
        // Facebook audience reads comments - provide pinnable comment
        promptExtra: "Target older demographic with higher purchasing power. Include a suggested 'pinned comment' text that can include affiliate links."
    }
};

const NICHE_HASHTAGS = {
    money: {
        tiktok: ["#moneytok", "#fintok", "#investing101", "#sidehustle", "#wealthtips"],
        instagram: ["#financialfreedom", "#wealthbuilding", "#moneymindset", "#investingtips", "#passiveincome", "#personalfinance", "#moneygoals", "#financialliteracy", "#budgeting", "#richlife"],
        youtube: ["#Shorts", "#MoneyTips", "#Investing", "#Finance", "#WealthBuilding", "#PassiveIncome", "#PersonalFinance", "#MoneyHacks"],
        facebook: ["#MoneyTips", "#FinancialFreedom", "#Investing", "#WealthMindset", "#SmartMoney", "#MoneyMatters", "#FinanceTips", "#WealthBuilding"]
    },
    tech: {
        tiktok: ["#techtok", "#techlife", "#gadgets", "#ai", "#futuretech"],
        instagram: ["#technology", "#techie", "#innovation", "#ai", "#gadgets", "#techtrends", "#futuretech", "#coding", "#startup", "#digitalnomad"],
        youtube: ["#Shorts", "#Tech", "#Technology", "#AI", "#Gadgets", "#Innovation", "#TechReview", "#TechNews"],
        facebook: ["#Technology", "#TechNews", "#Innovation", "#AI", "#Gadgets", "#TechTips", "#FutureTech", "#Digital"]
    },
    psychology: {
        tiktok: ["#psychologyfacts", "#mentalhealthtok", "#mindset", "#selfimprovement", "#braintok"],
        instagram: ["#psychologyfacts", "#mentalhealth", "#mindsetshift", "#selfgrowth", "#emotionalintelligence", "#therapy", "#mindfulness", "#selflove", "#personaldevelopment", "#innerwork"],
        youtube: ["#Shorts", "#Psychology", "#MentalHealth", "#Mindset", "#SelfImprovement", "#PersonalGrowth", "#LifeTips", "#Motivation"],
        facebook: ["#Psychology", "#MentalHealth", "#Mindset", "#PersonalGrowth", "#SelfHelp", "#Motivation", "#LifeLessons", "#Wisdom"]
    },
    health: {
        tiktok: ["#healthtok", "#wellnesstok", "#fitnesstips", "#healthylifestyle", "#biohacking"],
        instagram: ["#healthylifestyle", "#wellness", "#fitness", "#nutrition", "#healthtips", "#workout", "#selfcare", "#cleaneating", "#fitnessjourney", "#healthyliving"],
        youtube: ["#Shorts", "#Health", "#Fitness", "#Wellness", "#Nutrition", "#HealthTips", "#Workout", "#HealthyLiving"],
        facebook: ["#Health", "#Wellness", "#Fitness", "#HealthyLiving", "#Nutrition", "#HealthTips", "#Wellbeing", "#SelfCare"]
    },
    productivity: {
        tiktok: ["#productivitytok", "#studytok", "#lifehacks", "#discipline", "#grindset"],
        instagram: ["#productivity", "#timemanagement", "#success", "#motivation", "#discipline", "#morningroutine", "#hustle", "#growthmindset", "#entrepreneur", "#goalsetting"],
        youtube: ["#Shorts", "#Productivity", "#TimeManagement", "#Success", "#Motivation", "#LifeHacks", "#Goals", "#Discipline"],
        facebook: ["#Productivity", "#Success", "#Motivation", "#Goals", "#TimeManagement", "#LifeHacks", "#GrowthMindset", "#Hustle"]
    }
};

/**
 * Generate platform-optimized content using AI
 */
export const generatePlatformContent = async (videoTopic, niche, platform) => {
    const config = PLATFORM_CONFIG[platform];
    if (!config) throw new Error(`Unknown platform: ${platform}`);

    const nicheHashtags = NICHE_HASHTAGS[niche]?.[platform] || NICHE_HASHTAGS.money[platform];

    if (!process.env.GEMINI_API_KEY) {
        return generateFallbackContent(videoTopic, niche, platform, config, nicheHashtags);
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Build platform-specific prompt based on Money Printer strategy
        const isFacebook = platform === 'facebook';
        const isYouTube = platform === 'youtube';
        const isTikTok = platform === 'tiktok';

        const prompt = `You are a viral ${config.name} SEO expert. Generate optimized content for this video:

TOPIC: "${videoTopic}"
NICHE: ${niche}
PLATFORM: ${config.name}
STYLE: ${config.style}

CRITICAL PLATFORM RULES:
${config.promptExtra}

${isYouTube ? `
YOUTUBE TITLE FORMAT: [Provocative Statement with CAPS keywords] + [Single Emoji] #Shorts
GOOD EXAMPLE: "Banks are LYING to you about Interest 📉 #Shorts"
BAD EXAMPLE: "Check this out about finance"
` : ''}

${isTikTok ? `
TIKTOK CAPTION FORMAT: Must contain the EXACT QUESTION the video answers (TikTok is a search engine!)
GOOD EXAMPLE: "How to calculate compound interest correctly. Stop losing money. #compoundinterest #financialfreedom"
BAD EXAMPLE: "Check this out #finance"
` : ''}

Return JSON only:
{
    "title": "${isYouTube ? 'CAPS keywords + emoji + #Shorts (max 60 chars)' : 'Catchy title (max 100 chars)'}",
    "description": "Engaging caption (2-3 sentences with CTA)",
    "hashtags": ["${config.maxHashtags}", "strategic", "hashtags"]${isFacebook ? `,
    "pinnedComment": "Suggested comment to pin (can mention 'link in bio' for affiliate)"` : ''}
}

Use hooks like: ${config.viralHooks.join(', ')}
Include hashtags from: ${nicheHashtags.slice(0, 3).join(', ')}`;

        const aiResponse = await model.generateContent(prompt);
        let text = aiResponse.response.text();
        text = text.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) text = jsonMatch[0];

        const content = JSON.parse(text);
        const allHashtags = [...new Set([...content.hashtags, ...nicheHashtags])].slice(0, config.maxHashtags);

        const result = {
            platform,
            platformName: config.name,
            title: content.title,
            description: content.description,
            hashtags: allHashtags,
            hashtagString: allHashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' '),
            fullCaption: `${content.description}\n\n${allHashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`
        };

        // Add pinned comment for Facebook (affiliate link strategy)
        if (platform === 'facebook' && content.pinnedComment) {
            result.pinnedComment = content.pinnedComment;
        }

        return result;

    } catch (error) {
        console.warn(`AI generation failed for ${platform}:`, error.message);
        return generateFallbackContent(videoTopic, niche, platform, config, nicheHashtags);
    }
};

/**
 * Fallback template-based content (Money Printer strategy optimized)
 */
const generateFallbackContent = (videoTopic, niche, platform, config, nicheHashtags) => {
    const hook = config.viralHooks[Math.floor(Math.random() * config.viralHooks.length)];

    // Extract a keyword for CAPS (for YouTube)
    const keywords = videoTopic.split(' ');
    const capsKeyword = keywords.length > 1 ? keywords[1].toUpperCase() : keywords[0].toUpperCase();

    const templates = {
        // TikTok: Question/answer format for search SEO
        tiktok: {
            title: `${hook} ${videoTopic}`,
            description: `How to understand ${videoTopic}. Here's what you need to know. Stop making this mistake.`
        },
        // Instagram: Clean, aesthetic, save-worthy (3-5 hashtags only)
        instagram: {
            title: videoTopic,
            description: `${videoTopic}\n\n💡 Save this for later!\n📤 Share with someone who needs this!`
        },
        // YouTube: CAPS keywords + emoji + #Shorts
        youtube: {
            title: `${hook} ${capsKeyword} 📉 #Shorts`,
            description: `${videoTopic}\n\n👆 Subscribe for more content like this!`
        },
        // Facebook: Conversational, older demographic
        facebook: {
            title: videoTopic,
            description: `${videoTopic}\n\n💬 What do you think? Drop a comment!\n📤 Share with friends!`
        }
    };

    const template = templates[platform];
    const hashtags = nicheHashtags.slice(0, config.maxHashtags);

    const result = {
        platform,
        platformName: config.name,
        title: template.title,
        description: template.description,
        hashtags,
        hashtagString: hashtags.join(' '),
        fullCaption: `${template.description}\n\n${hashtags.join(' ')}`
    };

    // Add pinned comment for Facebook
    if (platform === 'facebook') {
        result.pinnedComment = `👉 Want to learn more about ${videoTopic}? Link in bio!`;
    }

    return result;
};

/**
 * Generate content for ALL platforms at once
 */
export const generateAllPlatformsContent = async (videoTopic, niche) => {
    console.log(`📱 Generating content for all platforms...`);

    const platforms = ['tiktok', 'instagram', 'youtube', 'facebook'];
    const results = {};

    for (const platform of platforms) {
        try {
            results[platform] = await generatePlatformContent(videoTopic, niche, platform);
            console.log(`   ✅ ${PLATFORM_CONFIG[platform].name} ready`);
        } catch (error) {
            console.error(`   ❌ ${platform} failed:`, error.message);
        }
    }

    return results;
};

export { PLATFORM_CONFIG, NICHE_HASHTAGS };
