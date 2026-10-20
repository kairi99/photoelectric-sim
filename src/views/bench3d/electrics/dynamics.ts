// Small pure motion helpers: a lightly underdamped moving-coil needle, and an exponential ease for knobs and caps.
export interface Spring { x: number; v: number }

/** Natural frequency (rad/s) and damping ratio: 2 % settling time = 4 / (zeta w0) = 0.4 s with a small overshoot (~5 %). */
export const NEEDLE_W0 = 14.3
export const NEEDLE_ZETA = 0.7
const SUB_S = 1 / 240

/** Advance the needle spring (x in 0..1 of full scale) towards `target`. The stops at 0 and 1 are hard. Returns true while moving. */
export function stepNeedle(s: Spring, target: number, dt_s: number, w0 = NEEDLE_W0, zeta = NEEDLE_ZETA): boolean {
  let left = Math.max(0, dt_s)
  while (left > 0) {
    const h = Math.min(SUB_S, left)
    left -= h
    const a = w0 * w0 * (target - s.x) - 2 * zeta * w0 * s.v
    s.v += a * h
    s.x += s.v * h
    if (s.x < 0) { s.x = 0; if (s.v < 0) s.v = 0 }
    if (s.x > 1) { s.x = 1; if (s.v > 0) s.v = 0 }
  }
  if (Math.abs(target - s.x) < 2e-4 && Math.abs(s.v) < 2e-3) { s.x = target; s.v = 0; return false }
  return true
}

/** Exponential ease of `x` towards `target` with time constant tau_s. Returns the new value (snaps when very close). */
export function easeTo(x: number, target: number, dt_s: number, tau_s: number, eps = 1e-3): number {
  const nx = x + (target - x) * (1 - Math.exp(-Math.max(0, dt_s) / tau_s))
  return Math.abs(target - nx) < eps ? target : nx
}
