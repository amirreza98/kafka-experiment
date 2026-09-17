import { COINS } from "../lib/coins.js";

export default function StatsPanel({ status, received, processed, missed, queueLen, queueTrend }) {
  const lag = Math.max(0, received - processed - missed);
  const queueClass = queueTrend === "up" ? " stat-num-up" : queueTrend === "down" ? " stat-num-down" : "";

  return (
    <div className="panel stats-panel">
      <div className="panel-title-row">
        <div className="panel-title">Live stats</div>
        <span className={`status-dot status-${status}`} title={status} />
      </div>

      <div className="totals-row">
        <div>
          <div className={`stat-num${queueClass}`}>{queueLen}</div>
          <div className="stat-label">in queue</div>
        </div>
        <div>
          <div className="stat-num">{processed}</div>
          <div className="stat-label">delivered</div>
        </div>
        <div>
          <div className="stat-num stat-num-danger">{missed}</div>
          <div className="stat-label">missed</div>
        </div>
        <div>
          <div className="stat-num stat-num-warn">{lag}</div>
          <div className="stat-label">lag</div>
        </div>
      </div>

      <div className="legend">
        {Object.entries(COINS).map(([symbol, c]) => (
          <span
            className="legend-chip"
            key={symbol}
            style={{ background: c.color, color: c.text }}
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
