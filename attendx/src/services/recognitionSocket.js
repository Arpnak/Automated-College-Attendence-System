// Real WebSocket wrapper — replaces the mock RecognitionSocket simulator.
// Implements the full Section 8.4 event vocabulary + reconnect logic (C6).

const WS_BASE = import.meta.env.VITE_WS_URL || '';

function getToken() {
  try {
    const raw = localStorage.getItem('classroll.auth');
    return raw ? JSON.parse(raw).token : null;
  } catch { return null; }
}

class RecognitionSocket extends EventTarget {
  constructor(sessionId) {
    super();
    this.sessionId = sessionId;
    this.status = 'connecting';
    this.reconnectAttempt = 0;
    this._ws = null;
    this._closed = false;
    this._connect();
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  _connect() {
    const token = getToken();
    const url = `${WS_BASE}/sessions/${this.sessionId}?token=${token}`;

    // Use wss: when page is https:
    const wsUrl = url.replace(/^http/, 'ws');

    this._ws = new WebSocket(wsUrl);

    this._ws.onopen = () => {
      const wasReconnecting = this.reconnectAttempt > 0;
      this.reconnectAttempt = 0;
      this.status = 'open';
      this._emit('status', { status: 'open', attempt: 0, wasReconnecting });
    };

    this._ws.onmessage = ({ data }) => {
      try {
        const { type, payload } = JSON.parse(data);
        this._dispatch(type, payload);
      } catch { /* ignore malformed */ }
    };

    this._ws.onclose = () => {
      if (this._closed) return;
      this.status = 'reconnecting';
      this.reconnectAttempt++;
      const backoff = Math.min(1000 * 2 ** this.reconnectAttempt, 16000);
      this._emit('status', { status: 'reconnecting', attempt: this.reconnectAttempt });
      this._reconnectTimer = setTimeout(() => this._connect(), backoff);
    };

    this._ws.onerror = () => {
      this._emit('status', { status: 'error', attempt: this.reconnectAttempt });
    };
  }

  _dispatch(type, payload) {
    switch (type) {
      case 'connected':
        this._emit('status', { status: 'open', attempt: 0, wasReconnecting: false });
        break;
      case 'FACE_MATCHED':
        this._emit('match', {
          studentId: payload.studentId,
          status: payload.status,
          confidence: payload.confidence,
          pictureIndex: payload.pictureIndex,
        });
        break;
      case 'FACE_NEEDS_REVIEW':
        this._emit('needsReview', payload);
        break;
      case 'PROCESSING_COMPLETE':
        this._emit('processingComplete', payload);
        break;
      case 'INDEXING_STATUS':
        this._emit('indexingStatus', payload);
        break;
      case 'SESSION_FINALIZED':
        this._emit('sessionFinalized', payload);
        break;
      case 'ERROR':
        this._emit('serverError', payload);
        break;
    }
  }

  // Called after reconnect — hook triggers a full roster resync (C6)
  simulateDisconnect() {
    this._ws?.close();
  }

  close() {
    this._closed = true;
    clearTimeout(this._reconnectTimer);
    this._ws?.close();
    this.status = 'closed';
  }
}

// PUBLIC API — signature unchanged so useRecognitionSocket.js keeps working
export function connectRecognitionSocket(sessionId) {
  return new RecognitionSocket(sessionId);
}
