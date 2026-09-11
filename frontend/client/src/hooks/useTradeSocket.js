import { useEffect, useRef, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:4001/ws";
const RECONNECT_DELAY_MS = 1500;

// Connects to the frontend bridge (frontend/server), which itself is a
// Kafka consumer relaying `crypto-trades` over a plain WebSocket. Incoming
// trades are pushed into a caller-owned queue ref so the render loop can
// drain them at its own pace instead of re-rendering React per message.
export function useTradeSocket(queueRef) {
  const [status, setStatus] = useState("connecting");
  const [received, setReceived] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer = null;

    function connect() {
      if (cancelled) return;
      setStatus("connecting");
      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.onopen = () => setStatus("connected");

      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "trade") {
          queueRef.current.push(msg.trade);
          setReceived((n) => n + 1);
        } else if (msg.type === "history") {
          for (const trade of msg.trades) queueRef.current.push(trade);
          setReceived((n) => n + msg.trades.length);
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        setStatus("disconnected");
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      socket.onerror = () => socket.close();
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, [queueRef]);

  return { status, received };
}
