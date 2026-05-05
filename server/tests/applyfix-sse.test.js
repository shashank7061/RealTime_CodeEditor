/**
 * Jest test suite for the Apply Fix system and SSE parser.
 *
 * mergeFix  — Splices AI-proposed code fixes into files without destroying content.
 * findFixTarget — Resolves which file a fix targets (path matching, basename fallback).
 * createSSEParser — Reassembles streamed AI responses across network chunk boundaries.
 */

const fs = require('fs');
const path = require('path');

// ─── Load ES module sources as CJS (same trick the smoke tests use) ───
function loadClientUtil(filename) {
    const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'client', 'src', 'utils', filename),
        'utf8'
    );
    return source.replace(/^export\s+/gm, '');
}

const { mergeFix, findFixTarget } = new Function(
    `${loadClientUtil('applyFix.js')}; return { mergeFix, findFixTarget };`
)();

const { createSSEParser } = new Function(
    `${loadClientUtil('sse.js')}; return { createSSEParser };`
)();


// ═════════════════════════════════════════════════════════════════
// TEST SUITE 1: mergeFix
// ═════════════════════════════════════════════════════════════════
describe('mergeFix', () => {
    const FILE = [
        'function sum(arr) {',
        '  let total = 0;',
        '  for (let i = 0; i <= arr.length; i++) {',
        '    total += arr[i];',
        '  }',
        '  return total;',
        '}',
        '',
        'function divide(a, b) {',
        '  return a / b;',
        '}',
    ].join('\n');

    test('one-line fix splices in without destroying the rest of the file', () => {
        const fix = {
            oldCode: '  for (let i = 0; i <= arr.length; i++) {',
            newCode: '  for (let i = 0; i < arr.length; i++) {',
        };
        const result = mergeFix(FILE, fix);
        expect(result.ok).toBe(true);
        expect(result.code).toContain('i < arr.length');
        expect(result.code).toContain('function divide');
        expect(result.code.split('\n').length).toBe(FILE.split('\n').length);
    });

    test('whole-file rewrite applies correctly', () => {
        const fix = {
            oldCode: FILE,
            newCode: FILE.replace('i <= arr.length', 'i < arr.length'),
        };
        const result = mergeFix(FILE, fix);
        expect(result.ok).toBe(true);
        expect(result.code).toContain('i < arr.length');
    });

    test('stale anchor is REFUSED, not applied blindly', () => {
        const fix = {
            oldCode: 'for (let i = 0; i <= items.length; i++) {',
            newCode: 'for (let i = 0; i < items.length; i++) {',
        };
        const result = mergeFix(FILE, fix);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('anchor-not-found');
    });

    test('re-applying an already-applied fix is a no-op', () => {
        const fix = {
            oldCode: '  for (let i = 0; i <= arr.length; i++) {',
            newCode: '  for (let i = 0; i < arr.length; i++) {',
        };
        const firstPass = mergeFix(FILE, fix);
        const secondPass = mergeFix(firstPass.code, fix);
        expect(secondPass.ok).toBe(false);
    });

    test('only the first occurrence is replaced', () => {
        const repeated = 'const a = 1;\nconst a = 1;\n';
        const result = mergeFix(repeated, { oldCode: 'const a = 1;', newCode: 'const a = 2;' });
        expect(result.code).toBe('const a = 2;\nconst a = 1;\n');
    });

    test('null/empty fix is rejected', () => {
        expect(mergeFix(FILE, null).ok).toBe(false);
        expect(mergeFix(FILE, { newCode: null }).ok).toBe(false);
    });

    test('no anchor + newCode replaces entire file', () => {
        const result = mergeFix(FILE, { newCode: 'completely new code' });
        expect(result.ok).toBe(true);
        expect(result.code).toBe('completely new code');
    });
});


// ═════════════════════════════════════════════════════════════════
// TEST SUITE 2: findFixTarget
// ═════════════════════════════════════════════════════════════════
describe('findFixTarget', () => {
    const FILES = [
        { _id: '1', name: 'index.js', type: 'file' },
        { _id: '2', name: 'paymentService.js', type: 'file' },
        { _id: '3', name: 'services', type: 'folder' },
    ];

    test('matches by exact name', () => {
        expect(findFixTarget(FILES, 'paymentService.js', null)._id).toBe('2');
    });

    test('matches by path basename', () => {
        expect(findFixTarget(FILES, 'services/paymentService.js', null)._id).toBe('2');
    });

    test('returns null for unknown file', () => {
        expect(findFixTarget(FILES, 'nope.js', null)).toBeNull();
    });

    test('falls back to activeFile when fileName is empty', () => {
        const active = { _id: '1' };
        expect(findFixTarget(FILES, '', active)._id).toBe('1');
    });

    test('never matches a folder', () => {
        expect(findFixTarget(FILES, 'services', null)).toBeNull();
    });
});


// ═════════════════════════════════════════════════════════════════
// TEST SUITE 3: createSSEParser
// ═════════════════════════════════════════════════════════════════
describe('createSSEParser', () => {
    const TOKENS = ['Hello ', 'world ', 'from AI'];
    const STREAM = TOKENS.map(t =>
        `data: ${JSON.stringify({ type: 'token', content: t })}\n\n`
    ).join('') + `data: ${JSON.stringify({ type: 'done', model: 'gemini-3.6-flash' })}\n\n`;

    function run(chunks) {
        let text = '';
        let done = null;
        const parser = createSSEParser((e) => {
            if (e.type === 'token') text += e.content;
            if (e.type === 'done') done = e;
        });
        chunks.forEach(c => parser.push(c));
        parser.flush();
        return { text, done };
    }

    test('single chunk → full text + done event', () => {
        const r = run([STREAM]);
        expect(r.text).toBe('Hello world from AI');
        expect(r.done.model).toBe('gemini-3.6-flash');
    });

    test('every 2-way split point reassembles identically', () => {
        let failures = 0;
        for (let i = 1; i < STREAM.length; i++) {
            const r = run([STREAM.slice(0, i), STREAM.slice(i)]);
            if (r.text !== 'Hello world from AI') failures++;
        }
        expect(failures).toBe(0);
    });

    test('byte-at-a-time delivery (worst case)', () => {
        const r = run(STREAM.split(''));
        expect(r.text).toBe('Hello world from AI');
        expect(r.done).toBeTruthy();
    });

    test('malformed JSON event is skipped, not fatal', () => {
        const r = run([
            'data: {"type":"token","content":"A"}\n\n',
            'data: {broken json\n\n',
            'data: {"type":"token","content":"B"}\n\n',
        ]);
        expect(r.text).toBe('AB');
    });

    test('error event is delivered', () => {
        let err = null;
        const p = createSSEParser(e => { if (e.type === 'error') err = e.error; });
        p.push('data: {"type":"error","error":"quota exceeded"}\n\n');
        p.flush();
        expect(err).toBe('quota exceeded');
    });

    test('error event split across chunks still works', () => {
        let err = null;
        const p = createSSEParser(e => { if (e.type === 'error') err = e.error; });
        p.push('data: {"type":"error","err');
        p.push('or":"split error"}\n\n');
        p.flush();
        expect(err).toBe('split error');
    });

    test('[DONE] sentinel is ignored', () => {
        let events = [];
        const p = createSSEParser(e => events.push(e));
        p.push('data: [DONE]\n\n');
        p.flush();
        expect(events).toHaveLength(0);
    });

    test('trailing event without newline is flushed', () => {
        const r = run(['data: {"type":"token","content":"tail"}']);
        expect(r.text).toBe('tail');
    });
});
