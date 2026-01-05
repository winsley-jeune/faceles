/**
 * Input Sanitizer Utility
 * SECURITY: Prevents prompt injection and validates user inputs
 */

// Allowed niches - whitelist for validation
const ALLOWED_NICHES = [
    'general', 'tech', 'finance', 'money', 'health', 'education',
    'entertainment', 'lifestyle', 'business', 'psychology',
    'science', 'motivation', 'productivity', 'relationships',
    'travel', 'food', 'fitness', 'gaming', 'news', 'sports',
    'auto', 'secrets', 'workplace', 'workplace-secrets'
];

// Dangerous patterns that might indicate prompt injection
const DANGEROUS_PATTERNS = [
    /ignore\s*(all\s*)?(previous|above|prior)\s*(instructions?|prompts?|rules?)/i,
    /forget\s*(all\s*)?(previous|above|prior)\s*(instructions?|prompts?|rules?)/i,
    /disregard\s*(all\s*)?(previous|above|prior)/i,
    /new\s*instructions?:/i,
    /system\s*prompt/i,
    /jailbreak/i,
    /bypass\s*(filters?|rules?|restrictions?)/i,
    /act\s*as\s*(if\s*you\s*are|a)/i,
    /pretend\s*(to\s*be|you\s*are)/i,
    /roleplay\s*as/i,
    /you\s*are\s*now/i,
    /from\s*now\s*on/i,
    /```[\s\S]*```/,  // Code blocks (potential injection containers)
    /\{%[\s\S]*%\}/,  // Template syntax
    /<script[\s\S]*>/i,  // Script tags
    /\$\{[\s\S]*\}/,  // Template literals
];

/**
 * Sanitize text input for use in AI prompts
 * Removes or escapes characters that could break prompt structure
 * @param {string} text - Input text to sanitize
 * @param {number} maxLength - Maximum allowed length (default 1000)
 * @returns {string} Sanitized text
 */
export const sanitizePromptInput = (text, maxLength = 1000) => {
    if (!text || typeof text !== 'string') {
        return '';
    }

    return text
        .replace(/`/g, "'")           // Replace backticks with single quotes
        .replace(/\$/g, 'S')          // Replace dollar signs
        .replace(/\n+/g, ' ')         // Replace newlines with spaces
        .replace(/\r/g, '')           // Remove carriage returns
        .replace(/\t/g, ' ')          // Replace tabs with spaces
        .replace(/\s+/g, ' ')         // Collapse multiple spaces
        .replace(/[<>]/g, '')         // Remove angle brackets
        .trim()
        .substring(0, maxLength);
};

/**
 * Validate niche against whitelist
 * @param {string} niche - Niche to validate
 * @returns {string} Validated niche or 'general' as fallback
 */
export const validateNiche = (niche) => {
    if (!niche || typeof niche !== 'string') {
        return 'general';
    }

    const normalizedNiche = niche.toLowerCase().trim();

    if (ALLOWED_NICHES.includes(normalizedNiche)) {
        return normalizedNiche;
    }

    // Log suspicious niche attempts
    console.warn(`[SECURITY] Invalid niche attempted: "${niche.substring(0, 50)}"`);
    return 'general';
};

/**
 * Validate topic for suspicious content
 * @param {string} topic - Topic to validate
 * @returns {{ valid: boolean, topic: string, reason?: string }}
 */
export const validateTopic = (topic) => {
    if (!topic || typeof topic !== 'string') {
        return { valid: false, topic: '', reason: 'Topic must be a non-empty string' };
    }

    const trimmedTopic = topic.trim();

    // Check length
    if (trimmedTopic.length > 500) {
        return {
            valid: false,
            topic: trimmedTopic.substring(0, 500),
            reason: 'Topic exceeds maximum length of 500 characters'
        };
    }

    if (trimmedTopic.length < 3) {
        return {
            valid: false,
            topic: trimmedTopic,
            reason: 'Topic must be at least 3 characters'
        };
    }

    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(trimmedTopic)) {
            console.warn(`[SECURITY] Suspicious topic pattern detected: "${trimmedTopic.substring(0, 100)}"`);
            return {
                valid: false,
                topic: '',
                reason: 'Topic contains suspicious content patterns'
            };
        }
    }

    return { valid: true, topic: trimmedTopic };
};

/**
 * Sanitize video title from external sources (YouTube, TikTok, etc.)
 * These are used in viral intelligence prompts
 * @param {string} title - Video title to sanitize
 * @returns {string} Sanitized title
 */
export const sanitizeVideoTitle = (title) => {
    if (!title || typeof title !== 'string') {
        return 'Untitled';
    }

    return title
        .replace(/[`${}]/g, '')       // Remove potential injection chars
        .replace(/\n/g, ' ')          // Remove newlines
        .replace(/[<>]/g, '')         // Remove angle brackets
        .trim()
        .substring(0, 200);           // Limit length
};

/**
 * Sanitize brand context before embedding in prompts
 * @param {string} brandSummary - Brand summary text
 * @returns {string} Sanitized brand summary
 */
export const sanitizeBrandContext = (brandSummary) => {
    if (!brandSummary || typeof brandSummary !== 'string') {
        return '';
    }

    return brandSummary
        .replace(/`/g, "'")
        .replace(/\$/g, 'S')
        .replace(/\n{3,}/g, '\n\n')   // Max 2 newlines
        .replace(/[<>]/g, '')
        .trim()
        .substring(0, 2000);          // Reasonable limit for brand context
};

/**
 * Sanitize CTA templates
 * @param {string} cta - CTA template text
 * @returns {string} Sanitized CTA
 */
export const sanitizeCTA = (cta) => {
    if (!cta || typeof cta !== 'string') {
        return '';
    }

    return cta
        .replace(/[`${}]/g, '')
        .replace(/\n/g, ' ')
        .trim()
        .substring(0, 200);
};

/**
 * Get list of allowed niches
 * @returns {string[]} Array of allowed niche names
 */
export const getAllowedNiches = () => [...ALLOWED_NICHES];

export default {
    sanitizePromptInput,
    validateNiche,
    validateTopic,
    sanitizeVideoTitle,
    sanitizeBrandContext,
    sanitizeCTA,
    getAllowedNiches
};
