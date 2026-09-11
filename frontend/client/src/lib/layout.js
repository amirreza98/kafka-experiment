// Shared logical coordinate space for the canvas scene. Kept separate from
// Scene.jsx so ControlPanel/App can reason about angle <-> pool mapping
// without importing canvas drawing code.
export const WIDTH = 960;
export const HEIGHT = 600;

export const ANGLE_MIN = -55;
export const ANGLE_MAX = 55;

export const CANNON_X = WIDTH / 2;
export const CANNON_Y = HEIGHT - 70;
export const BARREL_LEN = 72;

export const POOL_Y = 140;
export const POOL_RADIUS = 58;

export const POOLS = [
  { id: 0, label: "Consumer A", x: WIDTH * 0.16 },
  { id: 1, label: "Consumer B", x: WIDTH * 0.5 },
  { id: 2, label: "Consumer C", x: WIDTH * 0.84 },
];

export const LOST_TRAY_Y = HEIGHT - 150;

// How far past the outer pools the target can land when the cannon is
// aimed at full lock — lets an extreme angle overshoot into a "miss".
const OVERSHOOT = 46;

// angleDeg in [ANGLE_MIN, ANGLE_MAX], 0 = straight up toward Consumer B
// (the middle pool). Linear mapping so the slider feels direct: full left
// lock lands past Consumer A, full right lock lands past Consumer C.
export function angleToTargetX(angleDeg) {
  const halfRange = POOLS[2].x - POOLS[1].x + OVERSHOOT;
  const t = angleDeg / ANGLE_MAX;
  return CANNON_X + t * halfRange;
}

// Which pool (if any) catches a ball landing at targetX.
export function poolForTargetX(targetX) {
  return POOLS.find((p) => Math.abs(p.x - targetX) <= POOL_RADIUS) || null;
}
