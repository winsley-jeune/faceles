import dataService from '../services/dataService.js';

// Default brand context structure
const DEFAULT_BRAND_CONTEXT = {
  version: 1,
  lastUpdated: null,
  onboardingComplete: false,
  business: {
    name: "",
    type: "",
    industry: "",
    description: "",
    uniqueValue: "",
    website: ""
  },
  products: [],
  targetAudience: {
    demographics: "",
    painPoints: [],
    desires: [],
    awareness: "problem-aware"
  },
  brandVoice: {
    tone: "professional",
    personality: [],
    keywords: [],
    avoidWords: []
  },
  contentGoals: {
    primary: "brand-awareness",
    secondary: [],
    callToActions: []
  },
  templates: {
    ctaTemplates: {
      "brand-awareness": [
        "Follow for more {industry} insights",
        "Share this if you found it valuable",
        "Comment your thoughts below"
      ],
      "lead-generation": [
        "Link in bio for your free {offer}",
        "DM '{keyword}' to get started",
        "Comment '{keyword}' for the free guide"
      ],
      "direct-sales": [
        "Shop now - link in bio",
        "Use code {code} for {discount}% off",
        "Limited time offer - link in bio"
      ],
      "engagement": [
        "What do you think? Comment below",
        "Tag someone who needs to see this",
        "Save this for later"
      ]
    },
    hookTemplates: {
      ecommerce: [
        "Stop scrolling if you're still {pain_point}...",
        "The {product_category} that changed everything",
        "{Number} customers can't be wrong about {product}"
      ],
      coaching: [
        "I helped {number}+ {audience} achieve {result}",
        "The {topic} mistake costing you {loss}",
        "Why {common_belief} is keeping you stuck"
      ]
    }
  },
  industryPresets: {
    ecommerce: {
      contentGoals: ["direct-sales", "brand-awareness"],
      tones: ["friendly", "authentic", "urgent"],
      ctaFocus: "product-driven"
    },
    coaching: {
      contentGoals: ["lead-generation", "authority"],
      tones: ["authoritative", "empathetic", "motivational"],
      ctaFocus: "value-driven"
    },
    saas: {
      contentGoals: ["lead-generation", "education"],
      tones: ["professional", "helpful", "innovative"],
      ctaFocus: "demo-driven"
    },
    agency: {
      contentGoals: ["lead-generation", "case-studies"],
      tones: ["professional", "results-focused", "confident"],
      ctaFocus: "consultation-driven"
    }
  }
};

/**
 * Load brand context from database
 * @param {string} userId - User ID
 */
export async function loadBrandContext(userId) {
  try {
    const context = await dataService.brandContext.get(userId);
    if (context) {
      return context;
    }
    return { ...DEFAULT_BRAND_CONTEXT };
  } catch (error) {
    console.error("Error loading brand context:", error);
    return { ...DEFAULT_BRAND_CONTEXT };
  }
}

/**
 * Save brand context to database
 * @param {string} userId - User ID
 * @param {object} context - Brand context data
 */
export async function saveBrandContext(userId, context) {
  try {
    await dataService.brandContext.save(userId, context);
    return true;
  } catch (error) {
    console.error("Error saving brand context:", error);
    return false;
  }
}

/**
 * Update specific section of brand context
 * @param {string} userId - User ID
 * @param {string} section - Section to update
 * @param {object} data - Section data
 */
export async function updateBrandSection(userId, section, data) {
  const context = await loadBrandContext(userId);
  if (context[section]) {
    context[section] = { ...context[section], ...data };
  } else {
    context[section] = data;
  }
  return saveBrandContext(userId, context);
}

/**
 * Complete onboarding and mark brand context as setup
 * @param {string} userId - User ID
 * @param {object} brandData - Brand data
 */
export async function completeOnboarding(userId, brandData) {
  const context = await loadBrandContext(userId);

  // Merge in all the brand data
  if (brandData.business) context.business = { ...context.business, ...brandData.business };
  if (brandData.products) context.products = brandData.products;
  if (brandData.targetAudience) context.targetAudience = { ...context.targetAudience, ...brandData.targetAudience };
  if (brandData.brandVoice) context.brandVoice = { ...context.brandVoice, ...brandData.brandVoice };
  if (brandData.contentGoals) context.contentGoals = { ...context.contentGoals, ...brandData.contentGoals };

  context.onboardingComplete = true;
  return saveBrandContext(userId, context);
}

/**
 * Add a product to the brand
 * @param {string} userId - User ID
 * @param {object} product - Product data
 */
export async function addProduct(userId, product) {
  const context = await loadBrandContext(userId);
  const newProduct = {
    id: Date.now().toString(),
    name: product.name || "",
    description: product.description || "",
    price: product.price || "",
    benefits: product.benefits || [],
    link: product.link || "",
    featured: product.featured || false,
    createdAt: new Date().toISOString()
  };
  context.products.push(newProduct);
  await saveBrandContext(userId, context);
  return newProduct;
}

/**
 * Update a product
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 * @param {object} updates - Product updates
 */
export async function updateProduct(userId, productId, updates) {
  const context = await loadBrandContext(userId);
  const index = context.products.findIndex(p => p.id === productId);
  if (index !== -1) {
    context.products[index] = { ...context.products[index], ...updates };
    await saveBrandContext(userId, context);
    return context.products[index];
  }
  return null;
}

/**
 * Delete a product
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 */
export async function deleteProduct(userId, productId) {
  const context = await loadBrandContext(userId);
  const index = context.products.findIndex(p => p.id === productId);
  if (index !== -1) {
    context.products.splice(index, 1);
    await saveBrandContext(userId, context);
    return true;
  }
  return false;
}

/**
 * Get CTA templates based on content goal and industry
 * @param {string} userId - User ID
 * @param {string} contentGoal - Content goal
 * @param {string} industry - Industry
 */
export async function getCTATemplates(userId, contentGoal, industry) {
  const context = await loadBrandContext(userId);
  const templates = context.templates?.ctaTemplates?.[contentGoal] || [];

  // Replace placeholders with brand data
  return templates.map(template => {
    return template
      .replace("{industry}", context.business?.industry || "business")
      .replace("{offer}", context.products?.[0]?.name || "guide")
      .replace("{keyword}", "START")
      .replace("{code}", "SAVE20")
      .replace("{discount}", "20");
  });
}

/**
 * Get hook templates based on industry
 * @param {string} userId - User ID
 * @param {string} industry - Industry
 */
export async function getHookTemplates(userId, industry) {
  const context = await loadBrandContext(userId);
  return context.templates?.hookTemplates?.[industry] || [];
}

/**
 * Generate brand-aware prompt context for AI script generation
 * @param {string} userId - User ID
 */
export async function generatePromptContext(userId) {
  const context = await loadBrandContext(userId);

  if (!context.onboardingComplete) {
    return null;
  }

  const promptContext = {
    brandName: context.business?.name || "",
    industry: context.business?.industry || "",
    businessType: context.business?.type || "",
    uniqueValue: context.business?.uniqueValue || "",

    // Target audience
    targetAudience: context.targetAudience?.demographics || "",
    painPoints: context.targetAudience?.painPoints || [],
    desires: context.targetAudience?.desires || [],
    awarenessLevel: context.targetAudience?.awareness || "problem-aware",

    // Brand voice
    tone: context.brandVoice?.tone || "professional",
    personality: context.brandVoice?.personality || [],
    keywords: context.brandVoice?.keywords || [],
    avoidWords: context.brandVoice?.avoidWords || [],

    // Content goals
    primaryGoal: context.contentGoals?.primary || "brand-awareness",
    callToActions: context.contentGoals?.callToActions || [],

    // Featured product (if any)
    featuredProduct: context.products?.find(p => p.featured) || context.products?.[0] || null
  };

  return promptContext;
}

/**
 * Generate a brand context summary for AI prompts
 * @param {string} userId - User ID
 */
export async function generateBrandSummary(userId) {
  const ctx = await generatePromptContext(userId);

  if (!ctx) {
    return "";
  }

  let summary = `
BRAND CONTEXT:
- Brand: ${ctx.brandName} (${ctx.industry})
- Unique Value: ${ctx.uniqueValue}
- Target Audience: ${ctx.targetAudience}
- Pain Points: ${ctx.painPoints.join(", ")}
- Desires: ${ctx.desires.join(", ")}
- Awareness Level: ${ctx.awarenessLevel}

BRAND VOICE:
- Tone: ${ctx.tone}
- Personality: ${ctx.personality.join(", ")}
- Use Keywords: ${ctx.keywords.join(", ")}
- Avoid Words: ${ctx.avoidWords.join(", ")}

CONTENT GOAL: ${ctx.primaryGoal}
`;

  if (ctx.featuredProduct) {
    summary += `
FEATURED PRODUCT:
- Name: ${ctx.featuredProduct.name}
- Description: ${ctx.featuredProduct.description}
- Benefits: ${ctx.featuredProduct.benefits?.join(", ") || ""}
`;
  }

  if (ctx.callToActions.length > 0) {
    summary += `
CALL TO ACTION: ${ctx.callToActions[0]}
`;
  }

  return summary.trim();
}

/**
 * Get industry preset settings
 * @param {string} userId - User ID
 * @param {string} industry - Industry
 */
export async function getIndustryPreset(userId, industry) {
  const context = await loadBrandContext(userId);
  return context.industryPresets?.[industry] || null;
}

/**
 * Check if brand context is complete
 * @param {string} userId - User ID
 */
export async function isBrandContextComplete(userId) {
  const context = await loadBrandContext(userId);
  return context.onboardingComplete &&
         context.business?.name &&
         context.business?.industry;
}

export default {
  loadBrandContext,
  saveBrandContext,
  updateBrandSection,
  completeOnboarding,
  addProduct,
  updateProduct,
  deleteProduct,
  getCTATemplates,
  getHookTemplates,
  generatePromptContext,
  generateBrandSummary,
  getIndustryPreset,
  isBrandContextComplete
};
