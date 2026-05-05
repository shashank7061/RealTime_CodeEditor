/**
 * Jest test suite for the AI model fallback system.
 *
 * Tests extractText, friendlyError, model cooldown/recovery, and the
 * rate-limit-aware model chain that prevents cascading failures.
 */

// Set env before requiring aiService
process.env.API_KEY = process.env.API_KEY || 'test-key-not-used';
process.env.AI_MODELS = 'model-a,model-b,model-c';

const {
    extractText,
    friendlyError,
    availableModels,
    noteModelFailure,
} = require('../services/aiService');


// ═════════════════════════════════════════════════════════════════
// TEST SUITE 1: extractText
// ═════════════════════════════════════════════════════════════════
describe('extractText', () => {
    test('plain string → returned as-is', () => {
        expect(extractText('hello')).toBe('hello');
    });

    test('null/undefined → empty string', () => {
        expect(extractText(null)).toBe('');
        expect(extractText(undefined)).toBe('');
    });

    test('array of parts → extracts text parts only', () => {
        const parts = [
            { type: 'text', text: 'The bug is here.' },
            { type: 'functionCall', functionCall: { name: 'apply_code_fix', args: {} } },
        ];
        expect(extractText(parts)).toBe('The bug is here.');
    });

    test('thinking/reasoning parts are filtered out', () => {
        const parts = [
            { text: 'internal reasoning...', thought: true },
            { text: 'The answer.' },
        ];
        expect(extractText(parts)).toBe('The answer.');
    });

    test('parts with no text → empty string (no [object Object])', () => {
        expect(extractText([{ functionCall: { name: 'x' } }])).toBe('');
    });

    test('mixed string and object parts', () => {
        const parts = [{ type: 'text', text: 'a' }, 'b'];
        expect(extractText(parts)).toBe('ab');
    });
});


// ═════════════════════════════════════════════════════════════════
// TEST SUITE 2: friendlyError
// ═════════════════════════════════════════════════════════════════
describe('friendlyError', () => {
    test('429 quota error → human-friendly with retry time', () => {
        const err = new Error(
            '[GoogleGenerativeAI Error]: [429 Too Many Requests] quota exceeded. Please retry in 52.688s. [{"@type":"QuotaFailure"}]'
        );
        const friendly = friendlyError(err);
        expect(friendly).not.toContain('@type');
        expect(friendly).toMatch(/53s/);
    });

    test('404 retired model → "not available" message', () => {
        const err = new Error('[404 Not Found] models/gemini-2.0-flash is no longer available.');
        expect(friendlyError(err)).toMatch(/not available/i);
    });

    test('403 auth error → mentions API key', () => {
        const err = new Error('403 permission denied on API key');
        expect(friendlyError(err)).toMatch(/API key/i);
    });

    test('generic error → passed through unchanged', () => {
        expect(friendlyError(new Error('socket hang up'))).toBe('socket hang up');
    });
});


// ═════════════════════════════════════════════════════════════════
// TEST SUITE 3: Model cooldown chain
// ═════════════════════════════════════════════════════════════════
describe('model cooldown chain', () => {
    test('starts with all models available', () => {
        expect(availableModels()).toEqual(['model-a', 'model-b', 'model-c']);
    });

    test('429 error removes that model from the chain', () => {
        const quota = new Error('[429 Too Many Requests] quota');
        noteModelFailure('model-a', quota);
        expect(availableModels()).not.toContain('model-a');
    });

    test('non-429 error does NOT trigger cooldown', () => {
        noteModelFailure('model-b', new Error('transient socket hang up'));
        expect(availableModels()).toContain('model-b');
    });

    test('all models cooled down → full chain attempted (never empty)', () => {
        const quota = new Error('[429] quota');
        noteModelFailure('model-a', quota);
        noteModelFailure('model-b', quota);
        noteModelFailure('model-c', quota);
        // When everything is down, try them all rather than returning empty
        expect(availableModels()).toEqual(['model-a', 'model-b', 'model-c']);
    });

    test('cooldown expires and model returns', (done) => {
        const shortQuota = new Error('[429] retry in 0.001s.');
        noteModelFailure('model-a', shortQuota);
        setTimeout(() => {
            expect(availableModels()).toContain('model-a');
            done();
        }, 1200);
    });
});
