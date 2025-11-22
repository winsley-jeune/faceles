import { GoogleGenerativeAI } from "@google/generative-ai";

// --- ROBUST PARSER (Text-Based, No JSON headaches) ---
const parseRobustScript = (text) => {
    const storyboard = [];
    const lines = text.split('\n');

    for (const line of lines) {
        if (line.includes('|')) {
            const parts = line.split('|').map(s => s.trim());
            if (parts.length >= 3) {
                // Extract Duration - find FIRST number only, cap at 20 seconds
                const durationMatch = parts[0].match(/\d+/);
                let duration = durationMatch ? parseInt(durationMatch[0]) : 6;
                // Sanity check: cap between 4-20 seconds per scene
                duration = Math.max(4, Math.min(duration, 20));
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

export const generateNicheStoryboard = async (niche, topic) => {
    console.log(`🧠 Brainstorming for: ${topic}...`);

    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ GEMINI_API_KEY is not set in environment variables!");
        throw new Error("GEMINI_API_KEY is required");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // LIST OF MODELS TO TRY (In order of preference) - Using your available models
    const modelNames = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-exp",
        "gemini-2.5-flash"
    ];

    const prompt = `
    You are a viral educational content creator.
    TOPIC: "${topic}"
    NICHE: "${niche}"

    Write a 2-MINUTE script (15-20 scenes). Each scene should be 5-10 seconds.

    STRICT OUTPUT FORMAT (one scene per line):
    Duration | Narration Text | Visual Description

    Example:
    6 | Did you know your bank is losing you money? | Minimalist 3D piggy bank cracking open, red background.
    8 | Inflation eats 3% of your savings every year. | Animated graph line going down, clean vector style.
    7 | Most people save in the wrong accounts. | Bank vault with cobwebs, dusty money stacks.

    IMPORTANT:
    - Duration is just a NUMBER (like 5, 6, 7, 8)
    - Total duration should be around 120 seconds
    - Make it educational and engaging throughout
  `;

    // --- THE RETRY LOOP ---
    for (const modelName of modelNames) {
        try {
            console.log(`   Trying model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });

            const result = await model.generateContent(prompt);
            const text = result.response.text();

            console.log("   📝 AI Response received. Parsing...");
            const storyboard = parseRobustScript(text);

            if (storyboard.length > 0) {
                console.log(`   ✅ Success with ${modelName}! Generated ${storyboard.length} scenes.`);
                // Add Hook/CTA types manually since we used a simple parser
                storyboard[0].scene_type = 'hook';
                storyboard[storyboard.length - 1].scene_type = 'cta';
                return storyboard;
            }

        } catch (e) {
            console.warn(`   ⚠️ Model ${modelName} failed: ${e.message}`);
            console.warn(`   Full error:`, e.toString());
            // Continue to next model...
        }
    }

    console.error("❌ ALL AI MODELS FAILED.");
    // Only hit this if EVERYTHING fails
    return [
        { text: `We tried to explain ${topic}.`, image_prompt: "3d isometric robot error", duration: 5 },
        { text: "But the AI models are currently overloaded.", image_prompt: "Server room red lights", duration: 5 },
        { text: "Please check your API Key or try again later.", image_prompt: "Reset button 3d render", duration: 5 }
    ];
};