import { useEffect, useRef, useState } from 'react';

const MAX_RETRY_DELAY_MS = 30_000;

export default function useWebSocket(onMessage) {
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    let ws = null;
    let retryDelay = 1000;
    let retryTimer = null;
    let unmounted = false;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws/monitor`);

      ws.onopen = () => {
        if (unmounted) return ws.close();
        setConnected(true);
        retryDelay = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== 'heartbeat') onMessageRef.current(data);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!unmounted) {
          retryTimer = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      unmounted = true;
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, []); // connect once; onMessage changes are handled via ref

  return { connected };
}
