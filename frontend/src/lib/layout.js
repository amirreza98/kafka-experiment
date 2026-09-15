// Proportional layout so the scene can fill whatever size canvas it's
// given (the whole viewport) instead of a fixed logical resolution.
export function computeLayout(w, h) {
  const poolWidth = Math.max(150, Math.min(240, w * 0.22));
  const poolHeight = Math.max(180, h * 0.5);
  const poolX = w * 0.06;
  const poolY = h * 0.08;

  const pipeTop = { x: poolX + poolWidth / 2, y: poolY + poolHeight };
  const gunPivot = { x: pipeTop.x, y: Math.min(h - 70, pipeTop.y + h * 0.16) };
  const barrelLen = Math.max(50, Math.min(90, w * 0.075));

  const aim = { x: w - Math.max(120, Math.min(220, w * 0.16)), y: h * 0.48 };
  const holeRadius = Math.max(16, Math.min(30, w * 0.02));
  const missRange = holeRadius * 5.5; // how far a bad angle can drift the shot from the slot

  return {
    pool: { x: poolX, y: poolY, width: poolWidth, height: poolHeight },
    pipeTop,
    gunPivot,
    barrelLen,
    aim,
    holeRadius,
    missRange,
  };
}

// Angle aims the shot: near the middle of the range lines it up with the
// piggy bank's slot; drift too far off-center and it misses the hole
// entirely — wasted, counted as a miss instead of delivered.
export const ANGLE_MIN = 0;
export const ANGLE_MAX = 65;
const ANGLE_CENTER = (ANGLE_MIN + ANGLE_MAX) / 2;
const ANGLE_HALF_SPAN = (ANGLE_MAX - ANGLE_MIN) / 2;

// Where a shot fired at this angle actually ends up, horizontally, relative
// to the piggy bank's slot (aim.x). 0 = dead center on the slot.
export function angleToOffset(angleDeg, missRange) {
  const t = (angleDeg - ANGLE_CENTER) / ANGLE_HALF_SPAN; // -1..1
  return t * missRange;
}

// Speed is the actual latency dial: how long one fired coin takes to reach
// the downstream consumer, once it's been fired.
export const SPEED_MIN_MS = 5;
export const SPEED_MAX_MS = 300;
export const SPEED_DEFAULT_MS = 250;

// Rate is how often the gun fires the next coin — independent of how long
// each individual coin then takes in flight. A fast rate with slow latency
// means many coins in the air at once.
export const RATE_MIN_MS = 10;
export const RATE_MAX_MS = 100;
export const RATE_DEFAULT_MS = 50;
