import 'dotenv/config';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import redis from '../redis/client.js';

// ── Room Maps ─────────────────────────────────────────────────────────────────
// sessionId → Set<WebSocket>  — for live session events (face recognition)
const sessionRooms = new Map();

// userId    → Set<WebSocket>  — for per-student attendance updates
const userRooms    = new Map();

function addToRoom(map, key, ws) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(ws);
}

function removeFromRoom(map, key, ws) {
  const set = map.get(key);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) map.delete(key);
}

function broadcastToRoom(map, key, message) {
  const set = map.get(key);
  if (!set?.size) return;
  set.forEach((ws) => { if (ws.readyState === 1) ws.send(message); });
}

export function setupWebSocket(httpServer) {
  
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url  = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const token = url.searchParams.get('token');
    if (!token) { socket.destroy(); return; }

    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET); }
    catch { socket.destroy(); return; }

    // ── /sessions/:sessionId  — live session room ─────────────────────────
    const sessionMatch = path.match(/^\/sessions\/([^/]+)$/);
    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws._room   = 'session';
        ws._roomId = sessionId;
        ws._userId = payload.sub || payload.id;
        wss.emit('connection', ws);
      });
      return;
    }

    // ── /attendance  — per-user attendance update room ─────────────────────
    if (path === '/attendance') {
      const userId = payload.sub || payload.id;
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws._room   = 'attendance';
        ws._roomId = userId;
        ws._userId = userId;
        wss.emit('connection', ws);
      });
      return;
    }

    socket.destroy();
  });

  wss.on('connection', (ws) => {
    const { _room, _roomId } = ws;

    if (_room === 'session') {
      addToRoom(sessionRooms, _roomId, ws);
      ws.send(JSON.stringify({ type: 'connected', payload: { sessionId: _roomId } }));
      ws.on('close', () => removeFromRoom(sessionRooms, _roomId, ws));
    } else if (_room === 'attendance') {
      addToRoom(userRooms, _roomId, ws);
      ws.send(JSON.stringify({ type: 'connected', payload: { userId: _roomId } }));
      ws.on('close', () => removeFromRoom(userRooms, _roomId, ws));
    }

    ws.on('error', (err) => console.error('WS client error:', err.message));
  });

  // ── Redis pub/sub relay ───────────────────────────────────────────────────
  const subscriber = redis.duplicate();

  subscriber.on('pmessage', (_pattern, channel, message) => {
    // session:*:events  → live session rooms
    const sessionMatch = channel.match(/^session:([^:]+):events$/);
    if (sessionMatch) {
      broadcastToRoom(sessionRooms, sessionMatch[1], message);
      return;
    }

    // attendance:*:updated  → per-user rooms
    const attMatch = channel.match(/^attendance:([^:]+):updated$/);
    if (attMatch) {
      broadcastToRoom(userRooms, attMatch[1], message);
    }
  });

  subscriber.psubscribe('session:*:events', 'attendance:*:updated');
  console.log('WebSocket gateway ready — subscribed to session:*:events + attendance:*:updated');
}
