import React, { useEffect, useRef, useState, useCallback } from 'react';
import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/python/python';
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/go/go';
import 'codemirror/mode/rust/rust';
import 'codemirror/mode/php/php';
import 'codemirror/mode/ruby/ruby';
import 'codemirror/mode/shell/shell';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/selection/active-line';
import 'codemirror/addon/edit/matchbrackets';
import * as Y from 'yjs';
import { SocketIOProvider } from '../crdt/SocketIOProvider';
import { CodemirrorBinding } from '../crdt/CodemirrorBinding';
import { DEFAULT_LANGUAGE } from '../languages';
import { BookIcon, BugIcon, WandIcon, XIcon } from './Icons';

const Editor = ({ socket, roomId, activeFileId, initialCode, onCodeChange, language, onAIExplain, onAIBugfix, onAISuggest }) => {
    const editorRef = useRef(null);
    const socketRef = useRef(socket);
    const onCodeChangeRef = useRef(onCodeChange);
    const activeFileIdRef = useRef(activeFileId);
    const editorWrapperRef = useRef(null);

    // CRDT refs — one Y.Doc + provider + binding per active file
    const ydocRef = useRef(null);
    const providerRef = useRef(null);
    const bindingRef = useRef(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState(null);

    useEffect(() => {
        socketRef.current = socket;
    }, [socket]);

    useEffect(() => {
        onCodeChangeRef.current = onCodeChange;
    }, [onCodeChange]);

    useEffect(() => {
        activeFileIdRef.current = activeFileId;
    }, [activeFileId]);

    // ── Initialize CodeMirror (once) ──────────────────────────────────
    useEffect(() => {
        editorRef.current = Codemirror.fromTextArea(
            document.getElementById('realtimeEditor'),
            {
                mode: getModeFromLanguage(DEFAULT_LANGUAGE),
                theme: 'dracula',
                autoCloseTags: true,
                autoCloseBrackets: true,
                lineNumbers: true,
                styleActiveLine: true,
                matchBrackets: true,
            }
        );

        // Fire onCodeChange for local state tracking (codeRef in EditorPage)
        editorRef.current.on('change', (instance, changes) => {
            const code = instance.getValue();
            onCodeChangeRef.current(code);
        });

        return () => {
            // Clean up CRDT on unmount
            if (bindingRef.current) bindingRef.current.destroy();
            if (providerRef.current) providerRef.current.destroy();
            if (ydocRef.current) ydocRef.current.destroy();

            editorRef.current?.toTextArea();
            editorRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once

    // ── Set up CRDT binding when activeFileId or socket changes ────────
    useEffect(() => {
        if (!editorRef.current || !socket || !activeFileId) return;

        // Tear down previous CRDT binding for the old file
        if (bindingRef.current) {
            bindingRef.current.destroy();
            bindingRef.current = null;
        }
        if (providerRef.current) {
            providerRef.current.destroy();
            providerRef.current = null;
        }
        if (ydocRef.current) {
            ydocRef.current.destroy();
            ydocRef.current = null;
        }

        // Create a fresh Y.Doc for this file
        const ydoc = new Y.Doc();
        const ytext = ydoc.getText('codemirror');

        // Pre-populate with initialCode so the user sees content immediately
        // (before the server sync arrives). The Yjs merge will reconcile.
        if (initialCode) {
            ydoc.transact(() => {
                ytext.insert(0, initialCode);
            });
        }

        // Set editor content to match
        editorRef.current.setValue(initialCode || '');

        // Create the Socket.IO provider — handles sync with server
        const provider = new SocketIOProvider(socket, roomId, activeFileId, ydoc);

        // Create the CodeMirror ↔ Yjs binding — replaces raw setValue()
        const binding = new CodemirrorBinding(ytext, editorRef.current, {
            provider,
        });

        ydocRef.current = ydoc;
        providerRef.current = provider;
        bindingRef.current = binding;

        return () => {
            binding.destroy();
            provider.destroy();
            ydoc.destroy();

            if (bindingRef.current === binding) bindingRef.current = null;
            if (providerRef.current === provider) providerRef.current = null;
            if (ydocRef.current === ydoc) ydocRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFileId, socket]);

    // ── Language mode changes ──────────────────────────────────────────
    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.setOption('mode', getModeFromLanguage(language));
        }
    }, [language]);

    // ── Context menu handlers ─────────────────────────────────────────
    const handleContextMenu = useCallback((e) => {
        const cmEl = editorWrapperRef.current?.querySelector('.CodeMirror');
        if (!cmEl || !cmEl.contains(e.target)) return;

        e.preventDefault();
        const selection = editorRef.current?.getSelection() || '';
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            hasSelection: selection.length > 0,
            selection,
        });
    }, []);

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    // Close context menu on click outside or Escape
    useEffect(() => {
        if (!contextMenu) return undefined;

        const handleClick = () => closeContextMenu();
        const handleKeyDown = (e) => { if (e.key === 'Escape') closeContextMenu(); };

        document.addEventListener('click', handleClick);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('click', handleClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [contextMenu, closeContextMenu]);

    const handleAIAction = useCallback((action) => {
        const selection = editorRef.current?.getSelection() || '';
        const fullCode = editorRef.current?.getValue() || '';
        const codeToSend = selection || fullCode;

        if (action === 'explain' && onAIExplain) {
            onAIExplain(codeToSend);
        } else if (action === 'bugfix' && onAIBugfix) {
            onAIBugfix(codeToSend);
        } else if (action === 'suggest' && onAISuggest) {
            // For suggest, send code up to cursor position
            const cursor = editorRef.current?.getCursor();
            const codeUpToCursor = cursor
                ? editorRef.current?.getRange({ line: 0, ch: 0 }, cursor)
                : fullCode;
            onAISuggest(codeUpToCursor);
        }
        closeContextMenu();
    }, [onAIExplain, onAIBugfix, onAISuggest, closeContextMenu]);

    return (
        <div style={{ height: '100%', width: '100%' }} ref={editorWrapperRef} onContextMenu={handleContextMenu}>
            <textarea id="realtimeEditor" />

            {/* AI Context Menu */}
            {contextMenu && (
                <div
                    className="editorContextMenu"
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        zIndex: 1001,
                    }}
                >
                    <div className="editorContextMenu__header">
                        <span>AI actions</span>
                    </div>
                    <button onClick={() => handleAIAction('explain')}>
                        <span className="editorContextMenu__icon"><BookIcon /></span>
                        {contextMenu.hasSelection ? 'Explain selection' : 'Explain code'}
                    </button>
                    <button onClick={() => handleAIAction('bugfix')}>
                        <span className="editorContextMenu__icon"><BugIcon /></span>
                        {contextMenu.hasSelection ? 'Find bugs in selection' : 'Find bugs'}
                    </button>
                    <button onClick={() => handleAIAction('suggest')}>
                        <span className="editorContextMenu__icon"><WandIcon /></span>
                        Suggest completion
                    </button>
                    <div className="editorContextMenu__divider" />
                    <button onClick={() => { closeContextMenu(); }}>
                        <span className="editorContextMenu__icon"><XIcon /></span>
                        Cancel
                        <span className="editorContextMenu__shortcut">Esc</span>
                    </button>
                </div>
            )}
        </div>
    );
};

function getModeFromLanguage(lang) {
    switch (lang) {
        case 'bash':
            return { name: 'shell' };
        case 'c':
            return 'text/x-csrc';
        case 'cpp':
            return 'text/x-c++src';
        case 'csharp':
            return 'text/x-csharp';
        case 'go':
            return 'text/x-go';
        case 'java':
            return 'text/x-java';
        case 'php':
            return 'application/x-httpd-php';
        case 'python':
            return { name: 'python' };
        case 'ruby':
            return { name: 'ruby' };
        case 'rust':
            return { name: 'rust' };
        case 'typescript':
            return { name: 'javascript', typescript: true };
        case 'javascript':
        default:
            return { name: 'javascript' };
    }
}

export default Editor;
