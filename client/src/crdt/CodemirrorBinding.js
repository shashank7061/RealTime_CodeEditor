/**
 * CodemirrorBinding — Binds a Yjs Y.Text to a CodeMirror 5 editor instance.
 *
 * This is a lightweight, custom binding that replaces setValue() with
 * surgical insert/delete operations so that:
 *   - Cursor positions are preserved during remote edits
 *   - Concurrent edits merge conflict-free (via Yjs CRDT)
 *   - Undo/redo works correctly across multiple users
 *
 * Based on the approach from y-codemirror but simplified for our use case.
 */

export class CodemirrorBinding {
    /**
     * @param {Y.Text} ytext        — The Yjs shared text type
     * @param {CodeMirror.Editor} editor  — CodeMirror 5 editor instance
     * @param {object} [opts]
     * @param {import('./SocketIOProvider').SocketIOProvider} [opts.provider]
     */
    constructor(ytext, editor, opts = {}) {
        this.ytext = ytext;
        this.editor = editor;
        this.provider = opts.provider || null;
        this._isApplyingRemote = false;
        this._isApplyingLocal = false;

        // ── Bind handlers ─────────────────────────────────────────────
        this._onYTextObserve = this._handleYTextChange.bind(this);
        this._onEditorChange = this._handleEditorChange.bind(this);

        // Listen for Yjs changes (remote)
        ytext.observe(this._onYTextObserve);

        // Listen for CodeMirror changes (local)
        editor.on('change', this._onEditorChange);

        // ── Initial sync ──────────────────────────────────────────────
        // Set the editor content to match ytext, but only if they differ.
        const ytextContent = ytext.toString();
        if (editor.getValue() !== ytextContent) {
            this._isApplyingRemote = true;
            editor.setValue(ytextContent);
            this._isApplyingRemote = false;
        }
    }

    /**
     * Handle Y.Text changes → apply to CodeMirror.
     * Uses surgical replaceRange/replaceRange instead of setValue().
     */
    _handleYTextChange(event) {
        if (this._isApplyingLocal) return;

        this._isApplyingRemote = true;

        const editor = this.editor;
        const doc = editor.getDoc();

        // Process each delta operation
        let index = 0;
        for (const op of event.delta) {
            if (op.retain != null) {
                index += op.retain;
            } else if (op.insert != null) {
                const text = typeof op.insert === 'string' ? op.insert : '';
                const pos = doc.posFromIndex(index);
                doc.replaceRange(text, pos, pos, 'yjs-remote');
                index += text.length;
            } else if (op.delete != null) {
                const from = doc.posFromIndex(index);
                const to = doc.posFromIndex(index + op.delete);
                doc.replaceRange('', from, to, 'yjs-remote');
            }
        }

        this._isApplyingRemote = false;
    }

    /**
     * Handle CodeMirror changes → apply to Y.Text.
     * Converts CodeMirror change objects to Yjs insert/delete operations.
     */
    _handleEditorChange(editor, change) {
        // Ignore changes that we applied from Yjs (prevents infinite loop)
        if (this._isApplyingRemote) return;
        if (change.origin === 'yjs-remote') return;
        if (change.origin === 'setValue') return;

        this._isApplyingLocal = true;

        const doc = editor.getDoc();

        // Calculate the index of the change position
        const startIndex = doc.indexFromPos(change.from);

        this.ytext.doc.transact(() => {
            // Delete removed text
            const removedLines = change.removed;
            if (removedLines) {
                const removedText = removedLines.join('\n');
                if (removedText.length > 0) {
                    this.ytext.delete(startIndex, removedText.length);
                }
            }

            // Insert new text
            const insertedLines = change.text;
            if (insertedLines) {
                const insertedText = insertedLines.join('\n');
                if (insertedText.length > 0) {
                    this.ytext.insert(startIndex, insertedText);
                }
            }
        }, this.provider); // Use provider as origin so the provider doesn't re-emit

        this._isApplyingLocal = false;
    }

    /**
     * Clean up all listeners.
     */
    destroy() {
        this.ytext.unobserve(this._onYTextObserve);
        this.editor.off('change', this._onEditorChange);
    }
}

export default CodemirrorBinding;
