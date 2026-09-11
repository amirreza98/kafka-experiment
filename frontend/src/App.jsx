import { useCallback, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import Scene from "./components/Scene.jsx";
import ControlPanel from "./components/ControlPanel.jsx";
import StatsPanel from "./components/StatsPanel.jsx";
import { useTradeSocket } from "./hooks/useTradeSocket.js";
import { ANGLE_MIN, ANGLE_MAX } from "./lib/layout.js";

export default function App() {
  const sceneRef = useRef(null);
  const [angle, setAngle] = useState((ANGLE_MIN + ANGLE_MAX) / 2);
  const [processed, setProcessed] = useState(0);

  const handleTrade = useCallback((trade) => {
    sceneRef.current?.spawnTrade(trade);
  }, []);

  const { status, received } = useTradeSocket(handleTrade);

  const handleLanded = useCallback(() => {
    setProcessed((n) => n + 1);
  }, []);

  return (
    <div className="app">
      <Header />
      <div className="app-body">
        <Scene ref={sceneRef} angle={angle} onAngleChange={setAngle} onLanded={handleLanded} />
        <aside className="side-panels">
          <ControlPanel angle={angle} onAngleChange={setAngle} />
          <StatsPanel status={status} received={received} processed={processed} />
        </aside>
      </div>
    </div>
  );
}
