import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, "../../../data/brand_context.json");

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
 * Load brand context from file
 */
export function loadBrandContext() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const data = fs.readFileSync(DATA_PATH, "utf8");
      return JSON.parse(data);
    }
    return { ...DEFAULT_BRAND_CONTEXT };
  } catch (error) {
    console.error("Error loading brand context:", error);
    return { ...DEFAULT_BRAND_CONTEXT };
  }
}

/**
 * Save brand context to file
 */
export function saveBrandContext(context) {
  try {
    context.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DATA_PATH, JSON.stringify(context, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving brand context:", error);
    return false;
  }
}

/**
 * Update specific section of brand context
 */
export function updateBrandSection(section, data) {
  const context = loadBrandContext();
  if (context[section]) {
    context[section] = { ...context[section], ...data };
  } else {
    context[section] = data;
  }
  return saveBrandContext(context);
}

/**
 * Complete onboarding and mark brand context as setup
 */
export function completeOnboarding(brandData) {
  const context = loadBrandContext();

  // Merge in all the brand data
  if (brandData.business) context.business = { ...context.business, ...brandData.business };
  if (brandData.products) context.products = brandData.products;
  if (brandData.targetAudience) context.targetAudience = { ...context.targetAudience, ...brandData.targetAudience };
  if (brandData.brandVoice) context.brandVoice = { ...context.brandVoice, ...brandData.brandVoice };
  if (brandData.contentGoals) context.contentGoals = { ...context.contentGoals, ...brandData.contentGoals };

  context.onboardingComplete = true;
  return saveBrandContext(context);
}

/**
 * Add a product to the brand
 */
export function addProduct(product) {
  const context = loadBrandContext();
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
  saveBrandContext(context);
  return newProduct;
}

/**
 * Update a product
 */
export function updateProduct(productId, updates) {
  const context = loadBrandContext();
  const index = context.products.findIndex(p => p.id === productId);
  if (index !== -1) {
    context.products[index] = { ...context.products[index], ...updates };
    saveBrandContext(context);
    return context.products[index];
  }
  return null;
}

/**
 * Delete a product
 */
export function deleteProduct(productId) {
  const context = loadBrandContext();
  const index = context.products.findIndex(p => p.id === productId);
  if (index !== -1) {
    context.products.splice(index, 1);
    saveBrandContext(context);
    return true;
  }
  return false;
}

/**
 * Get CTA templates based on content goal and industry
 */
export function getCTATemplates(contentGoal, industry) {
  const context = loadBrandContext();
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
 */
export function getHookTemplates(industry) {
  const context = loadBrandContext();
  return context.templates?.hookTemplates?.[industry] || [];
}

/**
 * Generate brand-aware prompt context for AI script generation
 */
export function generatePromptContext() {
  const context = loadBrandContext();

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
 */
export function generateBrandSummary() {
  const ctx = generatePromptContext();

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
 */
export function getIndustryPreset(industry) {
  const context = loadBrandContext();
  return context.industryPresets?.[industry] || null;
}

/**
 * Check if brand context is complete
 */
export function isBrandContextComplete() {
  const context = loadBrandContext();
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
