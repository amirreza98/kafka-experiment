import { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import Scene from "./components/Scene.jsx";
import ControlPanel from "./components/ControlPanel.jsx";
import StatsPanel from "./components/StatsPanel.jsx";
import LogPanel from "./components/LogPanel.jsx";
import { useTradeSocket } from "./hooks/useTradeSocket.js";
import { ANGLE_MIN, ANGLE_MAX, SPEED_DEFAULT_MS, RATE_DEFAULT_MS } from "./lib/layout.js";

const FLUSH_MS = 50;

function formatLine(trade, arrow, suffix) {
  const time = new Date(trade.T).toLocaleTimeString();
  return `[${time}] ${trade.s.padEnd(8)} price: $${Number(trade.p).toFixed(2).padStart(10)}  qty: ${Number(trade.q).toFixed(4)}  ${arrow} ${suffix}`;
}

export default function App() {
  const sceneRef = useRef(null);
  const queuePanelRef = useRef(null);
  const consumerPanelRef = useRef(null);
  const [angle, setAngle] = useState((ANGLE_MIN + ANGLE_MAX) / 2);
  const [speedMs, setSpeedMs] = useState(SPEED_DEFAULT_MS);
  const [rateMs, setRateMs] = useState(RATE_DEFAULT_MS);
  const [paused, setPaused] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [missed, setMissed] = useState(0);

  const queueBufferRef = useRef([]);
  const consumerBufferRef = useRef([]);

  const handleTrade = useCallback((trade) => {
    sceneRef.current?.spawnTrade(trade);
    queueBufferRef.current.push(formatLine(trade, "->", "queued"));
  }, []);

  const { status, received } = useTradeSocket(handleTrade);

  const handleDelivered = useCallback((trade, latencyMs) => {
    setProcessed((n) => n + 1);
    consumerBufferRef.current.push(formatLine(trade, "<-", `delivered (${Math.round(latencyMs)}ms)`));
  }, []);

  const handleMissed = useCallback(() => {
    setMissed((n) => n + 1);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (queueBufferRef.current.length) {
        queuePanelRef.current?.pushLines(queueBufferRef.current);
        queueBufferRef.current = [];
      }
      if (consumerBufferRef.current.length) {
        consumerPanelRef.current?.pushLines(consumerBufferRef.current);
        consumerBufferRef.current = [];
      }
    }, FLUSH_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app">
      <Header />
      <StatsPanel status={status} received={received} processed={processed} missed={missed} />
      <div className="app-main">
        <Scene
          ref={sceneRef}
          angle={angle}
          onAngleChange={setAngle}
          speedMs={speedMs}
          rateMs={rateMs}
          paused={paused}
          onDelivered={handleDelivered}
          onMissed={handleMissed}
        />
        <aside className="side-panels">
          <ControlPanel
            angle={angle}
            onAngleChange={setAngle}
            speedMs={speedMs}
            onSpeedChange={setSpeedMs}
            rateMs={rateMs}
            onRateChange={setRateMs}
            paused={paused}
            onPauseToggle={() => setPaused((p) => !p)}
          />
        </aside>
      </div>
      <div className="logs-row">
        <LogPanel ref={queuePanelRef} title="crypto-trades queue" accent="#8fa3ff" />
        <LogPanel ref={consumerPanelRef} title="downstream consumer" accent="#ff8fd0" />
      </div>
    </div>
  );
}
