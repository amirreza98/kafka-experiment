import { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import Scene from "./components/Scene.jsx";
import ControlPanel from "./components/ControlPanel.jsx";
import StatsPanel from "./components/StatsPanel.jsx";
import { useTradeSocket } from "./hooks/useTradeSocket.js";
import { ANGLE_MAX } from "./lib/layout.js";

const FIRE_INTERVAL_MS = 110;
const MAX_QUEUE = 250;
const AUTO_SWEEP_PERIOD_MS = 4200;

export default function App() {
  const queueRef = useRef([]);
  const sceneRef = useRef(null);

  const [angle, setAngle] = useState(0);
  const [autoAim, setAutoAim] = useState(true);
  const [queueLen, setQueueLen] = useState(0);
  const [poolStats, setPoolStats] = useState({});
  const [missedCount, setMissedCount] = useState(0);

  const { status, received } = useTradeSocket(queueRef);

  const handleLanded = useCallback((poolId, trade) => {
    const volume = Number(trade.p) * Number(trade.q);
    setPoolStats((prev) => {
      const existing = prev[poolId] || { count: 0, volume: 0 };
      return {
        ...prev,
        [poolId]: { count: existing.count + 1, volume: existing.volume + volume },
      };
    });
  }, []);

  const handleMissed = useCallback(() => {
    setMissedCount((n) => n + 1);
  }, []);

  // Drains the trade queue into the cannon at a steady, watchable pace
  // instead of firing every message the instant it arrives.
  useEffect(() => {
    const id = setInterval(() => {
      const queue = queueRef.current;
      if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);

      const trade = queue.shift();
      if (trade) sceneRef.current?.spawnTrade(trade);

      setQueueLen(queue.length);
    }, FIRE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Auto-balance mode: sweep the angle smoothly so trades spread across all
  // three pools on their own, mimicking a round-robin load balancer.
  useEffect(() => {
    if (!autoAim) return;
    let rafId;
    const start = performance.now();
    function tick(now) {
      const t = ((now - start) % AUTO_SWEEP_PERIOD_MS) / AUTO_SWEEP_PERIOD_MS;
      setAngle(Math.sin(t * Math.PI * 2) * ANGLE_MAX);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [autoAim]);

  const handleAngleChange = useCallback((next) => {
    setAutoAim(false);
    setAngle(next);
  }, []);

  return (
    <div className="app">
      <Header />
      <div className="app-body">
        <Scene
          ref={sceneRef}
          angle={angle}
          onAngleChange={handleAngleChange}
          onLanded={handleLanded}
          onMissed={handleMissed}
        />
        <aside className="side-panels">
          <ControlPanel
            angle={angle}
            onAngleChange={handleAngleChange}
            autoAim={autoAim}
            onToggleAutoAim={setAutoAim}
            queueLen={queueLen}
          />
          <StatsPanel status={status} received={received} poolStats={poolStats} missedCount={missedCount} />
        </aside>
      </div>
    </div>
  );
}
