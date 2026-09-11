// Shared logical coordinate space for the canvas scene.
export const WIDTH = 960;
export const HEIGHT = 600;

// The pool is the Kafka queue itself: trades fall in from the top and pile
// up here, oldest at the bottom, until the gun drains them one at a time.
export const POOL = { x: 70, y: 60, width: 200, height: 260 };
export const POOL_DROP_X = POOL.x + POOL.width / 2;

// The gun is fed by a pipe from the bottom of the pool — it can only hold
// (and fire) one message at a time, same as a consumer processing serially.
export const PIPE_TOP = { x: POOL.x + POOL.width / 2, y: POOL.y + POOL.height };
export const GUN_PIVOT = { x: PIPE_TOP.x, y: PIPE_TOP.y + 92 };
export const BARREL_LEN = 76;

// Fixed downstream target — rotating the gun never changes *where* a shot
// lands, only *how long* it takes to get there.
export const AIM = { x: WIDTH - 150, y: 300 };

// Angle is measured from horizontal: 0 = flat, fastest shot; ANGLE_MAX =
// steep lob, slowest shot. This is the "latency dial" for the demo.
export const ANGLE_MIN = 0;
export const ANGLE_MAX = 68;

const FLIGHT_MS_MIN = 260;
const FLIGHT_MS_MAX = 1900;

export function angleToFlightMs(angleDeg) {
  const t = (angleDeg - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN);
  return FLIGHT_MS_MIN + t * (FLIGHT_MS_MAX - FLIGHT_MS_MIN);
}

export function angleToArcHeight(angleDeg) {
  const t = (angleDeg - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN);
  return 40 + t * 190;
}
