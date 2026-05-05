/**
 * yjsHandler.js — Server-side Yjs document management
 *
 * Manages one Y.Doc per file (keyed by fileId). Handles the Yjs sync
 * protocol over Socket.IO instead of requiring a separate y-websocket server.
 *
 * Flow:
 *   1. Client joins a file → server sends full doc state (sync step 1)
 *   2. Client sends its local state back (sync step 2) → server merges
 *   3. Any incremental update from a client is applied to the server doc
 *      and broadcast to all other clients in the room
 *   4. A debounced callback persists the Y.Text content to the DB
 */

const Y = require('yjs');
const { encodeStateAsUpdate, applyUpdate, encodeStateVector } = Y;

// ─── In-memory doc store ────────────────────────────────────────────────────
// Key: fileId, Value: { doc: Y.Doc, awareness: Map, persistTimer: timeout }
const docs = new Map();

// Debounce interval for DB persistence (ms)
const PERSIST_DEBOUNCE_MS = 2000;

/**
 * Get or create a Y.Doc for a given fileId.
 * If `initialContent` is provided and the doc is brand-new, the Y.Text
 * is pre-populated so the first client sees existing code.
 */
function getOrCreateDoc(fileId, initialContent) {
    if (docs.has(fileId)) {
        return docs.get(fileId);
    }

    const doc = new Y.Doc();
    const ytext = doc.getText('codemirror');

    // Pre-populate with existing file content (from DB) if this is
    // the first time we create the doc in memory.
    if (initialContent && ytext.length === 0) {
        doc.transact(() => {
            ytext.insert(0, initialContent);
        });
    }

    const entry = { doc, persistTimer: null };
    docs.set(fileId, entry);
    return entry;
}

/**
 * Remove a doc from the in-memory store (e.g. when a file is deleted).
 */
function destroyDoc(fileId) {
    const entry = docs.get(fileId);
    if (entry) {
        if (entry.persistTimer) clearTimeout(entry.persistTimer);
        entry.doc.destroy();
        docs.delete(fileId);
    }
}

/**
 * Schedule a debounced DB write for the given fileId.
 * `persistFn(fileId, plaintext)` is called after the debounce window.
 */
function schedulePersist(fileId, persistFn) {
    const entry = docs.get(fileId);
    if (!entry) return;

    if (entry.persistTimer) clearTimeout(entry.persistTimer);

    entry.persistTimer = setTimeout(() => {
        const ytext = entry.doc.getText('codemirror');
        const plaintext = ytext.toString();
        persistFn(fileId, plaintext);
    }, PERSIST_DEBOUNCE_MS);
}

/**
 * Register Yjs-related Socket.IO event handlers.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {Function} persistFn  — async (fileId, code) => void
 * @param {Function} getFileFn  — async (fileId) => { code: string } | null
 */
function registerYjsSocketHandlers(io, socket, { persistFn, getFileFn }) {

    // ── Client requests sync for a specific file ──────────────────────
    socket.on('yjs:sync-request', async ({ roomId, fileId }) => {
        if (!fileId) return;

        try {
            // Look up existing content so the Y.Doc starts with current code
            let initialContent = '';
            if (!docs.has(fileId) && getFileFn) {
                const file = await getFileFn(fileId);
                initialContent = file?.code || '';
            }

            const { doc } = getOrCreateDoc(fileId, initialContent);

            // Send the full document state to this one socket
            const sv = encodeStateVector(doc);
            const update = encodeStateAsUpdate(doc, new Uint8Array(0));

            socket.emit('yjs:sync-step1', {
                fileId,
                stateVector: Array.from(sv),
                update: Array.from(update),
            });
        } catch (err) {
            console.error('[yjs] sync-request error:', err.message);
        }
    });

    // ── Client responds with its own state (step 2) ───────────────────
    socket.on('yjs:sync-step2', ({ fileId, update }) => {
        if (!fileId || !update) return;

        const entry = docs.get(fileId);
        if (!entry) return;

        try {
            const uint8 = new Uint8Array(update);
            applyUpdate(entry.doc, uint8);
        } catch (err) {
            console.error('[yjs] sync-step2 error:', err.message);
        }
    });

    // ── Incremental update from a client ──────────────────────────────
    socket.on('yjs:update', ({ roomId, fileId, update }) => {
        if (!fileId || !update || !roomId) return;

        const entry = docs.get(fileId);
        if (!entry) return;

        try {
            const uint8 = new Uint8Array(update);
            applyUpdate(entry.doc, uint8);

            // Broadcast to everyone else in the room
            socket.to(roomId).emit('yjs:update', {
                fileId,
                update: Array.from(uint8),
            });

            // Schedule DB persistence
            if (persistFn) {
                schedulePersist(fileId, persistFn);
            }
        } catch (err) {
            console.error('[yjs] update error:', err.message);
        }
    });

    // ── Awareness updates (cursor positions, selections, usernames) ───
    socket.on('yjs:awareness-update', ({ roomId, fileId, awarenessUpdate }) => {
        if (!roomId || !fileId || !awarenessUpdate) return;

        // Relay to everyone else in the room
        socket.to(roomId).emit('yjs:awareness-update', {
            fileId,
            awarenessUpdate,
            clientId: socket.id,
        });
    });

    // ── Awareness query (new client wants current awareness state) ─────
    socket.on('yjs:awareness-query', ({ roomId, fileId }) => {
        if (!roomId || !fileId) return;

        // Ask other clients to re-broadcast their awareness
        socket.to(roomId).emit('yjs:awareness-query', {
            fileId,
            requestingSocketId: socket.id,
        });
    });
}

module.exports = {
    getOrCreateDoc,
    destroyDoc,
    registerYjsSocketHandlers,
};
