/**
 * SocketIOProvider — Custom Yjs provider that syncs over Socket.IO
 *
 * Replaces y-websocket. Transports Yjs sync protocol messages over the
 * existing Socket.IO connection so we don't need a separate WebSocket server.
 *
 * Usage:
 *   const provider = new SocketIOProvider(socket, roomId, fileId, ydoc);
 *   // ...later...
 *   provider.destroy();
 */
import * as Y from 'yjs';

export class SocketIOProvider {
    /**
     * @param {import('socket.io-client').Socket} socket
     * @param {string} roomId
     * @param {string} fileId
     * @param {Y.Doc} ydoc
     */
    constructor(socket, roomId, fileId, ydoc) {
        this.socket = socket;
        this.roomId = roomId;
        this.fileId = fileId;
        this.doc = ydoc;
        this.synced = false;
        this._destroyed = false;

        // ── Bind event handlers ───────────────────────────────────────
        this._onSyncStep1 = this._handleSyncStep1.bind(this);
        this._onUpdate = this._handleRemoteUpdate.bind(this);
        this._onDocUpdate = this._handleLocalUpdate.bind(this);

        // Listen for server messages
        socket.on('yjs:sync-step1', this._onSyncStep1);
        socket.on('yjs:update', this._onUpdate);

        // Listen for local doc changes
        ydoc.on('update', this._onDocUpdate);

        // Kick off sync
        this._requestSync();
    }

    /**
     * Request the full document state from the server.
     */
    _requestSync() {
        if (this._destroyed) return;
        this.socket.emit('yjs:sync-request', {
            roomId: this.roomId,
            fileId: this.fileId,
        });
    }

    /**
     * Server sends us sync step 1 — full document state.
     * We apply it and send back our own state (step 2).
     */
    _handleSyncStep1({ fileId, update }) {
        if (this._destroyed || fileId !== this.fileId) return;

        try {
            const uint8 = new Uint8Array(update);
            Y.applyUpdate(this.doc, uint8);

            // Send our own state back so the server can merge
            const localUpdate = Y.encodeStateAsUpdate(this.doc, new Uint8Array(0));

            this.socket.emit('yjs:sync-step2', {
                fileId: this.fileId,
                update: Array.from(localUpdate),
            });

            this.synced = true;
        } catch (err) {
            console.error('[SocketIOProvider] sync-step1 error:', err);
        }
    }

    /**
     * Remote incremental update from another client (relayed by server).
     */
    _handleRemoteUpdate({ fileId, update }) {
        if (this._destroyed || fileId !== this.fileId) return;

        try {
            const uint8 = new Uint8Array(update);
            Y.applyUpdate(this.doc, uint8);
        } catch (err) {
            console.error('[SocketIOProvider] remote update error:', err);
        }
    }

    /**
     * Local doc change — send the incremental update to the server.
     * The `origin` check prevents echoing back updates we received from
     * the server (which would cause infinite loops).
     */
    _handleLocalUpdate(update, origin) {
        if (this._destroyed) return;
        // Don't re-emit updates that came from a remote source
        if (origin === this) return;

        this.socket.emit('yjs:update', {
            roomId: this.roomId,
            fileId: this.fileId,
            update: Array.from(update),
        });
    }

    /**
     * Clean up all listeners.
     */
    destroy() {
        this._destroyed = true;
        this.doc.off('update', this._onDocUpdate);
        this.socket.off('yjs:sync-step1', this._onSyncStep1);
        this.socket.off('yjs:update', this._onUpdate);
    }
}

export default SocketIOProvider;
