import { GoogleGenerativeAI } from "@google/generative-ai";

// Viral content criteria with engagement metrics
const VIRAL_CRITERIA = {
    viral: {
        name: "Viral Potential",
        description: "High shareability, emotional triggers, surprising facts",
        keywords: ["shocking", "surprising", "mind-blowing", "unexpected", "game-changer"],
        engagement: "maximum shares and saves",
        examples: [
            "The 2-minute habit that 94% of billionaires do every morning",
            "Scientists found something disturbing in tap water",
            "This $2 item replaced my $500 purchase"
        ]
    },
    useful: {
        name: "Highly Useful",
        description: "Practical tips, how-tos, life hacks that solve real problems",
        keywords: ["hack", "trick", "method", "step-by-step", "works every time"],
        engagement: "saves and follows for more",
        examples: [
            "Clean your entire house in 15 minutes with this method",
            "The iPhone setting that saves 3 hours of battery daily",
            "How to negotiate any price down by 20%"
        ]
    },
    controversial: {
        name: "Controversial/Debate",
        description: "Polarizing opinions, challenges common beliefs",
        keywords: ["unpopular opinion", "nobody talks about", "truth about", "myth", "actually wrong"],
        engagement: "comments and debates",
        examples: [
            "Why working hard won't make you rich (unpopular truth)",
            "The college degree myth that ruined a generation",
            "What successful people do that others find lazy"
        ]
    },
    curiosity: {
        name: "Curiosity Gap",
        description: "Creates information gap that viewers NEED to close",
        keywords: ["why", "how", "what happens when", "the real reason", "secret"],
        engagement: "watch time and completion rate",
        examples: [
            "Why you wake up tired even after 8 hours of sleep",
            "What banks don't tell you about savings accounts",
            "The real reason airplane mode exists"
        ]
    },
    fear: {
        name: "Fear/Urgency",
        description: "FOMO, warnings, things people should know but don't",
        keywords: ["warning", "stop doing", "before it's too late", "mistake", "ruining"],
        engagement: "immediate action and shares",
        examples: [
            "This common habit is destroying your sleep quality",
            "Stop charging your phone like this",
            "The investment mistake 90% of millennials make"
        ]
    },
    aspirational: {
        name: "Aspirational/Success",
        description: "Wealth, success stories, lifestyle upgrades, transformation",
        keywords: ["millionaire", "passive income", "wealth", "financial freedom", "quit my job"],
        engagement: "saves and follows",
        examples: [
            "How I built $10K/month in passive income at 25",
            "The morning routine of self-made millionaires",
            "5 skills that pay more than a college degree"
        ]
    },
    educational: {
        name: "Educational/Explainer",
        description: "Complex topics simplified, science explained, how things work",
        keywords: ["explained", "how it works", "science behind", "in simple terms", "breakdown"],
        engagement: "saves for reference",
        examples: [
            "How your credit score is actually calculated",
            "The science behind why music gives you chills",
            "How algorithms decide what you see online"
        ]
    },
    trending: {
        name: "Trending/Timely",
        description: "Current events, new discoveries, breaking news angles",
        keywords: ["2024", "just discovered", "new study", "breaking", "latest"],
        engagement: "immediate views",
        examples: [
            "The 2024 tax change that affects everyone",
            "Scientists just discovered why we dream",
            "The AI tool that's replacing Google search"
        ]
    },
    stupid_hustle: {
        name: "Stupid Hustle (Engagement Bait)",
        description: "Satirical, absurd, morally questionable 'sigma grindset' hustle ideas. Create-the-problem-sell-the-solution schemes designed to spark outrage and debate in comments.",
        keywords: ["hustle", "passive income", "genius", "evil", "scheme", "side hustle", "sigma", "grindset", "controversial", "illegal"],
        engagement: "maximum comments and debates - people will fight in comments",
        examples: [
            "Buy bread, spread in parking lot, birds poop on cars, offer car wash",
            "Release mosquitoes near your bug spray stand",
            "Puncture bike tires near your bike repair shop",
            "Buy all umbrellas before rain, sell outside for $20",
            "Put 'out of order' signs on vending machines except yours",
            "Hide shopping carts, rent them out for $5",
            "Disconnect cafe WiFi, sell mobile hotspot access",
            "Start haunted rumor, offer ghost removal services",
            "Deflate bouncy castle at party, offer pump rental",
            "Put fake parking tickets on cars, sell ticket removal service"
        ]
    }
};

// Niche categories with viral topic patterns
const NICHE_TOPICS = {
    money: {
        themes: ["passive income", "investing", "saving money", "tax hacks", "side hustles", "wealth building", "financial mistakes"],
        hooks: ["Why {X}% of people never build wealth", "The money rule rich people never break", "How to save $10K this year without budgeting"]
    },
    tech: {
        themes: ["AI tools", "phone hacks", "app secrets", "algorithm manipulation", "productivity apps", "hidden features"],
        hooks: ["The AI tool that replaced my {X}", "Your phone has this hidden feature", "How to hack the algorithm"]
    },
    psychology: {
        themes: ["habits", "manipulation tactics", "brain hacks", "social dynamics", "persuasion", "productivity", "motivation"],
        hooks: ["Why your brain sabotages your success", "The psychology trick that changes behavior", "How to rewire your brain in 21 days"]
    },
    health: {
        themes: ["sleep optimization", "diet myths", "workout efficiency", "longevity", "energy hacks", "gut health"],
        hooks: ["The health myth doctors still believe", "Why you're always tired (it's not sleep)", "The morning drink that changed my energy"]
    },
    career: {
        themes: ["salary negotiation", "job hunting", "side hustles", "remote work", "skill building", "networking"],
        hooks: ["How I doubled my salary in one email", "The skill that pays $100/hour", "Why your resume gets rejected instantly"]
    },
    relationships: {
        themes: ["communication", "dating psychology", "social skills", "influence", "body language", "first impressions"],
        hooks: ["The phrase that ends any argument", "Why attractive people do this one thing", "How to be memorable in 5 seconds"]
    },
    productivity: {
        themes: ["time management", "focus hacks", "morning routines", "deep work", "automation", "systems thinking"],
        hooks: ["The 2-minute rule that changed my life", "Why busy people get nothing done", "How to 10x your output without working more"]
    },
    stupid_hustle: {
        themes: ["create the problem sell the solution", "chaotic entrepreneurship", "morally gray business", "absurd side hustles", "evil genius schemes", "sigma grindset parody", "controversial money making"],
        hooks: [
            "Step 1: Create the problem. Step 2: Sell the solution",
            "This hustle is so wrong it might be genius",
            "The side hustle they don't want you to know about",
            "Is this illegal? Asking for a friend",
            "Morally questionable but financially sound",
            "The hustle that made my neighbor call the cops",
            "POV: You're about to ruin someone's day for profit"
        ]
    }
};

/**
 * Generate viral topics using Gemini AI based on criteria
 */
export const generateViralTopics = async (options = {}) => {
    const {
        criteria = 'viral',      // viral, useful, controversial, curiosity, fear, aspirational, educational, trending
        niche = null,            // money, tech, psychology, health, career, relationships, productivity
        count = 5,               // Number of topics to generate
        avoidRecent = []         // Topics to avoid (already used)
    } = options;

    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ GEMINI_API_KEY is not set in environment variables!");
        throw new Error("GEMINI_API_KEY is required");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const criteriaConfig = VIRAL_CRITERIA[criteria] || VIRAL_CRITERIA.viral;
    const nicheConfig = niche ? NICHE_TOPICS[niche] : null;

    const prompt = `You are a viral content strategist for short-form video (TikTok/Reels/Shorts).

TASK: Generate ${count} viral video topics that will get maximum engagement.

CRITERIA: ${criteriaConfig.name}
- Description: ${criteriaConfig.description}
- Optimize for: ${criteriaConfig.engagement}
- Keywords to inspire: ${criteriaConfig.keywords.join(', ')}

${nicheConfig ? `NICHE: Focus on ${niche}
- Themes: ${nicheConfig.themes.join(', ')}
- Example hooks: ${nicheConfig.hooks.join(' | ')}` : 'NICHE: General interest (any topic that can go viral)'}

EXAMPLES OF GREAT TOPICS:
${criteriaConfig.examples.map(e => `- "${e}"`).join('\n')}

${avoidRecent.length > 0 ? `AVOID THESE (already used): ${avoidRecent.join(', ')}` : ''}

RULES:
1. Each topic must be specific with numbers/percentages when relevant
2. Create information gap - make viewers NEED to watch
3. Promise clear value or revelation
4. Keep under 15 words but pack emotional punch
5. Use power words: secret, actually, why, how, truth, mistake, hack
6. Avoid clickbait without substance - topics must deliver real content
7. Make it educational - viewers should learn something valuable

OUTPUT: Return ONLY a JSON array of ${count} topic strings. No explanation.

Example output format:
["Topic 1 here", "Topic 2 here", "Topic 3 here"]

Generate now:`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        console.log("📝 Gemini raw response received");

        // Clean up response
        text = text.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        let topics;
        try {
            topics = JSON.parse(text);
        } catch (parseError) {
            console.error("❌ JSON parsing failed:", parseError.message);
            console.error("   Raw text was:", text.substring(0, 200));
            throw new Error("Failed to parse Gemini response as JSON");
        }

        if (!Array.isArray(topics) || topics.length === 0) {
            throw new Error("Gemini returned invalid topics array");
        }

        return {
            success: true,
            criteria: criteriaConfig.name,
            niche: niche || 'general',
            topics: topics.slice(0, count),
            engagement_focus: criteriaConfig.engagement
        };

    } catch (error) {
        console.error("❌ Topic generation failed:", error.message);

        // Fallback to pre-defined topics
        const fallbackTopics = criteriaConfig.examples.slice(0, count);
        return {
            success: true,
            criteria: criteriaConfig.name,
            niche: niche || 'general',
            topics: fallbackTopics,
            engagement_focus: criteriaConfig.engagement,
            fallback: true
        };
    }
};

/**
 * Get a single random viral topic
 */
export const getRandomViralTopic = async (criteria = 'viral', niche = null) => {
    const result = await generateViralTopics({ criteria, niche, count: 1 });
    return result.topics[0];
};

/**
 * Analyze a topic for viral potential
 */
export const analyzeViralPotential = async (topic) => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is required");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Analyze this video topic for viral potential (TikTok/Reels/Shorts):

TOPIC: "${topic}"

Rate each factor 1-10 and explain briefly:

1. CURIOSITY GAP: Does it create an information gap?
2. EMOTIONAL TRIGGER: Does it trigger emotion (surprise, fear, desire)?
3. SHAREABILITY: Would people share this?
4. CLARITY: Is the value proposition clear?
5. UNIQUENESS: Is this fresh or overdone?

OUTPUT as JSON:
{
    "scores": {
        "curiosity": 8,
        "emotion": 7,
        "shareability": 9,
        "clarity": 8,
        "uniqueness": 6
    },
    "overall_score": 7.6,
    "verdict": "HIGH POTENTIAL" | "MEDIUM POTENTIAL" | "LOW POTENTIAL",
    "improvements": ["suggestion 1", "suggestion 2"],
    "better_version": "Improved topic text here"
}`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        text = text.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        return JSON.parse(text);

    } catch (error) {
        return {
            scores: { curiosity: 5, emotion: 5, shareability: 5, clarity: 5, uniqueness: 5 },
            overall_score: 5,
            verdict: "UNABLE TO ANALYZE",
            improvements: ["Could not analyze - try a different topic"],
            better_version: topic
        };
    }
};

/**
 * Get all available criteria options
 */
export const getViralCriteria = () => {
    return Object.entries(VIRAL_CRITERIA).map(([key, config]) => ({
        id: key,
        name: config.name,
        description: config.description,
        engagement_focus: config.engagement
    }));
};

/**
 * Get all available niche options
 */
export const getNicheOptions = () => {
    return Object.entries(NICHE_TOPICS).map(([key, config]) => ({
        id: key,
        themes: config.themes
    }));
};

export { VIRAL_CRITERIA, NICHE_TOPICS };
