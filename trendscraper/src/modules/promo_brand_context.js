/**
 * PROMOTIONAL BRAND CONTEXT
 *
 * This module defines the brand context for the Viral Faceless Shorts Generator itself.
 * Used when generating self-promotional content to drive sign-ups and subscriptions.
 */

// Default promotional brand context for Viral Faceless Shorts Generator
const PROMO_BRAND_CONTEXT = {
  version: 1,
  lastUpdated: null,
  onboardingComplete: true,

  business: {
    name: "Viral Faceless Shorts Generator",
    type: "SaaS",
    industry: "AI Video Automation",
    description: "AI-powered platform that automatically generates viral short-form videos for TikTok, YouTube Shorts, Instagram Reels, and Facebook",
    uniqueValue: "Automated viral content creation with analytics-driven optimization and multi-platform posting",
    website: "https://your-website.com"  // TODO: Update with actual website
  },

  products: [
    {
      id: "free-trial",
      name: "Free Trial",
      description: "Generate your first viral videos for free",
      price: "Free",
      benefits: [
        "AI-powered topic generation",
        "Multi-platform posting",
        "Analytics tracking",
        "Platform-optimized scripts"
      ],
      link: "https://your-website.com/signup",
      featured: true
    },
    {
      id: "pro-subscription",
      name: "Pro Subscription",
      description: "Unlimited viral video generation with advanced features",
      price: "$29/month",
      benefits: [
        "Unlimited videos",
        "Advanced analytics and viral intelligence",
        "A/B testing and variations",
        "Automated scheduling",
        "Priority support",
        "Custom brand voice"
      ],
      link: "https://your-website.com/pricing",
      featured: false
    }
  ],

  targetAudience: {
    demographics: "Content creators, social media managers, entrepreneurs, influencers, digital marketers",
    painPoints: [
      "Time-consuming video creation",
      "Inconsistent posting schedule",
      "Low engagement and views",
      "Don't know what topics go viral",
      "Managing multiple platforms",
      "No time for content strategy"
    ],
    desires: [
      "Viral content that gets views",
      "Automated content creation",
      "Analytics-driven growth",
      "Consistent posting schedule",
      "Multi-platform presence",
      "Save time and effort"
    ],
    awareness: "problem-aware"
  },

  brandVoice: {
    tone: "helpful",
    personality: ["innovative", "results-focused", "confident", "friendly"],
    keywords: ["viral", "automated", "AI-powered", "analytics-driven", "effortless", "proven"],
    avoidWords: ["complicated", "manual", "difficult", "time-consuming"]
  },

  contentGoals: {
    primary: "direct-sales",
    secondary: ["lead-generation", "brand-awareness"],
    callToActions: [
      "Try it free - link in bio",
      "Sign up in 60 seconds",
      "Start creating viral content today",
      "Get your free trial now",
      "Link in bio to get started",
      "Join thousands of creators already using this"
    ]
  },

  templates: {
    ctaTemplates: {
      "direct-sales": [
        "Try it free - link in bio",
        "Sign up in 60 seconds - link in bio",
        "Start creating viral content today",
        "Get your free trial now"
      ],
      "lead-generation": [
        "Link in bio for free trial",
        "Comment 'START' to get access",
        "Free trial link in bio"
      ],
      "engagement": [
        "Comment if you want this",
        "Tag a creator who needs this",
        "Save this if you're tired of manual content creation"
      ],
      "brand-awareness": [
        "Follow for more automation tips",
        "Share this with fellow creators",
        "Follow if you want to automate your content"
      ]
    },

    hookTemplates: {
      question: [
        "Still manually creating content?",
        "Spending hours on one video?",
        "Want to post 10x more without burnout?"
      ],
      shock: [
        "This AI made 10 viral videos while I slept",
        "I haven't manually created content in 30 days",
        "This tool generated 1000+ videos on autopilot"
      ],
      pain: [
        "Stop wasting hours creating content",
        "Tired of posting with no results?",
        "Your manual workflow is killing your growth"
      ],
      transformation: [
        "From 100 views to 100K views in 30 days",
        "How I 10x my posting frequency",
        "I automated my entire content strategy"
      ]
    }
  },

  industryPresets: {
    saas: {
      contentGoals: ["direct-sales", "lead-generation", "education"],
      tones: ["helpful", "innovative", "professional"],
      ctaFocus: "trial-driven"
    }
  }
};

/**
 * Get the promotional brand context
 * @returns {Object} Promotional brand context
 */
export function getPromoBrandContext() {
  return { ...PROMO_BRAND_CONTEXT };
}

/**
 * Generate promotional brand summary for AI prompts
 * @returns {string} Formatted brand summary
 */
export function generatePromoBrandSummary() {
  const ctx = PROMO_BRAND_CONTEXT;

  return `
BRAND CONTEXT:
- Brand: ${ctx.business.name} (${ctx.business.industry})
- Unique Value: ${ctx.uniqueValue}
- Target Audience: ${ctx.targetAudience.demographics}
- Pain Points: ${ctx.targetAudience.painPoints.join(", ")}
- Desires: ${ctx.targetAudience.desires.join(", ")}

BRAND VOICE:
- Tone: ${ctx.brandVoice.tone}
- Personality: ${ctx.brandVoice.personality.join(", ")}
- Use Keywords: ${ctx.brandVoice.keywords.join(", ")}
- Avoid Words: ${ctx.brandVoice.avoidWords.join(", ")}

CONTENT GOAL: Drive sign-ups and subscriptions

FEATURED PRODUCT:
- Name: ${ctx.products[0].name}
- Description: ${ctx.products[0].description}
- Benefits: ${ctx.products[0].benefits.join(", ")}

CALL TO ACTION: ${ctx.contentGoals.callToActions[0]}
`.trim();
}

/**
 * Generate prompt context for AI script generation
 * @returns {Object} Prompt context object
 */
export function generatePromoPromptContext() {
  const ctx = PROMO_BRAND_CONTEXT;

  return {
    brandName: ctx.business.name,
    industry: ctx.business.industry,
    businessType: ctx.business.type,
    uniqueValue: ctx.business.uniqueValue,

    targetAudience: ctx.targetAudience.demographics,
    painPoints: ctx.targetAudience.painPoints,
    desires: ctx.targetAudience.desires,
    awarenessLevel: ctx.targetAudience.awareness,

    tone: ctx.brandVoice.tone,
    personality: ctx.brandVoice.personality,
    keywords: ctx.brandVoice.keywords,
    avoidWords: ctx.brandVoice.avoidWords,

    primaryGoal: ctx.contentGoals.primary,
    callToActions: ctx.contentGoals.callToActions,

    featuredProduct: ctx.products[0]
  };
}

/**
 * Get CTA templates for promotional content
 * @param {string} contentGoal - Content goal (direct-sales, lead-generation, etc.)
 * @returns {Array<string>} Array of CTA templates
 */
export function getPromoCTATemplates(contentGoal = 'direct-sales') {
  return PROMO_BRAND_CONTEXT.templates.ctaTemplates[contentGoal] ||
         PROMO_BRAND_CONTEXT.templates.ctaTemplates['direct-sales'];
}

/**
 * Get hook templates for promotional content
 * @param {string} hookType - Hook type (question, shock, pain, transformation)
 * @returns {Array<string>} Array of hook templates
 */
export function getPromoHookTemplates(hookType = 'question') {
  return PROMO_BRAND_CONTEXT.templates.hookTemplates[hookType] ||
         PROMO_BRAND_CONTEXT.templates.hookTemplates['question'];
}

export default {
  getPromoBrandContext,
  generatePromoBrandSummary,
  generatePromoPromptContext,
  getPromoCTATemplates,
  getPromoHookTemplates,
  PROMO_BRAND_CONTEXT
};
