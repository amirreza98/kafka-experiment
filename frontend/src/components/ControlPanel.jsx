import { ANGLE_MIN, ANGLE_MAX, angleToFlightMs } from "../lib/layout.js";

export default function ControlPanel({ angle, onAngleChange }) {
  const flightMs = Math.round(angleToFlightMs(angle));

  return (
    <div className="panel control-panel">
      <div className="panel-title">Gun angle = processing latency</div>
      <p className="panel-hint">
        Trades fall into the queue and pile up until the gun fires the oldest one
        downstream. A flatter angle fires fast; a steeper lob takes longer per
        message. If trades arrive faster than the gun can clear them, the pile
        grows — that's Kafka absorbing the burst instead of dropping it.
      </p>

      <div className="angle-row">
        <span className="angle-value">{flightMs}ms</span>
        <input
          type="range"
          min={ANGLE_MIN}
          max={ANGLE_MAX}
          step={1}
          value={angle}
          onChange={(e) => onAngleChange(Number(e.target.value))}
        />
      </div>
      <div className="angle-labels">
        <span>fast</span>
        <span>slow</span>
      </div>
    </div>
  );
}
