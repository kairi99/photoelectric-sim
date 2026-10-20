/** Deterministic 32-bit PRNG (mulberry32); returns uniform [0,1). Inject it; never use Math.random. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal sample via Box-Muller from a uniform RNG. */
export function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12)
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/**
 * Final step: expected voltage + electrometer offset + Gaussian reading jitter (V). offset_V defaults to 0
 * (Explore mode); sigma_V = 0 returns the expectation plus offset.
 */
export function withReadingNoise(U_V: number, rng: () => number, sigma_V: number, offset_V = 0): number {
  return U_V + offset_V + (sigma_V > 0 ? sigma_V * gaussian(rng) : 0)
}
