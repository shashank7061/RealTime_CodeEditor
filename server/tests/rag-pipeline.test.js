/**
 * Jest test suite for the RAG pipeline's pure functions.
 *
 * Tests cosineSimilarity, tokenize, lexicalScore, chunkCode, hashContent,
 * and buildEmbeddingText — the core building blocks of the retrieval system.
 */

// ─── Load embeddingService functions ───
const { chunkCode, hashContent, buildEmbeddingText } = require('../services/embeddingService');

// ─── Extract internal pure functions from vectorStoreService ───
// These are not exported, so we replicate them exactly as written in the source.
// This is a common pattern: extract pure logic into a shared utils file later.

const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
    'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'as', 'it', 'this',
    'that', 'these', 'those', 'i', 'you', 'me', 'my', 'we', 'do', 'does', 'did',
    'what', 'how', 'why', 'when', 'where', 'which', 'who', 'can', 'could', 'would',
    'should', 'please', 'tell', 'show', 'give', 'explain', 'about', 'all', 'any',
]);

function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

function tokenize(text) {
    if (!text) return [];
    const raw = String(text)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
    return [...new Set(raw)];
}

function lexicalScore(terms, doc) {
    if (terms.length === 0) return 0;
    const haystack = `${doc.filePath || ''} ${doc.fileName || ''}`.toLowerCase();
    const body = (doc.chunk || doc.text || '').toLowerCase();
    let matched = 0;
    for (const term of terms) {
        const inName = haystack.includes(term);
        const inBody = body.includes(term);
        if (inName && inBody) matched += 1;
        else if (inName) matched += 0.8;
        else if (inBody) matched += 0.5;
    }
    return Math.min(1, matched / terms.length);
}


// ═════════════════════════════════════════════════════════════════
// TEST SUITE 1: cosineSimilarity
// ═════════════════════════════════════════════════════════════════
describe('cosineSimilarity', () => {
    test('identical vectors → 1.0', () => {
        expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0);
    });

    test('opposite vectors → -1.0', () => {
        expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
    });

    test('orthogonal (perpendicular) vectors → 0.0', () => {
        expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
    });

    test('zero vector → 0 (no division-by-zero crash)', () => {
        expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
        expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
    });

    test('null/undefined → 0', () => {
        expect(cosineSimilarity(null, [1])).toBe(0);
        expect(cosineSimilarity([1], undefined)).toBe(0);
    });

    test('mismatched lengths → 0', () => {
        expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });

    test('magnitude does not affect similarity (direction only)', () => {
        // [1,2,3] and [10,20,30] point in the same direction
        expect(cosineSimilarity([1, 2, 3], [10, 20, 30])).toBeCloseTo(1.0);
    });
});


// ═════════════════════════════════════════════════════════════════
// TEST SUITE 2: tokenize
// ═════════════════════════════════════════════════════════════════
describe('tokenize', () => {
    test('splits camelCase → individual tokens', () => {
        const t = tokenize('useWebRTC');
        expect(t).toContain('use');
        expect(t).toContain('web');
        expect(t).toContain('rtc');
    });

    test('splits snake_case', () => {
        const t = tokenize('user_auth_service');
        expect(t).toContain('user');
        expect(t).toContain('auth');
        expect(t).toContain('service');
    });

    test('removes stopwords', () => {
        expect(tokenize('what is the function for this')).toEqual(['function']);
    });

    test('removes single-char tokens', () => {
        expect(tokenize('a b c function')).toEqual(['function']);
    });

    test('deduplicates', () => {
        expect(tokenize('editor editor editor')).toEqual(['editor']);
    });

    test('null/empty → []', () => {
        expect(tokenize(null)).toEqual([]);
        expect(tokenize('')).toEqual([]);
    });

    test('realistic AI query', () => {
        const t = tokenize('How does the editor component handle code changes?');
        expect(t).toContain('editor');
        expect(t).toContain('code');
        expect(t).not.toContain('how');
        expect(t).not.toContain('the');
    });
});


// ═════════════════════════════════════════════════════════════════
// TEST SUITE 3: lexicalScore
// ═════════════════════════════════════════════════════════════════
describe('lexicalScore', () => {
    const doc = {
        fileName: 'useWebRTC.js',
        filePath: 'hooks/useWebRTC.js',
        chunk: 'export function useWebRTC() { const peer = new RTCPeerConnection(); }',
    };

    test('filename match → high score', () => {
        expect(lexicalScore(['usewebrtc'], doc)).toBeGreaterThan(0.5);
    });

    test('filename match beats body-only match', () => {
        expect(lexicalScore(['usewebrtc'], doc))
            .toBeGreaterThan(lexicalScore(['peer'], doc));
    });

    test('no matches → 0', () => {
        expect(lexicalScore(['database', 'mongodb'], doc)).toBe(0);
    });

    test('empty terms → 0', () => {
        expect(lexicalScore([], doc)).toBe(0);
    });

    test('term in BOTH name + body scores highest (1.0)', () => {
        // "usewebrtc" appears in both fileName and chunk
        expect(lexicalScore(['usewebrtc'], doc)).toBe(1);
    });

    test('score capped at 1.0', () => {
        expect(lexicalScore(['usewebrtc'], doc)).toBeLessThanOrEqual(1.0);
    });
});


// ═════════════════════════════════════════════════════════════════
// TEST SUITE 4: chunkCode
// ═════════════════════════════════════════════════════════════════
describe('chunkCode', () => {
    test('empty/null → []', () => {
        expect(chunkCode('')).toEqual([]);
        expect(chunkCode(null)).toEqual([]);
        expect(chunkCode('   ')).toEqual([]);
    });

    test('small code → single chunk with correct line numbers', () => {
        const chunks = chunkCode('const x = 42;\nconsole.log(x);');
        expect(chunks).toHaveLength(1);
        expect(chunks[0].startLine).toBe(1);
        expect(chunks[0].endLine).toBe(2);
    });

    test('splits at function boundaries', () => {
        // chunkCode only splits at boundaries when accumulated size > 50 chars
        const code = [
            'function calculateTotal(items) {',
            '  let total = 0;',
            '  for (const item of items) {',
            '    total += item.price * item.quantity;',
            '  }',
            '  return total;',
            '}',
            '',
            'function formatCurrency(amount) {',
            '  return `$${amount.toFixed(2)}`;',
            '}',
        ].join('\n');
        const chunks = chunkCode(code);
        expect(chunks.length).toBeGreaterThanOrEqual(2);
        expect(chunks[0].text).toContain('calculateTotal');
        expect(chunks[chunks.length - 1].text).toContain('formatCurrency');
    });

    test('forces split on large content', () => {
        const lines = Array.from({ length: 100 }, (_, i) =>
            `console.log("line ${i}"); // extra padding text here`
        );
        const chunks = chunkCode(lines.join('\n'), { maxChunkSize: 500 });
        expect(chunks.length).toBeGreaterThan(1);
    });

    test('last chunk ends at final line', () => {
        const lines = Array.from({ length: 50 }, (_, i) => `line_${i}_padding_text`);
        const chunks = chunkCode(lines.join('\n'), { maxChunkSize: 200 });
        expect(chunks[chunks.length - 1].endLine).toBe(50);
    });

    test('overlap carries context between splits', () => {
        const lines = Array.from({ length: 60 }, (_, i) => `line_${i}_padding_text`);
        const chunks = chunkCode(lines.join('\n'), { maxChunkSize: 300, overlapLines: 3 });
        if (chunks.length >= 2) {
            expect(chunks[1].startLine).toBeLessThanOrEqual(chunks[0].endLine);
        }
    });

    test('recognizes Python def as block boundary', () => {
        const code = [
            'def login(user, password):',
            '    validated = validate_credentials(user, password)',
            '    token = create_jwt_token(user, validated)',
            '    return token',
            '',
            'def logout(user):',
            '    revoke_all_tokens(user)',
            '    clear_session(user)',
        ].join('\n');
        expect(chunkCode(code).length).toBeGreaterThanOrEqual(2);
    });

    test('recognizes Express routes as boundaries', () => {
        const code = [
            'app.get("/api/users", async (req, res) => {',
            '  const users = await User.find({}).select("name email");',
            '  res.json({ users, count: users.length });',
            '});',
            '',
            'app.post("/api/users", async (req, res) => {',
            '  const user = await User.create(req.body);',
            '  res.status(201).json(user);',
            '});',
        ].join('\n');
        expect(chunkCode(code).length).toBeGreaterThanOrEqual(2);
    });
});


// ═════════════════════════════════════════════════════════════════
// TEST SUITE 5: hashContent
// ═════════════════════════════════════════════════════════════════
describe('hashContent', () => {
    test('same content → same hash (deterministic)', () => {
        expect(hashContent('hello')).toBe(hashContent('hello'));
    });

    test('different content → different hash', () => {
        expect(hashContent('a')).not.toBe(hashContent('b'));
    });

    test('returns valid hex SHA-1 (40 chars)', () => {
        expect(hashContent('test')).toMatch(/^[a-f0-9]{40}$/);
    });

    test('handles null/undefined without crashing', () => {
        expect(() => hashContent(null)).not.toThrow();
        expect(() => hashContent(undefined)).not.toThrow();
    });

    test('whitespace matters', () => {
        expect(hashContent('a  b')).not.toBe(hashContent('a b'));
    });
});


// ═════════════════════════════════════════════════════════════════
// TEST SUITE 6: buildEmbeddingText
// ═════════════════════════════════════════════════════════════════
describe('buildEmbeddingText', () => {
    test('includes file path in header', () => {
        const result = buildEmbeddingText(
            { text: 'code', startLine: 1, endLine: 1 },
            'utils.js', 'javascript', 'src/utils.js'
        );
        expect(result).toContain('src/utils.js');
    });

    test('includes language label', () => {
        const result = buildEmbeddingText(
            { text: 'code', startLine: 1, endLine: 5 },
            'app.py', 'python', 'app.py'
        );
        expect(result).toContain('(python)');
    });

    test('includes line range', () => {
        const result = buildEmbeddingText(
            { text: 'code', startLine: 10, endLine: 25 },
            'app.js', 'javascript', 'app.js'
        );
        expect(result).toContain('lines 10-25');
    });

    test('falls back to fileName when filePath is null', () => {
        const result = buildEmbeddingText(
            { text: 'code', startLine: 1, endLine: 1 },
            'index.js', 'javascript', null
        );
        expect(result).toContain('index.js');
    });

    test('chunk text appears after the header', () => {
        const result = buildEmbeddingText(
            { text: 'const x = 42;', startLine: 1, endLine: 1 },
            'test.js', 'javascript', 'test.js'
        );
        const headerEnd = result.indexOf('\n');
        const codeStart = result.indexOf('const x = 42;');
        expect(codeStart).toBeGreaterThan(headerEnd);
    });
});
