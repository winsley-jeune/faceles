/**
 * Brand Controller
 * Brand identity, context, and content goal management
 * Powers AI prompts with brand-specific context
 * Multi-tenant with user isolation
 */
import brandContext from '../modules/brand_context.js';

const brandController = {
    getContext: async (req, res) => {
        const userId = req.user.id;
        const context = await brandContext.loadBrandContext(userId);
        res.json(context);
    },

    saveContext: async (req, res) => {
        const userId = req.user.id;
        const success = await brandContext.saveBrandContext(userId, req.body);
        if (success) {
            res.json({ success: true, message: "Brand context saved" });
        } else {
            res.status(500).json({ error: "Failed to save brand context" });
        }
    },

    completeOnboarding: async (req, res) => {
        const userId = req.user.id;
        const success = await brandContext.completeOnboarding(userId, req.body);
        if (success) {
            res.json({ success: true, message: "Brand onboarding complete!" });
        } else {
            res.status(500).json({ error: "Failed to complete onboarding" });
        }
    },

    updateSection: async (req, res) => {
        const userId = req.user.id;
        const { section } = req.params;
        const success = await brandContext.updateBrandSection(userId, section, req.body);
        if (success) {
            res.json({ success: true, message: `${section} updated` });
        } else {
            res.status(500).json({ error: `Failed to update ${section}` });
        }
    },

    getStatus: async (req, res) => {
        const userId = req.user.id;
        const context = await brandContext.loadBrandContext(userId);
        const isComplete = await brandContext.isBrandContextComplete(userId);
        res.json({
            onboardingComplete: context.onboardingComplete,
            isComplete,
            businessName: context.business?.name || null,
            industry: context.business?.industry || null,
            primaryGoal: context.contentGoals?.primary || null,
            productsCount: context.products?.length || 0
        });
    },

    getPromptContext: async (req, res) => {
        const userId = req.user.id;
        const promptContext = await brandContext.generatePromptContext(userId);
        if (promptContext) {
            res.json({ hasContext: true, ...promptContext });
        } else {
            res.json({
                hasContext: false,
                message: "Brand context not configured. Complete onboarding first."
            });
        }
    },

    getSummary: async (req, res) => {
        const userId = req.user.id;
        const summary = await brandContext.generateBrandSummary(userId);
        res.json({
            hasSummary: summary.length > 0,
            summary
        });
    },

    // Product management
    addProduct: async (req, res) => {
        const userId = req.user.id;
        const product = await brandContext.addProduct(userId, req.body);
        res.json({ success: true, product });
    },

    updateProduct: async (req, res) => {
        const userId = req.user.id;
        const { productId } = req.params;
        const product = await brandContext.updateProduct(userId, productId, req.body);
        if (product) {
            res.json({ success: true, product });
        } else {
            res.status(404).json({ error: "Product not found" });
        }
    },

    deleteProduct: async (req, res) => {
        const userId = req.user.id;
        const { productId } = req.params;
        const success = await brandContext.deleteProduct(userId, productId);
        if (success) {
            res.json({ success: true, message: "Product deleted" });
        } else {
            res.status(404).json({ error: "Product not found" });
        }
    },

    // Templates
    getCTATemplates: async (req, res) => {
        const userId = req.user.id;
        const { goal } = req.params;
        const templates = await brandContext.getCTATemplates(userId, goal);
        res.json({ goal, templates });
    },

    getHookTemplates: async (req, res) => {
        const userId = req.user.id;
        const { industry } = req.params;
        const templates = await brandContext.getHookTemplates(userId, industry);
        res.json({ industry, templates });
    },

    getIndustryPreset: async (req, res) => {
        const userId = req.user.id;
        const { industry } = req.params;
        const preset = await brandContext.getIndustryPreset(userId, industry);
        if (preset) {
            res.json({ industry, preset });
        } else {
            res.json({
                industry,
                preset: null,
                message: "No preset for this industry"
            });
        }
    }
};

export default brandController;
