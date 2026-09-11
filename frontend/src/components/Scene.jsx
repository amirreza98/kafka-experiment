import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { coinFor } from "../lib/coins.js";
import {
  WIDTH,
  HEIGHT,
  POOL,
  POOL_DROP_X,
  PIPE_TOP,
  GUN_PIVOT,
  BARREL_LEN,
  AIM,
  ANGLE_MIN,
  ANGLE_MAX,
  angleToFlightMs,
  angleToArcHeight,
} from "../lib/layout.js";

const BALL_R = 12;
const POOL_PADDING = 16;
const ROW_SPACING = BALL_R * 2.1;
const COL_OFFSET = BALL_R * 1.15;
const RENDER_CAP = 21; // how many stacked coins we draw individually before folding the rest into a badge
const EASE = 0.16;

const LOAD_MS = 230;
const SETTLE_MS = 340;

function clampAngle(deg) {
  return Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, deg));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Slot a pool item would rest in, bottom-up, two columns wide, given its
// index counting from the oldest (bottom) item.
function stackSlot(indexFromBottom) {
  const row = Math.floor(indexFromBottom / 2);
  const col = indexFromBottom % 2 === 0 ? -1 : 1;
  return {
    x: POOL_DROP_X + col * COL_OFFSET,
    y: POOL.y + POOL.height - POOL_PADDING - row * ROW_SPACING - BALL_R,
  };
}

// Owns the whole scene: the pool (the queue itself, coins pile up here),
// the pipe feeding the gun one coin at a time, the rotatable gun (angle =
// how long the flight takes, i.e. latency), and the fixed downstream aim.
// Balls live in mutable refs, not React state, so a burst of live trades
// never triggers a React re-render — only the canvas redraws each frame.
const Scene = forwardRef(function Scene({ angle, onAngleChange, onLanded }, ref) {
  const canvasRef = useRef(null);
  const poolRef = useRef([]); // queue: index 0 = oldest = next to fire
  const activeRef = useRef(null); // the one coin currently loading/flying
  const particlesRef = useRef([]);
  const angleRef = useRef(angle);
  const dragRef = useRef(false);
  const aimPulseRef = useRef(0);

  useEffect(() => {
    angleRef.current = angle;
  }, [angle]);

  useImperativeHandle(ref, () => ({
    spawnTrade(trade) {
      poolRef.current.push({
        id: `${trade.T}-${Math.random().toString(36).slice(2, 7)}`,
        trade,
        coin: coinFor(trade.s),
        renderX: POOL_DROP_X,
        renderY: -20,
      });
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

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

    function tryStartFeed(now) {
      if (activeRef.current || poolRef.current.length === 0) return;
      const item = poolRef.current.shift();
      activeRef.current = {
        ...item,
        phase: "loading",
        phaseStart: now,
        startX: item.renderX,
        startY: item.renderY,
        endX: PIPE_TOP.x,
        endY: GUN_PIVOT.y - 4,
        x: item.renderX,
        y: item.renderY,
      };
    }

    function draw(now) {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      bg.addColorStop(0, "#0b1024");
      bg.addColorStop(1, "#161c3a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#0e1330";
      ctx.fillRect(0, HEIGHT - 40, WIDTH, 40);

      // pool container (the Kafka queue)
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(143,163,255,0.55)";
      ctx.fillStyle = "rgba(99,179,237,0.06)";
      roundRect(ctx, POOL.x, POOL.y, POOL.width, POOL.height, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#c9d4f5";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("crypto-trades (queue)", POOL.x + POOL.width / 2, POOL.y - 12);
      ctx.restore();

      // pipe from pool to gun
      ctx.save();
      ctx.strokeStyle = "rgba(143,163,255,0.4)";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(PIPE_TOP.x, PIPE_TOP.y);
      ctx.lineTo(GUN_PIVOT.x, GUN_PIVOT.y);
      ctx.stroke();
      ctx.restore();

      // pool contents
      const pool = poolRef.current;
      const visible = Math.min(pool.length, RENDER_CAP - 1);
      const overflow = pool.length - visible;
      for (let i = 0; i < visible; i++) {
        const item = pool[i];
        const target = stackSlot(i);
        item.renderX += (target.x - item.renderX) * EASE;
        item.renderY += (target.y - item.renderY) * EASE;
        drawCoin(ctx, item.renderX, item.renderY, BALL_R, item.coin);
      }
      for (let i = visible; i < pool.length; i++) {
        // keep off-screen items converging too, so they animate in nicely
        // once they become visible after the front of the queue drains
        const target = stackSlot(Math.min(i, RENDER_CAP + 4));
        const item = pool[i];
        item.renderX += (target.x - item.renderX) * EASE;
        item.renderY += (target.y - item.renderY) * EASE;
      }
      if (overflow > 0) {
        const top = stackSlot(visible);
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
      const tipX = GUN_PIVOT.x + Math.cos(rad) * BARREL_LEN;
      const tipY = GUN_PIVOT.y - Math.sin(rad) * BARREL_LEN;

      ctx.save();
      ctx.strokeStyle = "#8fa3ff";
      ctx.lineWidth = 16;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(GUN_PIVOT.x, GUN_PIVOT.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = "#3b4694";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(GUN_PIVOT.x, GUN_PIVOT.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(GUN_PIVOT.x, GUN_PIVOT.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = "#4a56a6";
      ctx.fill();
      ctx.strokeStyle = "#8fa3ff";
      ctx.lineWidth = 3;
      ctx.stroke();

      const flightMs = angleToFlightMs(a);
      ctx.fillStyle = "#9aa3d6";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`~${Math.round(flightMs)}ms / message`, GUN_PIVOT.x, GUN_PIVOT.y + 44);

      // aim / downstream target
      const pulse = aimPulseRef.current;
      ctx.save();
      ctx.beginPath();
      ctx.arc(AIM.x, AIM.y, 30 + pulse * 14, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,143,208,${0.5 + pulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(AIM.x, AIM.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = "#ff8fd0";
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#c9d4f5";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText("downstream consumer", AIM.x, AIM.y + 56);
      if (pulse > 0) aimPulseRef.current = Math.max(0, pulse - 0.04);

      // the one coin currently loading / flying
      tryStartFeed(now);
      const active = activeRef.current;
      if (active) {
        const elapsed = now - active.phaseStart;

        if (active.phase === "loading") {
          const t = Math.min(1, elapsed / LOAD_MS);
          active.x = lerp(active.startX, active.endX, t);
          active.y = lerp(active.startY, active.endY, t);
          if (t >= 1) {
            const flightAngle = angleRef.current;
            active.phase = "flight";
            active.phaseStart = now;
            active.flightMs = angleToFlightMs(flightAngle);
            active.arcHeight = angleToArcHeight(flightAngle);
            active.startX = tipX;
            active.startY = tipY;
            active.endX = AIM.x;
            active.endY = AIM.y;
          }
        } else if (active.phase === "flight") {
          const t = Math.min(1, elapsed / active.flightMs);
          active.x = lerp(active.startX, active.endX, t);
          const yBase = lerp(active.startY, active.endY, t);
          active.y = yBase - active.arcHeight * 4 * t * (1 - t);
          if (t >= 1) {
            onLanded?.(active.trade);
            spawnParticles(AIM.x, AIM.y, active.coin.color);
            aimPulseRef.current = 1;
            active.phase = "settle";
            active.phaseStart = now;
            active.x = AIM.x;
            active.y = AIM.y;
          }
        } else if (active.phase === "settle") {
          const t = elapsed / SETTLE_MS;
          if (t >= 1) {
            activeRef.current = null;
          }
        }

        if (activeRef.current) {
          const scale = active.phase === "settle" ? Math.max(0, 1 - elapsed / SETTLE_MS) : 1;
          drawCoin(ctx, active.x, active.y, BALL_R * scale, active.coin);
        }
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
    return () => cancelAnimationFrame(rafId);
  }, [onLanded]);

  function angleFromPointer(evt) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const px = (evt.clientX - rect.left) * scaleX;
    const py = (evt.clientY - rect.top) * scaleY;
    const dx = px - GUN_PIVOT.x;
    const dy = GUN_PIVOT.y - py;
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
    <canvas
      ref={canvasRef}
      className="scene-canvas"
      style={{ width: "100%", height: "auto", aspectRatio: `${WIDTH} / ${HEIGHT}` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
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
