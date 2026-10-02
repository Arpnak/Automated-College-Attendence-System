/**
 * useAttendanceSocket — per-user WebSocket connection on /attendance
 *
 * Connects to the backend WS endpoint that relays attendance:*:updated events.
 * When a professor marks attendance, the student's browser receives an
 * ATTENDANCE_UPDATED message without polling.
 *
 * Usage:
 *   useAttendanceSocket((event) => {
 *     // event: { type: 'ATTENDANCE_UPDATED', payload: { courseId, date, status } }
 *     refetchCourse(event.payload.courseId);
 *   });
 */

import { useEffect, useRef } from 'react';

const WS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001')
  .replace(/^https/, 'wss')
  .replace(/^http/, 'ws')
  .replace('/api', ''); // strip /api prefix — WS is on root

const MAX_RETRIES = 5;
const BACKOFF_MS  = [1000, 2000, 4000, 8000, 15000];

function getToken() {
  try {
    const raw = localStorage.getItem('classroll.auth');
    return raw ? JSON.parse(raw).token : null;
  } catch { return null; }
}

export function useAttendanceSocket(onMessage) {
  const wsRef    = useRef(null);
  const cbRef    = useRef(onMessage);
  const retryRef = useRef(0);
  const timerRef = useRef(null);

  // Always use the latest callback without re-connecting
  useEffect(() => { cbRef.current = onMessage; }, [onMessage]);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      const token = getToken();
      if (!token) return; // not authenticated

      const url = `${WS_BASE}/attendance?token=${encodeURIComponent(token)}`;
      const ws  = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0; // reset on successful connect
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'ATTENDANCE_UPDATED') {
            cbRef.current?.(msg);
          }
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        if (unmounted) return;
        const attempt = retryRef.current;
        if (attempt < MAX_RETRIES) {
          const delay = BACKOFF_MS[attempt] ?? 15000;
          retryRef.current++;
          timerRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => { ws.close(); };
    }

    connect();

    return () => {
      unmounted = true;
      clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, []); // intentionally empty — connects once on mount
}
