import { useState, useEffect } from 'react';
import { WS_URL } from '../api/client';

export function useTrafficSocket(onLog) {
  const [data, setData] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        setWsConnected(true);
        if (onLog) onLog('TELEMETRY LINK ACTIVE');
      };
      ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          setData(payload);
        } catch (err) {
          console.error('[WebSocket] Parsing error:', err);
        }
      };
      ws.onclose = () => {
        setWsConnected(false);
        if (onLog) onLog('LINK INTERRUPTED — RETRYING');
        reconnectTimeout = setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, [onLog]);

  return { data, wsConnected };
}

