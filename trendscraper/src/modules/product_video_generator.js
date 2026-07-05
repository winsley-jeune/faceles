import { generateText } from "./llm.js";
import fs from "fs";
import path from "path";

/**
 * Product/Machine Video Generator Module
 * Creates promotional videos for products with specifications, capabilities, and CTAs
 */

// CTA Templates
const CTA_TEMPLATES = {
    buy_now: [
        "Order yours today and transform your business!",
        "Get your {product} now - limited availability!",
        "Don't wait - secure your unit today!",
        "Click the link in bio to order now!"
    ],
    start_business: [
        "Start your own {product} business today!",
        "This could be YOUR next venture - take the leap!",
        "Turn this machine into your income stream!",
        "Ready to be your own boss? Start here!",
        "Your entrepreneurial journey starts now!"
    ],
    contact_us: [
        "Contact us today for a free consultation!",
        "Reach out now - our experts are ready to help!",
        "Message us for pricing and availability!",
        "Let's discuss how this can work for you!"
    ],
    visit_website: [
        "Visit our website for full details!",
        "Check out {website} for more information!",
        "Learn more at the link in our bio!",
        "Full specs and pricing on our website!"
    ]
};

/**
 * Parse the AI-generated storyboard text
 */
const parseProductStoryboard = (text) => {
    const storyboard = [];
    const lines = text.split('\n');

    for (const line of lines) {
        if (line.includes('|')) {
            const parts = line.split('|').map(s => s.trim());
            if (parts.length >= 3) {
                const durationMatch = parts[0].match(/\d+/);
                let duration = durationMatch ? parseInt(durationMatch[0]) : 6;
                duration = Math.max(4, Math.min(duration, 15));

                const narration = parts[1];
                const visual = parts[2];
                const mediaIndex = parts[3] ? parseInt(parts[3]) : null;

                // Skip header lines
                if (narration.toLowerCase().includes("narration")) continue;

                storyboard.push({
                    text: narration,
                    image_prompt: visual + ", professional product photography, 8k, clean background, commercial style",
                    duration: duration,
                    scene_type: 'body',
                    useUserMedia: mediaIndex !== null,
                    mediaIndex: mediaIndex
                });
            }
        }
    }
    return storyboard;
};

/**
 * Generate a storyboard for a product promotional video
 */
export const generateProductStoryboard = async (productData) => {
    console.log(`🎬 Generating product video script for: ${productData.name}...`);

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

    // Build specifications text
    const specsText = productData.specifications && productData.specifications.length > 0
        ? productData.specifications.map(s => `- ${s.key}: ${s.value}`).join('\n')
        : 'No specifications provided';

    // Build capabilities text
    const capsText = productData.capabilities && productData.capabilities.length > 0
        ? productData.capabilities.map((c, i) => `${i + 1}. ${c}`).join('\n')
        : 'No capabilities provided';

    // Get CTA text based on type
    let ctaText = "";
    if (productData.cta.type === 'custom') {
        ctaText = productData.cta.customText;
    } else {
        const templates = CTA_TEMPLATES[productData.cta.type] || CTA_TEMPLATES.contact_us;
        ctaText = templates[Math.floor(Math.random() * templates.length)]
            .replace('{product}', productData.name)
            .replace('{website}', productData.cta.contactInfo?.website || 'our website');
    }

    // Build contact info text
    let contactText = "";
    if (productData.cta.contactInfo) {
        const parts = [];
        if (productData.cta.contactInfo.email) parts.push(`Email: ${productData.cta.contactInfo.email}`);
        if (productData.cta.contactInfo.phone) parts.push(`Phone: ${productData.cta.contactInfo.phone}`);
        if (productData.cta.contactInfo.website) parts.push(`Website: ${productData.cta.contactInfo.website}`);
        contactText = parts.join(' | ');
    }

    const numMediaFiles = productData.mediaFiles?.length || 0;

    const prompt = `
You are creating a promotional video script for a PRODUCT/MACHINE.

PRODUCT DETAILS:
Name: ${productData.name}
Description: ${productData.description}

SPECIFICATIONS:
${specsText}

KEY CAPABILITIES:
${capsText}

TARGET AUDIENCE: ${productData.targetAudience || 'Business owners and entrepreneurs'}

BUSINESS OPPORTUNITY:
${productData.businessOpportunity || 'Great investment opportunity'}

CALL TO ACTION: ${ctaText}
${contactText ? `CONTACT INFO: ${contactText}` : ''}

USER HAS UPLOADED ${numMediaFiles} MEDIA FILES (images/videos of the product)

Create a 60-90 second promotional video script. Structure:
1. HOOK (3-5 seconds) - Attention-grabbing opening about the product potential
2. PROBLEM (5-8 seconds) - What problem does this solve?
3. PRODUCT INTRO (5-8 seconds) - Introduce the product
4. CAPABILITIES (30-40 seconds) - Showcase each key capability (use user media here!)
5. SPECIFICATIONS (10-15 seconds) - Key specs that matter
6. BUSINESS OPPORTUNITY (10-15 seconds) - ROI and potential
7. CTA (5-8 seconds) - Call to action with contact info

STRICT OUTPUT FORMAT (one scene per line):
Duration | Narration Text | Visual Description | Media Index (0-${numMediaFiles - 1} or leave empty for AI visual)

Example:
5 | This machine prints money... literally. | Close-up of machine running, bills flying out effect | 0
6 | Small businesses struggle with production costs. | Worried business owner looking at bills |
7 | Meet the ${productData.name}. | Product hero shot, dramatic lighting | 1

IMPORTANT:
- Duration is just a NUMBER (5, 6, 7, etc.)
- Total duration should be 60-90 seconds
- For capability scenes, USE user media (add media index 0-${numMediaFiles - 1})
- For other scenes, leave media index empty for AI-generated visuals
- Make it professional, exciting, and sales-focused
- The first scene MUST hook viewers immediately
- End with a strong call to action
`;

    for (const modelName of modelNames) {
        try {
            console.log(`   Trying model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const text = result.response.text();

            console.log("   📝 AI Response received. Parsing...");
            const storyboard = parseProductStoryboard(text);

            if (storyboard.length > 0) {
                console.log(`   ✅ Success with ${modelName}! Generated ${storyboard.length} scenes.`);
                storyboard[0].scene_type = 'hook';
                storyboard[storyboard.length - 1].scene_type = 'cta';
                return storyboard;
            }
        } catch (e) {
            console.warn(`   ⚠️ Model ${modelName} failed: ${e.message}`);
        }
    }

    // Fallback storyboard
    console.log("   ⚠️ Using fallback storyboard...");
    return [
        { text: `Introducing ${productData.name}`, image_prompt: "Professional product shot, dramatic lighting, 8k", duration: 5, scene_type: 'hook' },
        { text: productData.description.substring(0, 100), image_prompt: "Product in action, industrial setting", duration: 8, scene_type: 'body', useUserMedia: true, mediaIndex: 0 },
        { text: productData.capabilities[0] || "Incredible performance", image_prompt: "Close-up of machine working", duration: 8, scene_type: 'body', useUserMedia: true, mediaIndex: 1 },
        { text: ctaText, image_prompt: "Contact information overlay, professional design", duration: 6, scene_type: 'cta' }
    ];
};

/**
 * Get CTA template based on type
 */
export const getCTATemplate = (type, productName, contactInfo) => {
    const templates = CTA_TEMPLATES[type] || CTA_TEMPLATES.contact_us;
    return templates[Math.floor(Math.random() * templates.length)]
        .replace('{product}', productName)
        .replace('{website}', contactInfo?.website || 'our website');
};

/**
 * Prepare user media files for video generation
 * Returns paths in the correct format for the renderer
 */
export const prepareUserMedia = async (mediaFiles, videosDir) => {
    const preparedMedia = [];

    for (const filePath of mediaFiles) {
        if (!fs.existsSync(filePath)) {
            console.warn(`   ⚠️ Media file not found: ${filePath}`);
            continue;
        }

        const ext = path.extname(filePath).toLowerCase();
        const isVideo = ['.mp4', '.webm', '.mov'].includes(ext);
        const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

        if (isImage || isVideo) {
            preparedMedia.push({
                path: filePath,
                type: isVideo ? 'video' : 'image'
            });
        }
    }

    return preparedMedia;
};

/**
 * Generate SEO metadata for product video
 */
export const generateProductMetadata = (productData) => {
    const name = productData.name;
    const caps = productData.capabilities?.slice(0, 3).join(', ') || '';

    // YouTube
    const youtube = {
        title: `${name} - Transform Your Business Today! #business #entrepreneur`,
        description: `Discover the ${name}!\n\n${productData.description}\n\nKey Features:\n${productData.capabilities?.map(c => `- ${c}`).join('\n') || ''}\n\n${productData.businessOpportunity || ''}\n\nContact us for more information!`,
        tags: ['business', 'machine', 'entrepreneur', 'investment', 'manufacturing', name.toLowerCase().replace(/\s+/g, '')],
    };

    // TikTok
    const tiktok = {
        title: `This ${name} could change your life! #business #entrepreneur #manufacturing`,
        hashtags: ['#business', '#entrepreneur', '#machine', '#manufacturing', '#investment', '#makemoney']
    };

    // Facebook
    const facebook = {
        message: `Looking to start your own business? The ${name} might be exactly what you need!\n\n${caps}\n\nDM us for details!`,
    };

    // Instagram
    const instagram = {
        caption: `${name} - Your next business opportunity! 💼\n\n${productData.capabilities?.slice(0, 3).map(c => `✓ ${c}`).join('\n') || ''}\n\n🔥 Ready to start earning?\n\n#business #entrepreneur #manufacturing #machine #investment`,
    };

    return { youtube, tiktok, facebook, instagram };
};

export default {
    generateProductStoryboard,
    getCTATemplate,
    prepareUserMedia,
    generateProductMetadata
};
