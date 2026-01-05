/**
 * Brand Routes
 * Brand context and settings management
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import brandController from '../controllers/brandController.js';

const router = Router();

// Apply authentication to all brand routes
router.use(requireAuth);

// GET /brand/context - Get brand context
router.get('/context', asyncHandler(brandController.getContext));

// POST /brand/context - Save brand context
router.post('/context', asyncHandler(brandController.saveContext));

// POST /brand/onboarding - Complete brand onboarding
router.post('/onboarding', asyncHandler(brandController.completeOnboarding));

// PATCH /brand/context/:section - Update specific brand section
router.patch('/context/:section', asyncHandler(brandController.updateSection));

// GET /brand/status - Get brand setup status
router.get('/status', asyncHandler(brandController.getStatus));

// GET /brand/prompt-context - Get prompt context for AI
router.get('/prompt-context', asyncHandler(brandController.getPromptContext));

// GET /brand/summary - Get brand summary
router.get('/summary', asyncHandler(brandController.getSummary));

// POST /brand/products - Add product
router.post('/products', asyncHandler(brandController.addProduct));

// PUT /brand/products/:productId - Update product
router.put('/products/:productId', asyncHandler(brandController.updateProduct));

// DELETE /brand/products/:productId - Delete product
router.delete('/products/:productId', asyncHandler(brandController.deleteProduct));

// GET /brand/templates/cta/:goal - Get CTA templates by goal
router.get('/templates/cta/:goal', asyncHandler(brandController.getCTATemplates));

// GET /brand/templates/hooks/:industry - Get hook templates by industry
router.get('/templates/hooks/:industry', asyncHandler(brandController.getHookTemplates));

// GET /brand/presets/:industry - Get industry presets
router.get('/presets/:industry', asyncHandler(brandController.getIndustryPreset));

export default router;
