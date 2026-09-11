import { POOLS } from "../lib/layout.js";
import { COINS } from "../lib/coins.js";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function StatsPanel({ status, received, poolStats, missedCount }) {
  const totalLanded = POOLS.reduce((sum, p) => sum + (poolStats[p.id]?.count || 0), 0);

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
          <div className="stat-num">{totalLanded}</div>
          <div className="stat-label">landed</div>
        </div>
        <div>
          <div className="stat-num stat-num-warn">{missedCount}</div>
          <div className="stat-label">unrouted</div>
        </div>
      </div>

      <div className="pool-cards">
        {POOLS.map((p) => {
          const s = poolStats[p.id] || { count: 0, volume: 0 };
          return (
            <div className="pool-card" key={p.id}>
              <div className="pool-card-label">{p.label}</div>
              <div className="pool-card-count">{s.count}</div>
              <div className="pool-card-volume">{currency.format(s.volume)}</div>
            </div>
          );
        })}
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
