import { generateText } from "./llm.js";
import fs from "fs";
import path from "path";

/**
 * Training Video Generator Module
 * Creates professional training and educational videos
 * Supports: Safety, SOP, Onboarding, Equipment Operation, General Training
 */

// Video Types
export const VIDEO_TYPES = {
    TRAINING: 'training',
    SAFETY: 'safety',
    SOP: 'sop',
    ONBOARDING: 'onboarding',
    EQUIPMENT_OPERATION: 'equipment_operation'
};

// Training Video Templates with structure and style
const TRAINING_TEMPLATES = {
    safety: {
        name: 'Safety Training',
        structure: [
            { section: 'attention', description: 'Critical safety alert to grab attention' },
            { section: 'hazard_identification', description: 'Identify specific hazards and risks' },
            { section: 'prevention', description: 'Prevention methods and PPE requirements' },
            { section: 'emergency_procedure', description: 'What to do if something goes wrong' },
            { section: 'recap', description: 'Key safety points to remember' }
        ],
        tone: 'serious',
        voicePreset: 'safety_announcer',
        visualStyle: 'warning_focused',
        defaultDuration: 120
    },
    sop: {
        name: 'Standard Operating Procedure',
        structure: [
            { section: 'introduction', description: 'What this procedure covers and why it matters' },
            { section: 'prerequisites', description: 'Required materials, tools, and preparations' },
            { section: 'step_by_step', description: 'Detailed step-by-step instructions' },
            { section: 'quality_check', description: 'How to verify the work is done correctly' },
            { section: 'documentation', description: 'Recording and reporting requirements' }
        ],
        tone: 'instructional',
        voicePreset: 'training_instructor',
        visualStyle: 'clean_professional',
        defaultDuration: 180
    },
    onboarding: {
        name: 'Employee Onboarding',
        structure: [
            { section: 'welcome', description: 'Warm welcome to the team/company' },
            { section: 'company_overview', description: 'Company mission, values, and culture' },
            { section: 'role_introduction', description: 'Job responsibilities and expectations' },
            { section: 'key_processes', description: 'Important workflows and procedures' },
            { section: 'resources', description: 'Tools, contacts, and support available' },
            { section: 'next_steps', description: 'What to do in first days/weeks' }
        ],
        tone: 'friendly',
        voicePreset: 'female_friendly',
        visualStyle: 'warm_corporate',
        defaultDuration: 180
    },
    equipment_operation: {
        name: 'Equipment Operation',
        structure: [
            { section: 'safety_first', description: 'Safety warnings and PPE requirements' },
            { section: 'equipment_overview', description: 'Parts and components identification' },
            { section: 'setup', description: 'Pre-operation setup and checks' },
            { section: 'operation_steps', description: 'Step-by-step operation procedure' },
            { section: 'shutdown', description: 'Proper shutdown and cleaning procedure' },
            { section: 'maintenance_tips', description: 'Basic maintenance and troubleshooting' }
        ],
        tone: 'instructional',
        voicePreset: 'industrial_narrator',
        visualStyle: 'technical',
        defaultDuration: 240
    },
    training: {
        name: 'General Training',
        structure: [
            { section: 'objectives', description: 'Learning objectives for this training' },
            { section: 'key_concepts', description: 'Core concepts and definitions' },
            { section: 'demonstration', description: 'Show how it is done' },
            { section: 'practice_points', description: 'Key practice areas' },
            { section: 'summary', description: 'Recap of main points' },
            { section: 'assessment_prep', description: 'Preparation for any assessment' }
        ],
        tone: 'educational',
        voicePreset: 'training_instructor',
        visualStyle: 'educational',
        defaultDuration: 180
    }
};

// Training CTA Templates
const TRAINING_CTA_TEMPLATES = {
    complete_training: [
        "Complete this training in your learning portal to receive your certificate.",
        "Mark this training as complete in your LMS.",
        "Don't forget to submit your training completion form."
    ],
    take_quiz: [
        "Now take the assessment quiz to test your knowledge.",
        "Proceed to the quiz section to earn your certification.",
        "Test your understanding with our quick assessment."
    ],
    contact_supervisor: [
        "Contact your supervisor if you have any questions.",
        "Reach out to your team lead for clarification.",
        "Your manager is available for any follow-up questions."
    ],
    practice: [
        "Practice these steps under supervision before working independently.",
        "Schedule a supervised practice session with your trainer.",
        "Apply what you've learned during your next shift."
    ],
    none: [""]
};

/**
 * Parse the AI-generated training storyboard
 */
const parseTrainingStoryboard = (text, visualStyle) => {
    const storyboard = [];
    const lines = text.split('\n');

    const stylePrompts = {
        warning_focused: ", safety warning style, red and yellow accents, clear danger symbols, industrial setting, 8k",
        clean_professional: ", professional corporate style, clean background, blue and white palette, 8k",
        warm_corporate: ", friendly corporate environment, warm lighting, welcoming atmosphere, 8k",
        technical: ", technical diagram style, detailed equipment view, industrial photography, 8k",
        educational: ", educational illustration style, clear diagrams, professional training materials, 8k"
    };

    const stylePrompt = stylePrompts[visualStyle] || stylePrompts.clean_professional;

    for (const line of lines) {
        if (line.includes('|')) {
            const parts = line.split('|').map(s => s.trim());
            if (parts.length >= 3) {
                const durationMatch = parts[0].match(/\d+/);
                let duration = durationMatch ? parseInt(durationMatch[0]) : 8;
                duration = Math.max(5, Math.min(duration, 20));

                const narration = parts[1];
                const visual = parts[2];
                const mediaIndex = parts[3] ? parseInt(parts[3]) : null;

                if (narration.toLowerCase().includes("narration")) continue;

                storyboard.push({
                    text: narration,
                    image_prompt: visual + stylePrompt,
                    duration: duration,
                    scene_type: 'body',
                    useUserMedia: mediaIndex !== null && !isNaN(mediaIndex),
                    mediaIndex: mediaIndex
                });
            }
        }
    }
    return storyboard;
};

/**
 * Generate a storyboard for a training video
 */
export const generateTrainingStoryboard = async (trainingData) => {
    const videoType = trainingData.videoType || 'training';
    const template = TRAINING_TEMPLATES[videoType] || TRAINING_TEMPLATES.training;

    console.log(`📚 Generating ${template.name} video script for: ${trainingData.title}...`);

    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("GEMINI_API_KEY is required");
    }

    const genAI = {
        getGenerativeModel: () => ({
            generateContent: async (prompt) => {
                const _text = await generateText(prompt);
                return { response: { text: () => _text } };
            }
        })
    };
    const modelNames = ["gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-2.5-flash"];

    // Build steps text
    const stepsText = trainingData.steps && trainingData.steps.length > 0
        ? trainingData.steps.map((s, i) => `Step ${i + 1}: ${s}`).join('\n')
        : 'No specific steps provided';

    // Build key points text
    const keyPointsText = trainingData.keyPoints && trainingData.keyPoints.length > 0
        ? trainingData.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')
        : '';

    // Build structure guidance
    const structureGuide = template.structure.map(s =>
        `${s.section.toUpperCase()}: ${s.description}`
    ).join('\n');

    // Get CTA text
    let ctaText = "";
    if (trainingData.cta?.type && trainingData.cta.type !== 'none') {
        const templates = TRAINING_CTA_TEMPLATES[trainingData.cta.type] || TRAINING_CTA_TEMPLATES.complete_training;
        ctaText = trainingData.cta.customText || templates[Math.floor(Math.random() * templates.length)];
    }

    const numMediaFiles = trainingData.mediaFiles?.length || 0;
    const targetDuration = trainingData.duration || template.defaultDuration;

    const prompt = `
You are creating a ${template.name} video script.

TRAINING DETAILS:
Title: ${trainingData.title}
Description: ${trainingData.description || 'Training video'}

${keyPointsText ? `KEY POINTS TO COVER:\n${keyPointsText}` : ''}

${stepsText !== 'No specific steps provided' ? `PROCEDURE/STEPS:\n${stepsText}` : ''}

TARGET AUDIENCE: ${trainingData.targetAudience || 'Employees'}

COMPANY/DEPARTMENT: ${trainingData.company || 'Not specified'}

VIDEO STRUCTURE (follow this order):
${structureGuide}

TONE: ${template.tone} - ${
    template.tone === 'serious' ? 'Use authoritative, clear language. Emphasize importance.' :
    template.tone === 'instructional' ? 'Use clear, step-by-step language. Be precise.' :
    template.tone === 'friendly' ? 'Use warm, welcoming language. Be encouraging.' :
    'Use professional, educational language.'
}

${ctaText ? `CLOSING CALL TO ACTION: ${ctaText}` : ''}

USER HAS UPLOADED ${numMediaFiles} MEDIA FILES (images/videos to include)

Create a ${targetDuration}-second training video script.

STRICT OUTPUT FORMAT (one scene per line):
Duration | Narration Text | Visual Description | Media Index (0-${numMediaFiles - 1} or leave empty for AI visual)

Example for Safety Training:
8 | Attention! This safety training is mandatory for all floor personnel. | Warning symbol animation, red background, safety alert text |
10 | Working with hydraulic presses presents serious crush hazards. | Hydraulic press with danger zone highlighted | 0
8 | Always wear steel-toed boots, safety glasses, and cut-resistant gloves. | PPE equipment laid out, labeled | 1

IMPORTANT:
- Duration is just a NUMBER (8, 10, 12, etc.)
- Total duration should be approximately ${targetDuration} seconds
- Use user media (add media index) for demonstration scenes
- Keep narration clear and professional
- Each scene should focus on ONE key point
- For safety videos, START with an attention-grabbing warning
- End with a clear call to action or summary
`;

    for (const modelName of modelNames) {
        try {
            console.log(`   Trying model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const text = result.response.text();

            console.log("   📝 AI Response received. Parsing...");
            const storyboard = parseTrainingStoryboard(text, template.visualStyle);

            if (storyboard.length > 0) {
                console.log(`   ✅ Success with ${modelName}! Generated ${storyboard.length} scenes.`);
                storyboard[0].scene_type = 'hook';
                storyboard[storyboard.length - 1].scene_type = 'cta';

                return {
                    storyboard,
                    voicePreset: template.voicePreset,
                    videoType: videoType,
                    template: template.name
                };
            }
        } catch (e) {
            console.warn(`   ⚠️ Model ${modelName} failed: ${e.message}`);
        }
    }

    // Fallback storyboard
    console.log("   ⚠️ Using fallback storyboard...");
    return {
        storyboard: generateFallbackTrainingStoryboard(trainingData, template),
        voicePreset: template.voicePreset,
        videoType: videoType,
        template: template.name
    };
};

/**
 * Generate fallback storyboard if AI fails
 */
const generateFallbackTrainingStoryboard = (trainingData, template) => {
    const storyboard = [];

    // Opening
    storyboard.push({
        text: `Welcome to this ${template.name.toLowerCase()} on ${trainingData.title}.`,
        image_prompt: `Professional training title card, "${trainingData.title}", corporate style, 8k`,
        duration: 6,
        scene_type: 'hook'
    });

    // Description
    if (trainingData.description) {
        storyboard.push({
            text: trainingData.description.substring(0, 150),
            image_prompt: "Professional training environment, modern office or facility, 8k",
            duration: 8,
            scene_type: 'body'
        });
    }

    // Steps
    if (trainingData.steps && trainingData.steps.length > 0) {
        trainingData.steps.slice(0, 5).forEach((step, i) => {
            storyboard.push({
                text: `Step ${i + 1}: ${step}`,
                image_prompt: `Training demonstration step ${i + 1}, professional instruction visual, 8k`,
                duration: 10,
                scene_type: 'body',
                useUserMedia: i < (trainingData.mediaFiles?.length || 0),
                mediaIndex: i < (trainingData.mediaFiles?.length || 0) ? i : null
            });
        });
    }

    // Closing
    storyboard.push({
        text: "Thank you for completing this training. Remember to apply what you've learned.",
        image_prompt: "Training completion, professional thank you card, corporate style, 8k",
        duration: 6,
        scene_type: 'cta'
    });

    return storyboard;
};

/**
 * Get available video types
 */
export const getVideoTypes = () => {
    return Object.entries(TRAINING_TEMPLATES).map(([key, template]) => ({
        id: key,
        name: template.name,
        description: template.structure.map(s => s.section).join(' → '),
        defaultDuration: template.defaultDuration,
        tone: template.tone
    }));
};

/**
 * Get template details
 */
export const getTemplateDetails = (videoType) => {
    return TRAINING_TEMPLATES[videoType] || TRAINING_TEMPLATES.training;
};

/**
 * Generate metadata for training video
 */
export const generateTrainingMetadata = (trainingData) => {
    const title = trainingData.title;
    const template = TRAINING_TEMPLATES[trainingData.videoType] || TRAINING_TEMPLATES.training;

    return {
        title: `${title} - ${template.name}`,
        description: `${template.name}: ${trainingData.description || title}\n\nThis training covers:\n${
            trainingData.keyPoints?.map(p => `• ${p}`).join('\n') || 'Key training content'
        }`,
        tags: ['training', 'corporate', 'education', template.name.toLowerCase().replace(/\s+/g, ''),
               trainingData.videoType, 'professional development'],
        category: 'Education',
        voicePreset: template.voicePreset
    };
};

export default {
    generateTrainingStoryboard,
    getVideoTypes,
    getTemplateDetails,
    generateTrainingMetadata,
    VIDEO_TYPES,
    TRAINING_TEMPLATES,
    TRAINING_CTA_TEMPLATES
};
