/**
 * Training Routes
 * ML training data management + Training Video Generation
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import trainingController from '../controllers/trainingController.js';
import trainingVideoController from '../controllers/trainingVideoController.js';

const router = Router();

// Apply authentication to all training routes
router.use(requireAuth);

// ============================================
// TRAINING VIDEO GENERATION ROUTES
// ============================================

// GET /training/video/types - Get available training video types
router.get('/video/types', asyncHandler(trainingVideoController.getVideoTypes));

// GET /training/video/template/:videoType - Get template details
router.get('/video/template/:videoType', asyncHandler(trainingVideoController.getTemplateDetails));

// POST /training/video/upload-media - Upload training media
router.post('/video/upload-media', trainingVideoController.uploadMiddleware, asyncHandler(trainingVideoController.uploadMedia));

// POST /training/video/preview - Preview storyboard without rendering
router.post('/video/preview', asyncHandler(trainingVideoController.previewStoryboard));

// POST /training/video/generate - Generate full training video
router.post('/video/generate', asyncHandler(trainingVideoController.generateVideo));

// ============================================
// DOCUMENT TO VIDEO ROUTES
// ============================================

// GET /training/document/supported - Get supported document types
router.get('/document/supported', asyncHandler(trainingVideoController.getSupportedDocuments));

// POST /training/document/upload - Upload document for conversion
router.post('/document/upload', trainingVideoController.uploadMiddleware, asyncHandler(trainingVideoController.uploadDocument));

// POST /training/document/analyze - Analyze document structure
router.post('/document/analyze', asyncHandler(trainingVideoController.analyzeDocument));

// POST /training/document/convert - Convert document to training video
router.post('/document/convert', asyncHandler(trainingVideoController.documentToVideo));

// ============================================
// ML TRAINING DATA ROUTES
// ============================================

// GET /training/stats - Get training data stats
router.get('/stats', asyncHandler(trainingController.getStats));

// GET /training/samples - Get all training samples
router.get('/samples', asyncHandler(trainingController.getSamples));

// GET /training/samples/:sampleId - Get specific training sample
router.get('/samples/:sampleId', asyncHandler(trainingController.getSampleById));

// POST /training/samples/:sampleId/performance - Update sample performance
router.post('/samples/:sampleId/performance', asyncHandler(trainingController.updatePerformance));

// GET /training/export/csv - Export training data as CSV
router.get('/export/csv', asyncHandler(trainingController.exportCSV));

// GET /training/export/embeddings - Export embeddings
router.get('/export/embeddings', asyncHandler(trainingController.exportEmbeddings));

// GET /training/export/jsonl - Export as JSONL
router.get('/export/jsonl', asyncHandler(trainingController.exportJSONL));

// GET /training/labeled - Get labeled training data
router.get('/labeled', asyncHandler(trainingController.getLabeled));

// POST /training/sync-analytics - Sync analytics to training data
router.post('/sync-analytics', asyncHandler(trainingController.syncAnalytics));

export default router;
