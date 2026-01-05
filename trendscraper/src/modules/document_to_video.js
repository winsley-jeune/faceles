/**
 * Document to Video Conversion Module
 * Converts PDFs, Word docs, and other documents into training videos
 *
 * Features:
 * - PDF text extraction
 * - Document structure analysis
 * - Automatic script generation
 * - Section-based video segmentation
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Supported document types
const SUPPORTED_TYPES = {
    PDF: ['.pdf'],
    WORD: ['.doc', '.docx'],
    TEXT: ['.txt', '.md'],
    POWERPOINT: ['.ppt', '.pptx']
};

/**
 * Check if file type is supported
 */
export const isSupportedDocument = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    return Object.values(SUPPORTED_TYPES).flat().includes(ext);
};

/**
 * Extract text from PDF using pdf-parse
 */
const extractPDFText = async (filePath) => {
    try {
        // Dynamic import for pdf-parse
        const pdfParse = (await import('pdf-parse')).default;
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);

        return {
            text: data.text,
            pages: data.numpages,
            metadata: data.info
        };
    } catch (error) {
        console.error('PDF extraction failed:', error.message);
        // Fallback: return empty with error message
        return {
            text: '',
            pages: 0,
            error: error.message
        };
    }
};

/**
 * Extract text from plain text files
 */
const extractTextFile = async (filePath) => {
    const text = fs.readFileSync(filePath, 'utf-8');
    return {
        text,
        pages: Math.ceil(text.length / 3000), // Rough page estimate
        metadata: {}
    };
};

/**
 * Extract text from Word documents using mammoth
 */
const extractWordText = async (filePath) => {
    try {
        const mammoth = (await import('mammoth')).default;
        const result = await mammoth.extractRawText({ path: filePath });

        return {
            text: result.value,
            pages: Math.ceil(result.value.length / 3000),
            metadata: {}
        };
    } catch (error) {
        console.error('Word extraction failed:', error.message);
        return {
            text: '',
            pages: 0,
            error: error.message
        };
    }
};

/**
 * Extract text from document based on type
 */
export const extractDocumentText = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();

    console.log(`📄 Extracting text from: ${path.basename(filePath)}`);

    if (SUPPORTED_TYPES.PDF.includes(ext)) {
        return extractPDFText(filePath);
    } else if (SUPPORTED_TYPES.WORD.includes(ext)) {
        return extractWordText(filePath);
    } else if (SUPPORTED_TYPES.TEXT.includes(ext)) {
        return extractTextFile(filePath);
    } else {
        throw new Error(`Unsupported document type: ${ext}`);
    }
};

/**
 * Analyze document structure using AI
 */
export const analyzeDocumentStructure = async (text, options = {}) => {
    const {
        videoType = 'training',
        targetDuration = 180
    } = options;

    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is required for document analysis");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Truncate text if too long
    const maxChars = 15000;
    const truncatedText = text.length > maxChars
        ? text.substring(0, maxChars) + '...[truncated]'
        : text;

    const prompt = `
Analyze this document and extract its structure for creating a ${videoType} training video.

DOCUMENT TEXT:
${truncatedText}

OUTPUT A JSON OBJECT with this structure:
{
    "title": "Main title/topic of the document",
    "summary": "Brief 1-2 sentence summary",
    "sections": [
        {
            "heading": "Section heading",
            "content": "Key content from this section (1-2 sentences)",
            "type": "introduction|key_point|procedure|warning|summary",
            "importance": "high|medium|low"
        }
    ],
    "keyPoints": ["List of 3-5 most important points"],
    "steps": ["If procedural, list the main steps"],
    "warnings": ["Any safety warnings or cautions mentioned"],
    "estimatedReadTime": number (in seconds)
}

Focus on:
- Identifying the main topic and purpose
- Breaking content into logical sections
- Extracting actionable steps if it's a procedure
- Highlighting warnings or important notes
- Keeping content concise for video narration

RESPOND WITH ONLY THE JSON OBJECT, no markdown formatting.
`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Clean JSON from response
        let jsonText = responseText;
        if (jsonText.includes('```')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        }

        const structure = JSON.parse(jsonText.trim());

        console.log(`   ✅ Document analyzed: "${structure.title}"`);
        console.log(`   📑 Found ${structure.sections?.length || 0} sections`);

        return structure;
    } catch (error) {
        console.error('Document analysis failed:', error.message);

        // Return basic structure on failure
        return {
            title: 'Document Training',
            summary: text.substring(0, 200),
            sections: [{
                heading: 'Content',
                content: text.substring(0, 500),
                type: 'key_point',
                importance: 'high'
            }],
            keyPoints: [],
            steps: [],
            warnings: [],
            estimatedReadTime: Math.ceil(text.length / 15) // ~15 chars per second spoken
        };
    }
};

/**
 * Convert document structure to training video format
 */
export const convertToTrainingData = (documentStructure, options = {}) => {
    const {
        videoType = 'training',
        targetDuration = 180,
        company = '',
        targetAudience = 'Employees'
    } = options;

    const trainingData = {
        title: documentStructure.title || 'Training Video',
        description: documentStructure.summary || '',
        videoType,
        targetAudience,
        company,
        duration: targetDuration,
        keyPoints: documentStructure.keyPoints || [],
        steps: documentStructure.steps || [],
        cta: {
            type: 'complete_training',
            customText: null
        }
    };

    // Add warnings as key points for safety videos
    if (videoType === 'safety' && documentStructure.warnings?.length > 0) {
        trainingData.keyPoints = [
            ...documentStructure.warnings.map(w => `⚠️ ${w}`),
            ...trainingData.keyPoints
        ];
    }

    // If no steps but has sections, convert sections to steps
    if (trainingData.steps.length === 0 && documentStructure.sections?.length > 0) {
        trainingData.steps = documentStructure.sections
            .filter(s => s.importance !== 'low')
            .map(s => s.content);
    }

    return trainingData;
};

/**
 * Full document to training video conversion pipeline
 */
export const documentToTrainingVideo = async (filePath, options = {}) => {
    console.log('📄 Starting Document to Training Video conversion...');

    // 1. Extract text from document
    const extracted = await extractDocumentText(filePath);

    if (!extracted.text || extracted.text.trim().length === 0) {
        throw new Error('Could not extract text from document');
    }

    console.log(`   📝 Extracted ${extracted.text.length} characters from ${extracted.pages} pages`);

    // 2. Analyze document structure
    const structure = await analyzeDocumentStructure(extracted.text, options);

    // 3. Convert to training data format
    const trainingData = convertToTrainingData(structure, options);

    console.log('   ✅ Document converted to training format');

    return {
        trainingData,
        documentInfo: {
            pages: extracted.pages,
            characters: extracted.text.length,
            estimatedReadTime: structure.estimatedReadTime
        },
        structure
    };
};

/**
 * Generate storyboard directly from document
 */
export const documentToStoryboard = async (filePath, options = {}) => {
    const { trainingData, structure } = await documentToTrainingVideo(filePath, options);

    // Import training video generator
    const trainingVideoGenerator = (await import('./training_video_generator.js')).default;

    // Generate storyboard using training video generator
    const result = await trainingVideoGenerator.generateTrainingStoryboard(trainingData);

    return {
        ...result,
        documentInfo: {
            title: structure.title,
            sections: structure.sections?.length || 0
        }
    };
};

/**
 * Get supported file extensions
 */
export const getSupportedExtensions = () => {
    return Object.values(SUPPORTED_TYPES).flat();
};

/**
 * Validate document file
 */
export const validateDocument = (filePath) => {
    if (!fs.existsSync(filePath)) {
        return { valid: false, error: 'File not found' };
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!isSupportedDocument(filePath)) {
        return {
            valid: false,
            error: `Unsupported file type: ${ext}. Supported: ${getSupportedExtensions().join(', ')}`
        };
    }

    const stats = fs.statSync(filePath);
    const maxSize = 50 * 1024 * 1024; // 50MB limit
    if (stats.size > maxSize) {
        return { valid: false, error: 'File too large. Maximum size is 50MB' };
    }

    return { valid: true };
};

export default {
    extractDocumentText,
    analyzeDocumentStructure,
    convertToTrainingData,
    documentToTrainingVideo,
    documentToStoryboard,
    isSupportedDocument,
    getSupportedExtensions,
    validateDocument,
    SUPPORTED_TYPES
};
