/**
 * Boat handling: a small arcade model, pure and deterministic, shared by the game, the bots and the tests.
 *
 * The boat is a point with a heading, a forward speed and a turn rate. Throttle eases the speed toward a
 * target (so the boat has weight and glides when you let go); the rudder turns it, weakly at rest and fully
 * with way on, so you can always pivot off a shore. The direction of travel lags the heading a little in a
 * turn, which reads as the hull sliding.
 *
 * The hull never enters water shallower than its draft and never crosses anything solid (the dock, rocks):
 * a move that would is replaced by a slide along the shore, and failing that the boat stops with a bump.
 * Near the edge of a region the sea "murmurs": a current pushes the boat back toward the middle, stronger
 * than the boat can sail at the edge itself.
 */

export interface BoatSpec {
  /** Top speed, m/s. */ speed: number;
  /** Full-rudder turn rate with way on, rad/s. */ turn: number;
  /** How quickly speed answers the throttle, 1/s. */ accel: number;
  /** Depth of water the hull needs, m. */ draft: number;
  /** Hull length and beam used for grounding, m. */ length: number; beam: number;
}

export interface BoatState {
  x: number; z: number;
  /** Where the bow points: forward is (sin heading, cos heading). */ heading: number;
  /** Forward speed, m/s (negative going astern). */ speed: number;
  /** Turn rate, rad/s (positive turns to port, the same way as the player's yaw). */ yawRate: number;
  /** Direction of travel; it lags the heading in a turn. */ course: number;
}

export interface BoatInput { /** −1 (astern) .. 1 (ahead) */ throttle: number; /** −1 (turn to starboard) .. 1 (turn to port) */ rudder: number }

export interface BoatEnv {
  /** Water depth at (x, z) in metres; 0 on land. */
  depth(x: number, z: number): number;
  /** Solid things standing in the water that a hull cannot pass (dock, rocks). */
  solid?(x: number, z: number): boolean;
  centre: readonly [number, number];
  radius: number;
  /** Width of the band inside the radius where the murmur pushes back (default 110 m). */
  edge?: number;
}

export interface BoatStep {
  /** 0..1: how hard the hull struck something this step (0 = nothing). */ bump: number;
  /** The hull is pressed against shallows or something solid. */ aground: boolean;
  /** 0..1: strength of the murmur current at the region's edge. */ murmur: number;
}

export const BOAT = {
  /** Fraction of top speed available astern. */ reverse: 0.35,
  /** How much faster the boat slows when the throttle opposes its motion. */ brake: 2.3,
  /** Coasting drag with the throttle released, 1/s. */ coast: 0.34,
  /** Rudder authority at rest, as a fraction of full (so the boat can always pivot). */ pivot: 0.3,
  /** Share of top speed at which the rudder has full authority. */ steerageAt: 0.45,
  /** How quickly the turn rate answers the rudder, 1/s. */ helm: 4,
  /** How quickly the direction of travel follows the heading, 1/s (lower = more slide). */ grip: 3.2,
  /** Speed lost per second in a full-rate turn, as a fraction. */ turnDrag: 0.16,
  /** Speed lost per second while sliding along a shore, as a fraction. */ scrape: 0.8,
  /** Murmur push at the very edge, as a multiple of the boat's top speed. */ murmurPush: 1.3,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export function newBoat(x: number, z: number, heading: number): BoatState {
  return { x, z, heading, speed: 0, yawRate: 0, course: heading };
}

/** Hull sample points in boat space as [to port, forward] pairs: bow, stern, shoulders, quarters, middle. */
export function hullPoints(spec: BoatSpec): readonly (readonly [number, number])[] {
  // Asked for several times a step: worked out once for each hull size.
  const key = spec.length * 4096 + spec.beam;
  let pts = HULLS.get(key);
  if (!pts) {
    const l = spec.length / 2, b = spec.beam / 2;
    pts = [[0, l], [0, -l], [b, l * 0.45], [-b, l * 0.45], [b, -l * 0.5], [-b, -l * 0.5], [0, 0]];
    HULLS.set(key, pts);
  }
  return pts;
}
const HULLS = new Map<number, readonly (readonly [number, number])[]>();

/**
 * How much water the hull has to spare at a pose: the least (depth − draft) over the hull points, or −1
 * where a point is inside something solid. Zero or more means the boat floats free there.
 */
export function clearance(env: BoatEnv, spec: BoatSpec, x: number, z: number, heading: number): number {
  const s = Math.sin(heading), c = Math.cos(heading);
  let least = Infinity;
  const pts = hullPoints(spec);
  for (let i = 0; i < pts.length; i++) {
    const side = pts[i][0], fwd = pts[i][1];
    // Forward is (sin, cos); port is (cos, −sin).
    const px = x + s * fwd + c * side, pz = z + c * fwd - s * side;
    const here = env.solid?.(px, pz) ? -1 : env.depth(px, pz) - spec.draft;
    if (here < least) least = here;
  }
  return least;
}

/** Strength of the murmur at (x, z): 0 inside, rising to 1 at the region's edge. */
export function murmurAt(env: BoatEnv, x: number, z: number): number {
  const edge = env.edge ?? 110;
  const r = Math.hypot(x - env.centre[0], z - env.centre[1]);
  const t = clamp((r - (env.radius - edge)) / edge, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Advances the boat by dt seconds. Mutates and returns nothing but the step report. */
export function stepBoat(b: BoatState, inp: BoatInput, spec: BoatSpec, env: BoatEnv, dt: number): BoatStep {
  const thr = clamp(inp.throttle, -1, 1), rud = clamp(inp.rudder, -1, 1);

  // Speed: eased toward the throttle's target; it brakes harder than it gathers way, and glides when let go.
  if (thr !== 0) {
    const target = thr > 0 ? thr * spec.speed : thr * spec.speed * BOAT.reverse;
    const opposing = b.speed * target < 0 && Math.abs(b.speed) > 0.15;
    b.speed += (target - b.speed) * ease(spec.accel * (opposing ? BOAT.brake : 1), dt);
  } else {
    b.speed *= Math.exp(-BOAT.coast * dt);
    if (Math.abs(b.speed) < 0.02) b.speed = 0;
  }

  // Helm: full authority with way on, a slow pivot at rest.
  const way = Math.min(1, Math.abs(b.speed) / (BOAT.steerageAt * spec.speed));
  const wantYaw = rud * spec.turn * (BOAT.pivot + (1 - BOAT.pivot) * way);
  b.yawRate += (wantYaw - b.yawRate) * ease(BOAT.helm, dt);
  if (rud === 0 && Math.abs(b.yawRate) < 0.002) b.yawRate = 0;
  b.speed *= 1 - BOAT.turnDrag * Math.min(1, Math.abs(b.yawRate) / spec.turn) * dt;

  const h0 = b.heading, h1 = wrap(b.heading + b.yawRate * dt);
  // The hull slides a little: travel follows the heading with a lag.
  b.course = Math.abs(b.speed) < 0.05 ? h1 : wrap(b.course + wrap(h1 - b.course) * ease(BOAT.grip, dt));
  let vx = Math.sin(b.course) * b.speed, vz = Math.cos(b.course) * b.speed;

  // The murmur: a current back toward the middle of the region, stronger than the boat at the edge.
  const murmur = murmurAt(env, b.x, b.z);
  if (murmur > 0) {
    const ox = b.x - env.centre[0], oz = b.z - env.centre[1], r = Math.hypot(ox, oz) || 1;
    const push = murmur * murmur * spec.speed * BOAT.murmurPush;
    vx -= (ox / r) * push; vz -= (oz / r) * push;
  }

  const here = clearance(env, spec, b.x, b.z, h0);
  const ok = (x: number, z: number, h: number) => { const c = clearance(env, spec, x, z, h); return c >= 0 || c > here + 1e-6; };
  const x0 = b.x, z0 = b.z, nx = x0 + vx * dt, nz = z0 + vz * dt;
  let bump = 0, aground = false;
  if (ok(nx, nz, h1)) { b.x = nx; b.z = nz; b.heading = h1; }
  else {
    aground = true;
    const hit = Math.hypot(vx, vz);
    // Slide along the shore: drop the part of the motion that heads into shallower water.
    const e = 0.8;
    let gx = env.depth(b.x + e, b.z) - env.depth(b.x - e, b.z), gz = env.depth(b.x, b.z + e) - env.depth(b.x, b.z - e);
    const gl = Math.hypot(gx, gz);
    let moved = false;
    const tries: [number, number][] = [];
    if (gl > 1e-4) {
      gx /= gl; gz /= gl;
      const into = Math.min(0, vx * gx + vz * gz);
      tries.push([vx - into * gx, vz - into * gz]);
    }
    tries.push([vx, 0], [0, vz]);
    for (const [sx, sz] of tries) {
      if (Math.hypot(sx, sz) * dt < 1e-5) continue;
      for (const h of [h1, h0]) {
        if (ok(b.x + sx * dt, b.z + sz * dt, h)) { b.x += sx * dt; b.z += sz * dt; b.heading = h; moved = true; break; }
      }
      if (moved) break;
    }
    if (moved) {
      // Scraping along: it costs speed, and a hard glancing blow still registers.
      b.speed *= Math.exp(-BOAT.scrape * dt);
      const lost = hit - Math.hypot(b.x - x0, b.z - z0) / dt;
      if (lost > 0.45 * spec.speed) bump = clamp(lost / spec.speed, 0, 1);
    } else {
      // Nowhere to go: stop with a small rebound. Turning in place is still allowed if the hull has room;
      // where it has not, the turn works her a finger's width toward deeper water, as far as her end would
      // have swept, so a boat lying against a shelving shore can always be brought round with the helm alone.
      const work = Math.abs(wrap(h1 - h0)) * spec.length * 0.75;
      if (ok(b.x, b.z, h1)) b.heading = h1;
      else if (gl > 1e-4 && work > 0 && ok(b.x + gx * work, b.z + gz * work, h1)) { b.x += gx * work; b.z += gz * work; b.heading = h1; }
      else b.yawRate = 0;
      bump = clamp(Math.abs(b.speed) / spec.speed, 0, 1);
      b.speed = Math.abs(b.speed) > 0.6 ? -0.15 * b.speed : 0;
    }
  }
  return { bump: bump > 0.08 ? bump : 0, aground, murmur };
}

/**
 * The nearest pose to (x, z) where the hull floats with a little water to spare: tries the given heading
 * first, then others, on widening rings. Used to put a boat down by a landing. Null if nothing within `reach`.
 */
export function nearestFloat(env: BoatEnv, spec: BoatSpec, x: number, z: number, heading: number, reach = 60, spare = 0.15): { x: number; z: number; heading: number } | null {
  const headings = [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI].map((d) => wrap(heading + d));
  for (let r = 0; r <= reach; r += 1.5) {
    const n = r === 0 ? 1 : Math.max(8, Math.round(r * 2.2));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
      for (const h of headings) if (clearance(env, spec, px, pz, h) >= spare) return { x: px, z: pz, heading: h };
    }
  }
  return null;
}
