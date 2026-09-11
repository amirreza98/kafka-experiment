import { useEffect, useRef, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:4001/ws";
const RECONNECT_DELAY_MS = 1500;

// Connects to the bridge (consumer/consumer.js), which relays every trade
// it reads off Kafka over a plain WebSocket. Every trade is handed straight
// to onTrade — the scene's own pool/gun pacing is what absorbs bursts, not
// this hook, so there's no queue or throttling here.
export function useTradeSocket(onTrade) {
  const [status, setStatus] = useState("connecting");
  const [received, setReceived] = useState(0);
  const socketRef = useRef(null);
  const onTradeRef = useRef(onTrade);
  onTradeRef.current = onTrade;

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
          onTradeRef.current(msg.trade);
          setReceived((n) => n + 1);
        } else if (msg.type === "history") {
          for (const trade of msg.trades) onTradeRef.current(trade);
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
  }, []);

  return { status, received };
}
