/**
 * LLM adapter — the single seam between this codebase and the LLM provider.
 *
 * Provider: Anthropic (Claude). Model: claude-opus-4-8.
 * This replaces the former Google Gemini (@google/generative-ai) integration.
 * Every LLM call in the platform should go through generateText() / generateJSON()
 * here, so the provider lives in exactly one file.
 *
 * NOTE: this is the LLM only. Google's `googleapis` (YouTube OAuth/upload) is unrelated
 * and is NOT replaced.
 */
import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-opus-4-8';
const DEFAULT_MAX_TOKENS = 16000; // safe under SDK HTTP timeout for non-streaming

let _client = null;

/** Lazily construct the client so a missing key fails loud at call time, not import time. */
function client() {
    if (!_client) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error(
                'ANTHROPIC_API_KEY is not set. The LLM provider (Claude) cannot run without it.'
            );
        }
        _client = new Anthropic({ apiKey });
    }
    return _client;
}

/**
 * Generate plain text from a prompt.
 * @param {string} prompt
 * @param {{ system?: string, model?: string, maxTokens?: number }} [opts]
 * @returns {Promise<string>} the model's text output
 */
export async function generateText(prompt, opts = {}) {
    if (typeof prompt !== 'string' || prompt.trim() === '') {
        throw new Error('generateText: prompt must be a non-empty string');
    }
    const { system, model = DEFAULT_MODEL, maxTokens = DEFAULT_MAX_TOKENS } = opts;

    const params = {
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
    };
    if (system) params.system = system;

    const response = await client().messages.create(params);

    if (response.stop_reason === 'refusal') {
        throw new Error('LLM declined the request (stop_reason: refusal).');
    }
    // Concatenate all text blocks (there is normally one).
    const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
    if (!text) {
        throw new Error('LLM returned no text content.');
    }
    return text;
}

/**
 * Extract a JSON value from model text that may be fenced or surrounded by prose.
 * Throws if no valid JSON object/array can be parsed.
 */
export function extractJson(text) {
    let s = text.trim();
    // Strip ```json ... ``` or ``` ... ``` fences if present.
    const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fence) s = fence[1].trim();

    try {
        return JSON.parse(s);
    } catch {
        // Fall back to the outermost { } or [ ] span.
        const firstObj = s.indexOf('{');
        const firstArr = s.indexOf('[');
        let start = -1;
        if (firstObj === -1) start = firstArr;
        else if (firstArr === -1) start = firstObj;
        else start = Math.min(firstObj, firstArr);
        if (start === -1) throw new Error('No JSON found in LLM output.');
        const open = s[start];
        const close = open === '{' ? '}' : ']';
        const end = s.lastIndexOf(close);
        if (end <= start) throw new Error('Malformed JSON in LLM output.');
        return JSON.parse(s.slice(start, end + 1));
    }
}

/**
 * Generate a JSON value from a prompt. Instructs the model to return JSON only,
 * then robustly parses it.
 * @param {string} prompt
 * @param {{ system?: string, model?: string, maxTokens?: number }} [opts]
 * @returns {Promise<any>} parsed JSON
 */
export async function generateJSON(prompt, opts = {}) {
    const jsonSystem =
        'Return ONLY valid JSON. No markdown fences, no commentary, no prose before or after.';
    const system = opts.system ? `${opts.system}\n\n${jsonSystem}` : jsonSystem;
    const text = await generateText(prompt, { ...opts, system });
    return extractJson(text);
}

export default { generateText, generateJSON, extractJson };
