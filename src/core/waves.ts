/**
 * Gerstner wave set shared by the water shader and gameplay (bobbers, boats).
 * Each wave: direction (x, z), steepness, wavelength (m).
 */
export interface Wave { dx: number; dz: number; steepness: number; wavelength: number }

export const CALM_WAVES: Wave[] = [
  { dx: 1.0, dz: 0.3, steepness: 0.13, wavelength: 41 },
  { dx: 0.7, dz: 0.9, steepness: 0.11, wavelength: 23 },
  { dx: -0.4, dz: 1.0, steepness: 0.09, wavelength: 13.5 },
  { dx: 0.9, dz: -0.5, steepness: 0.07, wavelength: 7.3 },
  { dx: 0.2, dz: 0.8, steepness: 0.06, wavelength: 4.1 },
  { dx: -0.8, dz: 0.35, steepness: 0.05, wavelength: 2.7 },
];

const G = 9.8;

/** Precomputed per-wave constants. */
export function waveConsts(w: Wave) {
  const len = Math.hypot(w.dx, w.dz);
  const k = (2 * Math.PI) / w.wavelength;
  return { dx: w.dx / len, dz: w.dz / len, k, c: Math.sqrt(G / k), a: w.steepness / k };
}

/**
 * Surface height at (x, z), time t, with amplitude scale `scale` (sea state).
 * Ignores the small horizontal Gerstner displacement — accurate enough for floating objects.
 */
export function waveHeight(waves: Wave[], x: number, z: number, t: number, scale = 1): number {
  let y = 0;
  for (const w of waves) {
    const { dx, dz, k, c, a } = waveConsts(w);
    y += a * scale * Math.sin(k * (dx * x + dz * z - c * t));
  }
  return y;
}

/** Packs waves for the shader as vec4(dirX, dirZ, steepness, wavelength). */
export function packWaves(waves: Wave[]): number[][] {
  return waves.map((w) => { const l = Math.hypot(w.dx, w.dz); return [w.dx / l, w.dz / l, w.steepness, w.wavelength]; });
}
