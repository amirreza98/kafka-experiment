import { ANGLE_MIN, ANGLE_MAX } from "../lib/layout.js";

export default function ControlPanel({ angle, onAngleChange, autoAim, onToggleAutoAim, queueLen }) {
  return (
    <div className="panel control-panel">
      <div className="panel-title">Aim the cannon</div>
      <p className="panel-hint">
        Every trade Kafka delivers gets fired as a coin. The angle decides which
        consumer's pool catches it — drag the cannon, use the slider, or let it
        auto-balance.
      </p>

      <div className="angle-row">
        <span className="angle-value">{angle.toFixed(0)}°</span>
        <input
          type="range"
          min={ANGLE_MIN}
          max={ANGLE_MAX}
          step={1}
          value={angle}
          disabled={autoAim}
          onChange={(e) => onAngleChange(Number(e.target.value))}
        />
      </div>

      <label className="auto-toggle">
        <input type="checkbox" checked={autoAim} onChange={(e) => onToggleAutoAim(e.target.checked)} />
        Auto-balance (round-robin sweep)
      </label>

      <div className="queue-indicator">
        <span>in-flight queue</span>
        <div className="queue-bar">
          <div className="queue-bar-fill" style={{ width: `${Math.min(100, queueLen)}%` }} />
        </div>
        <span>{queueLen}</span>
      </div>
    </div>
  );
}
