import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { coinFor } from "../lib/coins.js";
import {
  WIDTH,
  HEIGHT,
  ANGLE_MIN,
  ANGLE_MAX,
  CANNON_X,
  CANNON_Y,
  BARREL_LEN,
  POOL_Y,
  POOL_RADIUS,
  POOLS,
  LOST_TRAY_Y,
  angleToTargetX,
  poolForTargetX,
} from "../lib/layout.js";

const BALL_RADIUS = 15;
const ARC_HEIGHT = 190;
const ARC_DURATION_MS = 950;
const FALL_DURATION_MS = 420;
const SETTLE_DURATION_MS = 380;

function clampAngle(deg) {
  return Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, deg));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Owns the animation loop for the cannon, pools, flying balls and landing
// particles. Balls live in a plain mutable ref array (not React state) so a
// burst of live trades never triggers a React re-render — only the canvas
// redraws every frame.
const Scene = forwardRef(function Scene({ angle, onAngleChange, onLanded, onMissed }, ref) {
  const canvasRef = useRef(null);
  const ballsRef = useRef([]);
  const particlesRef = useRef([]);
  const angleRef = useRef(angle);
  const dragRef = useRef(false);
  const poolPulseRef = useRef({});

  useEffect(() => {
    angleRef.current = angle;
  }, [angle]);

  useImperativeHandle(ref, () => ({
    spawnTrade(trade) {
      const coin = coinFor(trade.s);
      const startAngle = angleRef.current;
      const targetX = angleToTargetX(startAngle);
      const pool = poolForTargetX(targetX);

      ballsRef.current.push({
        id: `${trade.T}-${Math.random().toString(36).slice(2, 7)}`,
        trade,
        coin,
        phase: "arc",
        phaseStart: performance.now(),
        startX: CANNON_X + Math.sin((startAngle * Math.PI) / 180) * BARREL_LEN,
        startY: CANNON_Y - Math.cos((startAngle * Math.PI) / 180) * BARREL_LEN,
        endX: targetX,
        endY: POOL_Y,
        pool,
        x: 0,
        y: 0,
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

    function spawnParticles(x, y, color, ok) {
      const n = ok ? 10 : 6;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(a) * (ok ? 90 : 60),
          vy: Math.sin(a) * (ok ? 90 : 60) - 40,
          life: 1,
          color,
        });
      }
    }

    function draw(now) {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      // background
      const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      sky.addColorStop(0, "#0b1024");
      sky.addColorStop(1, "#161c3a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // ground
      ctx.fillStyle = "#0e1330";
      ctx.fillRect(0, HEIGHT - 40, WIDTH, 40);

      // lost tray
      ctx.save();
      ctx.strokeStyle = "rgba(255,90,90,0.35)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(WIDTH / 2 - 120, LOST_TRAY_Y - 18, 240, 36);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,120,120,0.6)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("unrouted / dropped", WIDTH / 2, LOST_TRAY_Y + 34);
      ctx.restore();

      // pools
      for (const pool of POOLS) {
        const pulse = poolPulseRef.current[pool.id] || 0;
        const r = POOL_RADIUS + pulse * 8;
        ctx.save();
        ctx.beginPath();
        ctx.arc(pool.x, POOL_Y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,179,237,${0.08 + pulse * 0.12})`;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(99,179,237,${0.55 + pulse * 0.4})`;
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = "#c9d4f5";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(pool.label, pool.x, POOL_Y + POOL_RADIUS + 24);

        if (pulse > 0) poolPulseRef.current[pool.id] = Math.max(0, pulse - 0.03);
      }

      // cannon
      const a = angleRef.current;
      const rad = (a * Math.PI) / 180;
      const tipX = CANNON_X + Math.sin(rad) * BARREL_LEN;
      const tipY = CANNON_Y - Math.cos(rad) * BARREL_LEN;

      ctx.save();
      ctx.strokeStyle = "#8fa3ff";
      ctx.lineWidth = 16;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(CANNON_X, CANNON_Y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = "#3b4694";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(CANNON_X, CANNON_Y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(CANNON_X, CANNON_Y, 26, 0, Math.PI * 2);
      ctx.fillStyle = "#4a56a6";
      ctx.fill();
      ctx.strokeStyle = "#8fa3ff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // balls
      const balls = ballsRef.current;
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        const elapsed = now - b.phaseStart;

        if (b.phase === "arc") {
          const t = Math.min(1, elapsed / ARC_DURATION_MS);
          b.x = lerp(b.startX, b.endX, t);
          const yBase = lerp(b.startY, b.endY, t);
          b.y = yBase - ARC_HEIGHT * 4 * t * (1 - t);

          if (t >= 1) {
            if (b.pool) {
              onLanded?.(b.pool.id, b.trade);
              poolPulseRef.current[b.pool.id] = 1;
              spawnParticles(b.endX, b.endY, b.coin.color, true);
              b.phase = "settle";
              b.phaseStart = now;
              b.x = b.endX;
              b.y = b.endY;
            } else {
              onMissed?.(b.trade);
              b.phase = "fall";
              b.phaseStart = now;
              b.fallFromY = b.endY;
            }
          }
        } else if (b.phase === "fall") {
          const t = Math.min(1, elapsed / FALL_DURATION_MS);
          b.y = lerp(b.fallFromY, LOST_TRAY_Y, t * t);
          if (t >= 1) {
            spawnParticles(b.x, LOST_TRAY_Y, "#ff6b6b", false);
            b.phase = "settle";
            b.phaseStart = now;
          }
        } else if (b.phase === "settle") {
          const t = elapsed / SETTLE_DURATION_MS;
          if (t >= 1) {
            balls.splice(i, 1);
            continue;
          }
        }

        const scale = b.phase === "settle" ? Math.max(0, 1 - elapsed / SETTLE_DURATION_MS) : 1;
        const r = BALL_RADIUS * (b.phase === "arc" ? 1 : scale);
        if (r <= 0.5) continue;

        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fillStyle = b.coin.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.stroke();
        if (r > 8) {
          ctx.fillStyle = b.coin.text;
          ctx.font = "bold 9px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(b.coin.label, b.x, b.y + 1);
        }
        ctx.restore();
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
  }, [onLanded, onMissed]);

  function angleFromPointer(evt) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const px = (evt.clientX - rect.left) * scaleX;
    const py = (evt.clientY - rect.top) * scaleY;
    const dx = px - CANNON_X;
    const dy = CANNON_Y - py;
    const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
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

export default Scene;
