/**
 * PROMOTIONAL TOPIC GENERATOR
 *
 * Generates promotional topics for the Viral Faceless Shorts Generator platform.
 * Organized by content type: Features, Benefits, Tutorials, Social Proof.
 *
 * Goal: Drive sign-ups and paid subscriptions.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getNextPromoType, recordPromoGeneration } from '../../config/promo_config.js';
import { generatePromoBrandSummary } from '../promo_brand_context.js';

// ============================================================
// PROMOTIONAL TOPIC TEMPLATES
// ============================================================

const PROMO_TOPICS = {
  features: [
    // AI & Automation Features
    "This AI generates viral shorts in 5 minutes",
    "Watch this tool create a TikTok from scratch",
    "I automated my entire content strategy with AI",
    "This AI analyzes your best videos and clones them",
    "AI that writes viral hooks better than humans",
    "This tool posts to 4 platforms automatically",
    "Watch AI turn one topic into 10 viral variations",
    "This generates trending topics from your analytics",

    // Multi-Platform Features
    "Post to TikTok, YouTube, Instagram, and Facebook in one click",
    "This tool optimizes videos for each platform automatically",
    "Cross-platform analytics in one dashboard",
    "Multi-platform posting while you sleep",

    // Analytics Features
    "This tool predicts which topics will go viral",
    "AI that learns from your winning videos",
    "Analytics that actually tell you what to post",
    "This tracks which hooks get the most views",

    // Visual Features
    "AI-generated visuals in your brand style",
    "Professional video editing without the skills",
    "This adds viral subtitles automatically"
  ],

  benefits: [
    // Time Savings
    "How I post 10x per week without burnout",
    "This saves me 20 hours per week",
    "I haven't manually created content in 30 days",
    "From 5 hours per video to 5 minutes",
    "This automation freed up my entire week",

    // Growth & Results
    "From 100 views to 100K views in 30 days",
    "How I 10x my engagement with AI",
    "This took my channel from 0 to 10K followers",
    "My growth after switching to AI content",
    "How AI helped me go viral consistently",
    "This 10x my posting frequency overnight",

    // Consistency
    "Never miss a posting schedule again",
    "How I maintain 2x daily posts effortlessly",
    "Consistent content without the stress",
    "This keeps my accounts active 24/7",

    // Money & ROI
    "This automation pays for itself in week 1",
    "How I monetized faster with consistent posting",
    "The ROI on automated content is insane",

    // Creative Freedom
    "Finally free from the content creation grind",
    "Let AI handle posting while you focus on strategy",
    "This gave me my evenings back"
  ],

  tutorials: [
    // Getting Started
    "How to use AI to generate viral topics",
    "Step 1: Connect your accounts. Step 2: Go viral",
    "Turn one topic into 10 variations automatically",
    "How to let AI analyze your best content",

    // Features Deep Dives
    "How the viral intelligence system works",
    "Setting up automated posting schedules",
    "How to A/B test topics automatically",
    "Using analytics to find winning patterns",

    // Optimization
    "Optimizing videos for each platform",
    "How to train AI on your brand voice",
    "Setting up cross-platform campaigns",
    "How to track what's actually working",

    // Strategy
    "My exact automation workflow for 2x daily posts",
    "How I use AI to stay ahead of trends",
    "The content strategy that runs itself",
    "How to scale from 1 to 10 posts per day"
  ],

  socialProof: [
    // User Numbers & Scale
    "1000+ creators are using this for viral content",
    "Over 10,000 videos generated this month",
    "Thousands of hours saved by automation",

    // Results & Transformations
    "This tool helped me hit 10K followers in a month",
    "From struggling creator to viral machine",
    "My analytics after 30 days of AI content",
    "Real results from AI-generated content",

    // Testimonials & Stories
    "Why top creators are switching to AI",
    "The tool everyone's talking about",
    "How small creators are beating the algorithm",

    // Comparisons
    "Manual content vs AI content - the results",
    "Before and after using automated posting",
    "The difference AI makes in 30 days",

    // FOMO & Urgency
    "Your competitors are already using this",
    "Don't get left behind in the AI content revolution",
    "While you're editing, AI is posting"
  ]
};

// ============================================================
// HOOK PATTERNS FOR PROMOTIONAL CONTENT
// ============================================================

const PROMO_HOOKS = {
  question: {
    templates: [
      "Still manually creating content?",
      "Spending hours on one video?",
      "Want to post 10x more without burnout?",
      "Tired of inconsistent posting?",
      "Struggling to find viral topics?",
      "Want to automate your entire strategy?"
    ],
    emotion: 'curiosity'
  },

  shock: {
    templates: [
      "This AI made 10 viral videos while I slept",
      "I haven't manually created content in 30 days",
      "This generated 1000+ videos on autopilot",
      "Watch this AI create a viral video in 60 seconds",
      "I deleted my video editing software",
      "This AI outperformed my manual content"
    ],
    emotion: 'shock'
  },

  pain: {
    templates: [
      "Stop wasting hours creating content",
      "Tired of posting with no results?",
      "Your manual workflow is killing your growth",
      "The content creation grind ends here",
      "Manual posting is costing you followers"
    ],
    emotion: 'pain'
  },

  transformation: {
    templates: [
      "From 100 views to 100K views in 30 days",
      "How I 10x my posting frequency",
      "I automated my entire content strategy",
      "My growth before and after AI",
      "From burnout to automation"
    ],
    emotion: 'hope'
  },

  controversy: {
    templates: [
      "AI creates better content than humans",
      "Manual content creation is dead",
      "Why I'll never manually post again",
      "The truth about AI content nobody tells you",
      "Unpopular opinion: Let AI do the work"
    ],
    emotion: 'outrage'
  },

  urgency: {
    templates: [
      "Your competitors are already using this",
      "Don't get left behind",
      "The content gap is widening",
      "While you're editing, AI is posting"
    ],
    emotion: 'fear'
  }
};

// ============================================================
// TOPIC GENERATION FUNCTIONS
// ============================================================

/**
 * Get promotional topics by type
 * @param {string} type - Content type (features|benefits|tutorials|socialProof)
 * @returns {Array<string>} Array of topics
 */
export function getPromoTopicsByType(type) {
  return PROMO_TOPICS[type] || [];
}

/**
 * Get random promotional topic by type
 * @param {string} type - Content type
 * @returns {string} Random topic
 */
export function getRandomPromoTopic(type = null) {
  // If no type specified, use weighted selection
  if (!type) {
    type = getNextPromoType();
  }

  const topics = PROMO_TOPICS[type];
  if (!topics || topics.length === 0) {
    return "This AI tool generates viral content automatically";
  }

  const randomIndex = Math.floor(Math.random() * topics.length);
  return topics[randomIndex];
}

/**
 * Generate promotional topic using AI
 * @param {string} type - Content type
 * @param {string} platform - Target platform (youtube, tiktok, etc.)
 * @returns {Promise<Object>} Generated topic with metadata
 */
export async function generatePromoTopicWithAI(type = null, platform = 'youtube') {
  if (!process.env.GEMINI_API_KEY) {
    console.log('   ⚠️ No GEMINI_API_KEY, using template');
    return {
      topic: getRandomPromoTopic(type),
      type,
      platform,
      source: 'template',
      hook: 'question'
    };
  }

  // If no type specified, use weighted selection
  if (!type) {
    type = getNextPromoType();
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const brandSummary = generatePromoBrandSummary();

  // Get example topics for this type
  const examples = PROMO_TOPICS[type].slice(0, 5).join('\n- ');

  // Content type specific instructions
  const typeInstructions = {
    features: 'Showcase a specific feature or capability. Focus on what the tool DOES. Be specific and concrete.',
    benefits: 'Highlight the transformation or result. Focus on what users GET. Emphasize time savings, growth, or ease.',
    tutorials: 'Frame as a how-to or step-by-step. Focus on teaching users how to use a feature or achieve a result.',
    socialProof: 'Leverage social validation. Focus on numbers, testimonials, or comparisons. Create FOMO.'
  };

  // Platform-specific adjustments
  const platformNotes = {
    youtube: '50-60 characters, slightly more detailed',
    tiktok: '30-40 characters, ultra-punchy, fast hook',
    instagram: '40-50 characters, aesthetic and aspirational',
    facebook: '50-70 characters, storytelling angle'
  };

  const prompt = `You are a promotional content strategist for a SaaS product.

${brandSummary}

TASK: Generate ONE viral promotional video topic for ${platform.toUpperCase()}.

CONTENT TYPE: ${type}
${typeInstructions[type]}

PLATFORM: ${platformNotes[platform] || platformNotes.youtube}

EXAMPLES OF GREAT ${type.toUpperCase()} TOPICS:
- ${examples}

REQUIREMENTS:
1. Create immediate curiosity or value proposition
2. Speak directly to the pain points above
3. Promise a clear benefit or revelation
4. Under 60 characters but impactful
5. Use power words: viral, automated, AI, effortless, proven, 10x
6. Make it clickable - would YOU click on this?

CTA GOAL: Drive sign-ups and free trials

OUTPUT: Return ONLY the topic text. No explanation, no quotes, just the topic.

Generate now:`;

  try {
    const result = await model.generateContent(prompt);
    let topic = result.response.text().trim();

    // Clean up
    topic = topic.replace(/^["'\-\s]+|["'\-\s]+$/g, '').trim();
    topic = topic.split('\n')[0];
    topic = topic.replace(/^["']|["']$/g, '');

    console.log(`   🎯 Generated ${type} topic: "${topic}"`);

    return {
      topic,
      type,
      platform,
      source: 'ai',
      hook: 'question'  // Can be enhanced later
    };
  } catch (error) {
    console.error('   ⚠️ AI generation failed:', error.message);

    // Fallback to template
    return {
      topic: getRandomPromoTopic(type),
      type,
      platform,
      source: 'template-fallback',
      hook: 'question'
    };
  }
}

/**
 * Generate promotional topic (main function)
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Topic with metadata
 */
export async function generatePromoTopic(options = {}) {
  const {
    type = null,           // If null, uses weighted selection
    platform = 'youtube',
    useAI = true
  } = options;

  console.log(`🎬 Generating promotional topic...`);
  console.log(`   Type: ${type || 'auto-select'}`);
  console.log(`   Platform: ${platform}`);

  let result;

  if (useAI) {
    result = await generatePromoTopicWithAI(type, platform);
  } else {
    const selectedType = type || getNextPromoType();
    result = {
      topic: getRandomPromoTopic(selectedType),
      type: selectedType,
      platform,
      source: 'template',
      hook: 'question'
    };
  }

  // Record generation
  recordPromoGeneration(result.type);

  console.log(`   ✅ Topic: "${result.topic}"`);
  console.log(`   📊 Type: ${result.type}, Source: ${result.source}`);

  return result;
}

/**
 * Generate multiple promotional topics
 * @param {number} count - Number of topics to generate
 * @param {Object} options - Generation options
 * @returns {Promise<Array>} Array of topics
 */
export async function generatePromoTopicBatch(count = 5, options = {}) {
  const topics = [];

  for (let i = 0; i < count; i++) {
    const topic = await generatePromoTopic(options);
    topics.push(topic);

    // Small delay between AI calls
    if (options.useAI !== false && i < count - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return topics;
}

/**
 * Get all available topic types
 * @returns {Array<string>} Topic types
 */
export function getPromoTopicTypes() {
  return Object.keys(PROMO_TOPICS);
}

/**
 * Get topic count by type
 * @returns {Object} Topic counts
 */
export function getPromoTopicCounts() {
  return {
    features: PROMO_TOPICS.features.length,
    benefits: PROMO_TOPICS.benefits.length,
    tutorials: PROMO_TOPICS.tutorials.length,
    socialProof: PROMO_TOPICS.socialProof.length,
    total: Object.values(PROMO_TOPICS).flat().length
  };
}

export default {
  generatePromoTopic,
  generatePromoTopicWithAI,
  generatePromoTopicBatch,
  getRandomPromoTopic,
  getPromoTopicsByType,
  getPromoTopicTypes,
  getPromoTopicCounts,
  PROMO_TOPICS,
  PROMO_HOOKS
};
