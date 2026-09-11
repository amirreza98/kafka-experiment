import { COINS } from "../lib/coins.js";

export default function StatsPanel({ status, received, processed }) {
  const lag = Math.max(0, received - processed);

  return (
    <div className="panel stats-panel">
      <div className="panel-title-row">
        <div className="panel-title">Live stats</div>
        <span className={`status-dot status-${status}`} title={status} />
      </div>

      <div className="totals-row">
        <div>
          <div className="stat-num">{received}</div>
          <div className="stat-label">trades from Kafka</div>
        </div>
        <div>
          <div className="stat-num">{processed}</div>
          <div className="stat-label">delivered</div>
        </div>
        <div>
          <div className="stat-num stat-num-warn">{lag}</div>
          <div className="stat-label">lag (waiting)</div>
        </div>
      </div>

      <div className="legend">
        {Object.entries(COINS).map(([symbol, c]) => (
          <span className="legend-chip" key={symbol} style={{ background: c.color, color: c.text }}>
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
