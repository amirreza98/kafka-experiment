import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { coinFor } from "../lib/coins.js";
import { computeLayout, ANGLE_MIN, ANGLE_MAX, angleToOffset } from "../lib/layout.js";

const BALL_R = 12;
const POOL_PADDING = 16;
const ROW_SPACING = BALL_R * 2.1;
const COL_OFFSET = BALL_R * 1.15;
const EASE = 0.16;

const LOAD_MS = 200;
const SETTLE_MS = 340;

function clampAngle(deg) {
  return Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, deg));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Slot a pool item would rest in, bottom-up, two columns wide, given its
// index counting from the oldest (bottom) item.
function stackSlot(pool, indexFromBottom) {
  const row = Math.floor(indexFromBottom / 2);
  const col = indexFromBottom % 2 === 0 ? -1 : 1;
  return {
    x: pool.x + pool.width / 2 + col * COL_OFFSET,
    y: pool.y + pool.height - POOL_PADDING - row * ROW_SPACING - BALL_R,
  };
}

// Owns the whole scene: the pool (the queue itself, coins pile up here),
// the pipe feeding the gun one coin at a time, the rotatable gun (angle is
// purely visual; speedMs is the actual latency), and the fixed downstream
// aim. Balls live in mutable refs, not React state, so a burst of live
// trades never triggers a React re-render — only the canvas redraws each
// frame. The canvas itself tracks its container's size via ResizeObserver
// so it can fill the full viewport.
const Scene = forwardRef(function Scene({ angle, onAngleChange, speedMs, rateMs, paused, onDelivered, onMissed }, ref) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const poolRef = useRef([]); // queue: index 0 = oldest = next to fire
  const activeListRef = useRef([]); // coins currently loading/flying/settling, several at once
  const lastFireRef = useRef(-Infinity);
  const fireTimesRef = useRef([]); // timestamps of recent shots, for a measured shots/sec readout
  const deliverTimesRef = useRef([]); // timestamps of recent hits, for a measured deliveries/sec readout
  const particlesRef = useRef([]);
  const angleRef = useRef(angle);
  const speedRef = useRef(speedMs); // delivery latency: how long one fired coin is in flight
  const rateRef = useRef(rateMs); // fire rate: how often the gun launches the next coin
  const pausedRef = useRef(paused);
  const sizeRef = useRef({ w: 960, h: 600 });
  const layoutRef = useRef(computeLayout(960, 600));
  const dragRef = useRef(false);
  const aimPulseRef = useRef(0);
  const missFlashRef = useRef(0);

  useEffect(() => {
    angleRef.current = angle;
  }, [angle]);
  useEffect(() => {
    speedRef.current = speedMs;
  }, [speedMs]);
  useEffect(() => {
    rateRef.current = rateMs;
  }, [rateMs]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useImperativeHandle(ref, () => ({
    spawnTrade(trade) {
      const pool = layoutRef.current.pool;
      poolRef.current.push({
        id: `${trade.T}-${Math.random().toString(36).slice(2, 7)}`,
        trade,
        coin: coinFor(trade.s),
        renderX: pool.x + pool.width / 2,
        renderY: -20,
      });
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function applySize(w, h) {
      sizeRef.current = { w, h };
      layoutRef.current = computeLayout(w, h);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) applySize(width, height);
    });
    ro.observe(container);
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) applySize(rect.width, rect.height);

    let rafId;

    function spawnParticles(x, y, color) {
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(a) * 90,
          vy: Math.sin(a) * 90 - 40,
          life: 1,
          color,
        });
      }
    }

    // Fires the next coin off the pool every rateMs, independent of how long
    // previously-fired coins are still taking to land — several can be
    // loading/flying/settling at once. Paused just stops this; spawnTrade
    // above keeps filling the pool regardless.
    function tryStartFeed(now, layout) {
      if (pausedRef.current) return;
      if (poolRef.current.length === 0) return;
      if (now - lastFireRef.current < rateRef.current) return;
      const item = poolRef.current.shift();
      lastFireRef.current = now;
      fireTimesRef.current.push(now);
      activeListRef.current.push({
        ...item,
        phase: "loading",
        phaseStart: now,
        startX: item.renderX,
        startY: item.renderY,
        endX: layout.pipeTop.x,
        endY: layout.gunPivot.y - 4,
        x: item.renderX,
        y: item.renderY,
      });
    }

    // Drops timestamps older than a second and returns how many are left —
    // a live rate/sec reading instead of a static config number.
    function ratePerSec(timestamps, now) {
      let i = 0;
      while (i < timestamps.length && now - timestamps[i] > 1000) i++;
      if (i > 0) timestamps.splice(0, i);
      return timestamps.length;
    }

    function draw(now) {
      const { w, h } = sizeRef.current;
      const layout = layoutRef.current;
      const { pool, gunPivot, barrelLen, aim, holeRadius } = layout;
      const firesPerSec = ratePerSec(fireTimesRef.current, now);
      const deliversPerSec = ratePerSec(deliverTimesRef.current, now);

      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#0b1024");
      bg.addColorStop(1, "#161c3a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#0e1330";
      ctx.fillRect(0, h - 30, w, 30);

      // pool container (the Kafka queue)
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(143,163,255,0.55)";
      ctx.fillStyle = "rgba(99,179,237,0.06)";
      roundRect(ctx, pool.x, pool.y, pool.width, pool.height, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#c9d4f5";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("crypto-trades (queue)", pool.x + pool.width / 2, pool.y - 12);
      ctx.restore();

      // pipe from pool to gun
      ctx.save();
      ctx.strokeStyle = "rgba(143,163,255,0.4)";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(layout.pipeTop.x, layout.pipeTop.y);
      ctx.lineTo(gunPivot.x, gunPivot.y);
      ctx.stroke();
      ctx.restore();

      // pool contents — how many rows actually fit inside this pool's
      // current height decides the cap, so a short/full-screen canvas never
      // stacks coins past the container's visible top edge.
      const poolItems = poolRef.current;
      const maxRows = Math.max(1, Math.floor((pool.height - POOL_PADDING * 2) / ROW_SPACING));
      const maxVisible = maxRows * 2;
      const visible = poolItems.length <= maxVisible ? poolItems.length : Math.max(0, (maxRows - 1) * 2);
      const overflow = poolItems.length - visible;
      for (let i = 0; i < visible; i++) {
        const item = poolItems[i];
        const target = stackSlot(pool, i);
        item.renderX += (target.x - item.renderX) * EASE;
        item.renderY += (target.y - item.renderY) * EASE;
        drawCoin(ctx, item.renderX, item.renderY, BALL_R, item.coin);
      }
      for (let i = visible; i < poolItems.length; i++) {
        const target = stackSlot(pool, Math.min(i, maxVisible + 4));
        const item = poolItems[i];
        item.renderX += (target.x - item.renderX) * EASE;
        item.renderY += (target.y - item.renderY) * EASE;
      }
      if (overflow > 0) {
        const top = stackSlot(pool, visible);
        ctx.save();
        ctx.beginPath();
        ctx.arc(top.x, top.y - ROW_SPACING * 0.6, BALL_R + 4, 0, Math.PI * 2);
        ctx.fillStyle = "#2a3160";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.stroke();
        ctx.fillStyle = "#e7eaff";
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.fillText(`+${overflow}`, top.x, top.y - ROW_SPACING * 0.6 + 3);
        ctx.restore();
      }

      // gun
      const a = angleRef.current;
      const rad = (a * Math.PI) / 180;
      const tipX = gunPivot.x + Math.cos(rad) * barrelLen;
      const tipY = gunPivot.y - Math.sin(rad) * barrelLen;

      const gunPaused = pausedRef.current;
      ctx.save();
      ctx.strokeStyle = gunPaused ? "#565b86" : "#8fa3ff";
      ctx.lineWidth = 16;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(gunPivot.x, gunPivot.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = gunPaused ? "#33365c" : "#3b4694";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(gunPivot.x, gunPivot.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(gunPivot.x, gunPivot.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = gunPaused ? "#383c5e" : "#4a56a6";
      ctx.fill();
      ctx.strokeStyle = gunPaused ? "#565b86" : "#8fa3ff";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = gunPaused ? "#ff8f8f" : "#9aa3d6";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(gunPaused ? "paused" : `${firesPerSec.toFixed(1)}/sec`, gunPivot.x, gunPivot.y + 44);

      // aim / downstream consumer — a piggy bank turned 90° so its coin
      // slot faces the incoming shots instead of facing straight up; only
      // a coin that lands in the slot (still exactly aim.x, aim.y — the
      // pivot of this rotation) counts as delivered.
      const pulse = aimPulseRef.current;
      const missFlash = missFlashRef.current;
      const bodyDx = 0;
      const bodyDy = holeRadius * 1.7;
      const bodyRx = holeRadius * 2.9;
      const bodyRy = holeRadius * 2.3;

      ctx.save();
      ctx.translate(aim.x, aim.y);
      ctx.rotate(-Math.PI / 2);
      if (pulse > 0) {
        ctx.beginPath();
        ctx.ellipse(bodyDx, bodyDy, bodyRx + pulse * 12, bodyRy + pulse * 12, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,143,208,${pulse * 0.6})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      // legs
      ctx.strokeStyle = "#c76fa8";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      for (const lx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(bodyDx + lx * bodyRx * 0.55, bodyDy + bodyRy * 0.8);
        ctx.lineTo(bodyDx + lx * bodyRx * 0.55, bodyDy + bodyRy * 0.8 + 14);
        ctx.stroke();
      }
      // body
      ctx.beginPath();
      ctx.ellipse(bodyDx, bodyDy, bodyRx, bodyRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = missFlash > 0 ? `rgb(${255},${143 - missFlash * 60},${208 - missFlash * 90})` : "#ff8fd0";
      ctx.fill();
      ctx.strokeStyle = "#c76fa8";
      ctx.lineWidth = 3;
      ctx.stroke();
      // snout
      ctx.beginPath();
      ctx.ellipse(bodyDx + bodyRx * 0.92, bodyDy + bodyRy * 0.15, holeRadius * 0.55, holeRadius * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#ff8fd0";
      ctx.fill();
      ctx.stroke();
      // ear
      ctx.beginPath();
      ctx.moveTo(bodyDx - bodyRx * 0.5, bodyDy - bodyRy * 0.85);
      ctx.lineTo(bodyDx - bodyRx * 0.25, bodyDy - bodyRy * 1.25);
      ctx.lineTo(bodyDx - bodyRx * 0.05, bodyDy - bodyRy * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // the coin slot itself — the actual target point, now at the local
      // origin since we translated to aim.x, aim.y before rotating
      ctx.beginPath();
      ctx.ellipse(0, 0, holeRadius, holeRadius * 0.34, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#1a0f18";
      ctx.fill();
      ctx.strokeStyle = "#7a3d5e";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // labels stay upright (drawn outside the rotated block); the body's
      // rotated center sits to the right of the slot at (aim.x + bodyDy, aim.y),
      // and its rotated half-height is bodyRx
      const pigLabelX = aim.x + bodyDy;
      const pigLabelY = aim.y + bodyRx + 26;
      ctx.fillStyle = "#c9d4f5";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("downstream consumer", pigLabelX, pigLabelY);
      ctx.fillStyle = "#9aa3d6";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(`${deliversPerSec.toFixed(1)}/sec`, pigLabelX, pigLabelY + 15);
      if (pulse > 0) aimPulseRef.current = Math.max(0, pulse - 0.04);
      if (missFlash > 0) missFlashRef.current = Math.max(0, missFlash - 0.04);

      // coins currently loading / flying / settling — several in the air at once
      tryStartFeed(now, layout);
      const activeList = activeListRef.current;
      for (let i = activeList.length - 1; i >= 0; i--) {
        const active = activeList[i];
        const elapsed = now - active.phaseStart;

        if (active.phase === "loading") {
          const t = Math.min(1, elapsed / LOAD_MS);
          active.x = lerp(active.startX, active.endX, t);
          active.y = lerp(active.startY, active.endY, t);
          if (t >= 1) {
            const angleAtLaunch = angleRef.current;
            const at = (angleAtLaunch - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN);
            const offset = angleToOffset(angleAtLaunch, layout.missRange);
            const hit = Math.abs(offset) <= layout.holeRadius;
            active.phase = "flight";
            active.phaseStart = now;
            active.flightMs = Math.max(30, speedRef.current);
            active.arcHeight = 30 + at * 220;
            active.startX = tipX;
            active.startY = tipY;
            active.hit = hit;
            active.endX = aim.x + offset;
            active.endY = aim.y + (hit ? 0 : 18);
          }
        } else if (active.phase === "flight") {
          const t = Math.min(1, elapsed / active.flightMs);
          active.x = lerp(active.startX, active.endX, t);
          const yBase = lerp(active.startY, active.endY, t);
          active.y = yBase - active.arcHeight * 4 * t * (1 - t);
          if (t >= 1) {
            if (active.hit) {
              onDelivered?.(active.trade, active.flightMs);
              deliverTimesRef.current.push(now);
              spawnParticles(active.endX, active.endY, active.coin.color);
              aimPulseRef.current = 1;
            } else {
              onMissed?.(active.trade);
              spawnParticles(active.endX, active.endY, "#ff5c5c");
              missFlashRef.current = 1;
            }
            active.phase = "settle";
            active.phaseStart = now;
            active.x = active.endX;
            active.y = active.endY;
          }
        } else if (active.phase === "settle") {
          const t = elapsed / SETTLE_MS;
          if (t >= 1) {
            activeList.splice(i, 1);
            continue;
          }
        }

        const scale = active.phase === "settle" ? Math.max(0, 1 - elapsed / SETTLE_MS) : 1;
        drawCoin(ctx, active.x, active.y, BALL_R * scale, active.coin);
      }

      // particles
      const particles = particlesRef.current;
      const dt = 1 / 60;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 220 * dt;
        p.life -= dt / 0.5;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [onDelivered, onMissed]);

  function angleFromPointer(evt) {
    const { gunPivot } = layoutRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const py = evt.clientY - rect.top;
    const dx = px - gunPivot.x;
    const dy = gunPivot.y - py;
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    return clampAngle(deg);
  }

  function handlePointerDown(evt) {
    dragRef.current = true;
    onAngleChange(angleFromPointer(evt));
    evt.target.setPointerCapture?.(evt.pointerId);
  }
  function handlePointerMove(evt) {
    if (!dragRef.current) return;
    onAngleChange(angleFromPointer(evt));
  }
  function handlePointerUp() {
    dragRef.current = false;
  }

  return (
    <div ref={containerRef} className="scene-wrap">
      <canvas
        ref={canvasRef}
        className="scene-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
});

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCoin(ctx, x, y, r, coin) {
  if (r <= 0.5) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = coin.color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.stroke();
  if (r > 7) {
    ctx.fillStyle = coin.text;
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(coin.label, x, y + 1);
  }
  ctx.restore();
}

export default Scene;
