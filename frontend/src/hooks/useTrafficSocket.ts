import { useState, useEffect } from 'react';
import { WS_URL } from '../api/client';
import { TelemetryPayload } from '../types';

export function useTrafficSocket(onLog?: (msg: string) => void) {
  const [data, setData] = useState<TelemetryPayload | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        setWsConnected(true);
        if (onLog) onLog('TELEMETRY LINK ACTIVE');
      };
      ws.onmessage = (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data) as TelemetryPayload;
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
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [onLog]);

  return { data, wsConnected };
}

