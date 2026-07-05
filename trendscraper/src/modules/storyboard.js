import { generateText } from "./llm.js";
import contentConfig from "./analytics/content_config.js";
import brandContext from "./brand_context.js";
import crossPlatform from "./analytics/cross_platform.js";
import viralIntelligence from "./analytics/viral_intelligence.js";
import {
    sanitizePromptInput,
    validateNiche,
    validateTopic,
    sanitizeVideoTitle,
    sanitizeBrandContext,
    sanitizeCTA
} from "../utils/inputSanitizer.js";

// ============================================================================
// PLATFORM-SPECIFIC DURATION & STRUCTURE CONFIG
// Each platform has optimal durations based on algorithm preferences
// ============================================================================
const PLATFORM_CONFIG = {
    youtube: {
        name: 'YouTube Shorts',
        targetDuration: 50,      // 50 seconds optimal for Shorts (under 60s limit)
        sceneCount: [12, 18],    // 12-18 scenes
        sceneDuration: [3, 5],   // 3-5 seconds per scene
        hookDuration: 3,         // 3 second hook
        hookMaxWords: 15,        // Keep hook punchy
        pacingStyle: 'cinematic', // Slightly slower, more polished
        promptStyle: 'YouTube Shorts require professional, polished content. Viewers expect higher production value. Hook must grab in first 3 seconds. Aim for educational value with entertainment.'
    },
    tiktok: {
        name: 'TikTok',
        targetDuration: 30,      // 30 seconds optimal (algorithm favors completion)
        sceneCount: [8, 12],     // 8-12 scenes (faster cuts)
        sceneDuration: [2, 4],   // 2-4 seconds per scene
        hookDuration: 2,         // 2 second hook (CRITICAL - TikTok swipes fast!)
        hookMaxWords: 8,         // Ultra-punchy hook
        pacingStyle: 'rapid',    // Fast cuts, high energy
        promptStyle: 'TikTok demands FAST pacing. First 2 seconds = life or death. Use pattern interrupts, visual chaos, controversial takes. Viewers have 0 patience. Every scene must pull them to the next.'
    },
    instagram: {
        name: 'Instagram Reels',
        targetDuration: 45,      // 45 seconds optimal
        sceneCount: [10, 15],    // 10-15 scenes
        sceneDuration: [3, 5],   // 3-5 seconds per scene
        hookDuration: 2,         // 2 second hook
        hookMaxWords: 10,        // Clean, aesthetic hook
        pacingStyle: 'aesthetic', // Visually pleasing, slightly slower
        promptStyle: 'Instagram Reels favor aesthetic, polished content. Hook should be visually striking. Content should be aspirational or educational. Saves are the key metric - make it reference-worthy.'
    },
    facebook: {
        name: 'Facebook Reels',
        targetDuration: 60,      // 60 seconds (longer works on Facebook)
        sceneCount: [15, 20],    // 15-20 scenes
        sceneDuration: [3, 5],   // 3-5 seconds per scene
        hookDuration: 3,         // 3 second hook
        hookMaxWords: 12,        // Slightly more context
        pacingStyle: 'storytelling', // Narrative-driven
        promptStyle: 'Facebook Reels favor storytelling and emotional content. Older demographic, more patience. Hook should create curiosity. Shares are the key metric - make it shareable to friends/family.'
    }
};

// Helper to get config with fallback
const getPlatformConfig = (platform) => {
    const key = platform?.toLowerCase() || 'youtube';
    return PLATFORM_CONFIG[key] || PLATFORM_CONFIG.youtube;
};

// --- ROBUST PARSER (Text-Based, No JSON headaches) ---
// Now platform-aware for duration capping
const parseRobustScript = (text, platform = 'youtube') => {
    const storyboard = [];
    const lines = text.split('\n');
    const config = getPlatformConfig(platform);

    // Platform-specific duration bounds
    const minDuration = config.sceneDuration[0];
    const maxDuration = config.sceneDuration[1];

    for (const line of lines) {
        if (line.includes('|')) {
            const parts = line.split('|').map(s => s.trim());
            if (parts.length >= 3) {
                // Extract Duration - find FIRST number only
                const durationMatch = parts[0].match(/\d+/);
                let duration = durationMatch ? parseInt(durationMatch[0]) : Math.round((minDuration + maxDuration) / 2);

                // Platform-specific duration capping
                duration = Math.max(minDuration, Math.min(duration, maxDuration));

                const narration = parts[1];
                const visual = parts[2];

                // Skip header lines
                if (narration.toLowerCase().includes("narration")) continue;

                storyboard.push({
                    text: narration,
                    image_prompt: visual + ", 3d render, isometric, clean, 8k, no text",
                    duration: duration,
                    scene_type: 'body'
                });
            }
        }
    }
    return storyboard;
};

export const generateNicheStoryboard = async (niche, topic, viralData = null, platform = 'youtube', brandContextOverride = null) => {
    // SECURITY: Validate and sanitize all user inputs
    const validatedNiche = validateNiche(niche);
    const topicValidation = validateTopic(topic);

    if (!topicValidation.valid) {
        console.error(`❌ Topic validation failed: ${topicValidation.reason}`);
        throw new Error(`Invalid topic: ${topicValidation.reason}`);
    }

    const sanitizedTopic = sanitizePromptInput(topicValidation.topic);

    const config = getPlatformConfig(platform);
    console.log(`🧠 Brainstorming for ${config.name}: ${sanitizedTopic}...`);
    console.log(`   📐 Target: ${config.targetDuration}s, ${config.sceneCount[0]}-${config.sceneCount[1]} scenes, ${config.hookDuration}s hook`);

    // LLM provider is Claude via the llm.js adapter; it fails loud if ANTHROPIC_API_KEY is missing.

    // GET AI-LEARNED OPTIMIZATION RULES
    let optimizationRules = "";
    try {
        optimizationRules = contentConfig.getStoryboardEnhancement();
        console.log("   📊 Applying learned content optimizations...");
    } catch (e) {
        console.log("   ℹ️ No content config yet, using defaults");
    }

    // GET CROSS-PLATFORM WINNING PATTERNS (Few-Shot Learning)
    let winningPatternsPrompt = "";
    let contentRecommendation = null;
    try {
        winningPatternsPrompt = crossPlatform.generateUnifiedPrompt();
        contentRecommendation = crossPlatform.getContentRecommendation();
        if (winningPatternsPrompt && winningPatternsPrompt.includes("Universal Winners")) {
            console.log("   🎯 Applying cross-platform winning patterns...");
        }
    } catch (e) {
        console.log("   ℹ️ No cross-platform analytics yet, will learn from future posts");
    }

    // GET BRAND CONTEXT (if configured) - SECURITY: Sanitize before use
    // Use brandContextOverride if provided (for promotional content), otherwise use user's brand context
    let brandSummary = "";
    let contentGoal = "";
    let ctaInstruction = "";
    try {
        let rawBrandSummary = null;
        let ctx = null;
        let ctaTemplates = null;

        if (brandContextOverride) {
            // Using promotional or custom brand context override
            rawBrandSummary = brandContextOverride.summary || brandContextOverride.generateBrandSummary?.();
            ctx = brandContextOverride.context || brandContextOverride.generatePromptContext?.();
            ctaTemplates = brandContextOverride.ctaTemplates || brandContextOverride.getCTATemplates?.(ctx?.primaryGoal);
            console.log("   🎯 Applying promotional brand context...");
        } else {
            // Using user's default brand context
            rawBrandSummary = brandContext.generateBrandSummary();
            ctx = brandContext.generatePromptContext();
            ctaTemplates = ctx ? brandContext.getCTATemplates(ctx.primaryGoal) : null;
            console.log("   🏢 Applying brand context to script generation...");
        }

        if (rawBrandSummary) {
            // SECURITY: Sanitize brand summary before embedding in prompt
            brandSummary = sanitizeBrandContext(rawBrandSummary);

            if (ctx) {
                contentGoal = ctx.primaryGoal;

                // Get appropriate CTA based on content goal
                if (ctaTemplates && ctaTemplates.length > 0) {
                    // SECURITY: Sanitize CTA template
                    const sanitizedCTA = sanitizeCTA(ctaTemplates[0]);
                    ctaInstruction = `\nCALL TO ACTION STYLE: "${sanitizedCTA}" (adapt to fit naturally)`;
                }
            }
        }
    } catch (e) {
        console.log("   ℹ️ No brand context configured, using generic content");
    }

    // Build content goal-specific instructions
    let goalInstructions = "";
    switch (contentGoal) {
        case 'direct-sales':
            goalInstructions = `
CONTENT GOAL: DRIVE SALES
- Focus on product benefits and transformation
- Create desire and urgency
- Address objections throughout
- End with a clear purchase CTA`;
            break;
        case 'lead-generation':
            goalInstructions = `
CONTENT GOAL: GENERATE LEADS
- Provide immense value upfront (80% value, 20% pitch)
- Tease additional resources available
- End with a lead magnet CTA (free guide, checklist, etc.)`;
            break;
        case 'engagement':
            goalInstructions = `
CONTENT GOAL: DRIVE ENGAGEMENT
- Ask questions viewers want to answer
- Create debate or discussion topics
- End with a question to boost comments`;
            break;
        default: // brand-awareness
            goalInstructions = `
CONTENT GOAL: BUILD BRAND AWARENESS
- Lead with value and entertainment
- Subtly weave in brand expertise
- End with follow CTA for more content`;
    }

    // Build strategy instruction based on recommendation
    let strategyInstruction = "";
    if (contentRecommendation) {
        if (contentRecommendation.strategy === 'EXPLOIT' && contentRecommendation.confidence !== 'low') {
            strategyInstruction = `\nSTRATEGY: Use PROVEN patterns from analytics data below.`;
        } else {
            strategyInstruction = `\nSTRATEGY: EXPLORE - Try a fresh approach. Experiment with new hooks or formats.`;
        }
    }

    // BUILD VIRAL INTELLIGENCE INSTRUCTIONS (from real winning videos)
    // SECURITY: Sanitize video titles as they come from external APIs
    let viralInstructions = "";
    if (viralData && viralData.topVideos?.length > 0) {
        const topVideos = viralData.topVideos;

        // SECURITY: Sanitize each video title before embedding in prompt
        const winningVideoData = topVideos
            .slice(0, 8)
            .map((v, i) => {
                const sanitizedTitle = sanitizeVideoTitle(v.title);
                const views = Math.max(0, parseInt(v.stats?.views) || 0);
                const score = Math.max(0, parseFloat(v.viral?.viralScore) || 0).toFixed(2);
                return `${i + 1}. "${sanitizedTitle}" - ${views} views, ${score} viral score`;
            })
            .join('\n');

        const avgViews = Math.max(0, parseInt(viralData.avgViews) || 0);
        const outlierCount = Math.max(0, parseInt(viralData.outlierCount) || 0);

        viralInstructions = `
VIRAL INTELLIGENCE (Real Performance Data):
Your channel's top performing videos:
${winningVideoData}

Channel average: ${avgViews} views
Outliers (3x+ above average): ${outlierCount} videos

INSTRUCTIONS:
1. Analyze the HOOK patterns from the top videos above - replicate what makes them work
2. Analyze the CONTENT STRUCTURE - understand why viewers stayed
3. Analyze the CTA patterns (if visible) - understand what drives engagement
4. Your script should follow the same patterns that made these videos successful
5. The first scene (HOOK) should match the style of the #1 video
6. The last scene (CTA) should drive engagement (follow, comment, share)
`;
        console.log(`   🔥 Using viral intelligence: ${outlierCount} outliers, ${avgViews} avg views`);
    }

    // Build platform-specific example based on pacing style
    const pacingExamples = {
        rapid: `    ${config.sceneDuration[0]} | Wait, they actually pay you for this?! | Shocked face, money flying, neon colors.
    ${config.sceneDuration[1]} | Here's the secret no one tells you. | Brain explosion, secrets unlocking.
    ${config.sceneDuration[0]} | It's literally so simple it's embarrassing. | Simple diagram, lightbulb moment.`,

        cinematic: `    ${config.sceneDuration[0] + 1} | I deleted the entire server... and got promoted. | Shocked face emoji, computer screen with red error, 3D office scene.
    ${config.sceneDuration[1]} | Most people think that's insane. But here's why it worked. | Brain lightbulb moment, question marks floating.
    ${config.sceneDuration[0] + 1} | The database was corrupted anyway. I just accelerated the inevitable. | Crumbling database icon, phoenix rising.`,

        aesthetic: `    ${config.sceneDuration[0]} | This changed everything for me... | Soft gradient background, transformation visual.
    ${config.sceneDuration[1]} | Most people skip this step. Don't be most people. | Clean minimalist design, highlight arrow.
    ${config.sceneDuration[0] + 1} | Here's exactly what I did differently. | Before/after split screen, glow effect.`,

        storytelling: `    ${config.sceneDuration[0] + 1} | My mom called me crazy when I quit my job for this... | Phone call visual, concerned parent.
    ${config.sceneDuration[1]} | Six months later, she was asking me for advice. | Calendar flip, success montage.
    ${config.sceneDuration[0] + 1} | Here's the one thing that made all the difference. | Spotlight on key element, revelation moment.`
    };

    const exampleFormat = pacingExamples[config.pacingStyle] || pacingExamples.cinematic;

    // SECURITY: Use sanitized inputs in prompt
    const prompt = `
    You are a viral content creator specializing in ${config.name}.
    TOPIC: "${sanitizedTopic}"
    NICHE: "${validatedNiche}"

    PLATFORM: ${config.name}
    ${config.promptStyle}

    ${brandSummary ? `\n${brandSummary}\n` : ''}
    ${goalInstructions}
    ${ctaInstruction}
    ${optimizationRules}
    ${viralInstructions}
    ${winningPatternsPrompt ? `\n--- ANALYTICS DATA (Learn from past performance) ---\n${winningPatternsPrompt}\n--- END ANALYTICS ---\n` : ''}
    ${strategyInstruction}

    Write a ${config.targetDuration}-SECOND script (${config.sceneCount[0]}-${config.sceneCount[1]} scenes).
    Each scene should be ${config.sceneDuration[0]}-${config.sceneDuration[1]} seconds.

    CRITICAL - FIRST SCENE (HOOK):
    The first ${config.hookDuration} seconds determine if viewers stay or swipe away.
    Hook MUST be ${config.hookMaxWords} words or less - ultra punchy!
    Start with something that creates IMMEDIATE curiosity or shock.
    DO NOT start with "In this video" or "Today we'll learn" - that's a guaranteed swipe.
    ${brandSummary ? 'Hook should be relevant to the target audience pain points.' : ''}

    STRICT OUTPUT FORMAT (one scene per line):
    Duration | Narration Text | Visual Description

    Example for ${config.name} (${config.pacingStyle} pacing):
${exampleFormat}

    IMPORTANT:
    - Duration is just a NUMBER (${config.sceneDuration[0]}, ${Math.round((config.sceneDuration[0] + config.sceneDuration[1]) / 2)}, ${config.sceneDuration[1]})
    - Total duration should be around ${config.targetDuration} seconds
    - FIRST SCENE (HOOK) should be exactly ${config.hookDuration} seconds
    - Make it educational and engaging throughout
    - The FIRST SCENE is the most important - it must HOOK immediately
    - Use storytelling and unexpected outcomes when possible
    ${brandSummary ? '- Match the brand voice and tone specified above' : ''}

    CRITICAL - LAST SCENE (CTA):
    The FINAL SCENE MUST include a clear Call-To-Action. This drives followers and engagement.
    Examples of effective CTAs:
    - "Follow for more secrets like this..."
    - "Drop a comment if this blew your mind..."
    - "Share this with someone who needs to hear it..."
    - "Hit follow before the algorithm buries this..."
    - "Part 2? Let me know in the comments..."
    The CTA should feel natural and match the video's tone. Never be generic like "Like and subscribe".
  `;

    // --- GENERATE VIA CLAUDE (llm.js adapter) ---
    try {
        console.log(`   Generating storyboard with Claude...`);
        const text = await generateText(prompt);

        console.log("   📝 AI Response received. Parsing...");
        const storyboard = parseRobustScript(text, platform);

        if (storyboard.length > 0) {
            // Calculate total duration for logging
            const totalDuration = storyboard.reduce((sum, s) => sum + s.duration, 0);
            console.log(`   ✅ Success! Generated ${storyboard.length} scenes (${totalDuration}s total).`);

            // Add Hook/CTA types manually since we used a simple parser
            storyboard[0].scene_type = 'hook';
            storyboard[0].duration = config.hookDuration; // Enforce platform hook duration
            storyboard[storyboard.length - 1].scene_type = 'cta';

            // Log platform optimization applied
            console.log(`   🎯 Optimized for ${config.name}: ${config.pacingStyle} pacing, ${config.hookDuration}s hook`);

            return storyboard;
        }
        console.error("❌ Parser produced 0 scenes from the LLM output.");
    } catch (e) {
        console.warn(`   ⚠️ Claude generation failed: ${e.message}`);
        console.warn(`   Full error:`, e.toString());
    }

    console.error("❌ AI STORYBOARD GENERATION FAILED.");
    // Only hit this if EVERYTHING fails
    return [
        { text: `We tried to explain ${topic}.`, image_prompt: "3d isometric robot error", duration: 5 },
        { text: "But the AI models are currently overloaded.", image_prompt: "Server room red lights", duration: 5 },
        { text: "Please check your API Key or try again later.", image_prompt: "Reset button 3d render", duration: 5 }
    ];
};

// Export platform config for other modules
export { PLATFORM_CONFIG, getPlatformConfig };