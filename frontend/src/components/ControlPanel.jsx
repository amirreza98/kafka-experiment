import {
  ANGLE_MIN,
  ANGLE_MAX,
  SPEED_MIN_MS,
  SPEED_MAX_MS,
  RATE_MIN_MS,
  RATE_MAX_MS,
} from "../lib/layout.js";

export default function ControlPanel({
  angle,
  onAngleChange,
  speedMs,
  onSpeedChange,
  rateMs,
  onRateChange,
  paused,
  onPauseToggle,
}) {
  return (
    <div className="panel control-panel">
      <div className="panel-title">Controls</div>

      <div className="control-block">
        <button
          type="button"
          className={`pause-btn${paused ? " pause-btn-active" : ""}`}
          onClick={onPauseToggle}
        >
          {paused ? "Resume gun" : "Pause gun"}
        </button>
        <p className="panel-hint">Stops the gun while the queue keeps filling.</p>
      </div>

      <div className="control-block">
        <div className="control-label">
          <span>Fire rate (shooting speed)</span>
          <span className="control-value">{rateMs}ms/shot</span>
        </div>
        <input
          type="range"
          min={RATE_MIN_MS}
          max={RATE_MAX_MS}
          step={5}
          value={rateMs}
          onChange={(e) => onRateChange(Number(e.target.value))}
        />
        <div className="angle-labels">
          <span>fast ({RATE_MIN_MS}ms)</span>
          <span>slow ({RATE_MAX_MS}ms)</span>
        </div>
        <p className="panel-hint">How often the gun fires the next coin.</p>
      </div>

      <div className="control-block">
        <div className="control-label">
          <span>Speed (delivery latency)</span>
          <span className="control-value">{speedMs}ms</span>
        </div>
        <input
          type="range"
          min={SPEED_MIN_MS}
          max={SPEED_MAX_MS}
          step={5}
          value={speedMs}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
        />
        <div className="angle-labels">
          <span>fast ({SPEED_MIN_MS}ms)</span>
          <span>slow ({SPEED_MAX_MS}ms)</span>
        </div>
        <p className="panel-hint">How long a fired coin takes to land.</p>
      </div>

      <div className="control-block">
        <div className="control-label">
          <span>Angle (aim)</span>
          <span className="control-value">{angle.toFixed(0)}°</span>
        </div>
        <input
          type="range"
          min={ANGLE_MIN}
          max={ANGLE_MAX}
          step={1}
          value={angle}
          onChange={(e) => onAngleChange(Number(e.target.value))}
        />
        <p className="panel-hint">Aims the shot at the piggy bank's slot.</p>
      </div>
    </div>
  );
}
