import { describe, expect, it } from 'vitest';
import { Vector4 } from 'three';
import { FishShadows, SHADOW_N, stalkRadius, type ShadowInput } from '../src/render/fish-shadows';
import { FishingSession, NO_INPUT } from '../src/core/fishing';
import { Rng } from '../src/core/rng';
import { ctx } from './helpers';

const DT = 1 / 60;
const out = () => ({ a: Array.from({ length: SHADOW_N }, () => new Vector4()), b: Array.from({ length: SHADOW_N }, () => new Vector4()), f: new Vector4() });
/** Land to the west (x < 0), sea to the east, shelving to 6 m. */
const depth = (x: number) => Math.max(0, Math.min(6, x * 0.5));
const base: ShadowInput = { cx: 6, cz: 0, lure: null, nextTug: Infinity, biting: false, fish: null };
const fromLure = (s: FishShadows, lure: { x: number; z: number }) => Math.hypot(s.biter.x - lure.x, s.biter.z - lure.z);

describe('fish shadows', () => {
  it('roam in water only, and hand the shader finite numbers', () => {
    const s = new FishShadows(depth, 7), o = out();
    for (let i = 0; i < 60 * 40; i++) s.update(DT, base, o.a, o.b, o.f);
    expect(s.roaming).toBeGreaterThan(8);
    for (let i = 0; i < SHADOW_N - 1; i++) {
      for (const v of [...o.a[i].toArray(), ...o.b[i].toArray()]) expect(Number.isFinite(v)).toBe(true);
      // Anything still visible is over water.
      if (o.b[i].z > 0.05) expect(depth(o.a[i].x)).toBeGreaterThan(0.5);
    }
    expect(s.biter.mode).toBe('off');
  });

  it('the biter closes on the float as the tug comes due, then backs off after a nibble', () => {
    const s = new FishShadows(depth, 3), o = out();
    const lure = { x: 14, z: 2 };
    let t = 6;
    const far: number[] = [];
    while (t > 0) { s.update(DT, { ...base, lure, nextTug: t }, o.a, o.b, o.f); t -= DT; if (Math.abs(t - 4) < DT / 2 || Math.abs(t - 1) < DT / 2) far.push(fromLure(s, lure)); }
    expect(s.biter.mode).toBe('stalk');
    expect(far[0]).toBeGreaterThan(far[1]);          // further out with 4 s to go than with 1 s
    expect(fromLure(s, lure)).toBeLessThan(1.3);     // on the float (nose to it) when the tug lands
    s.nibble();
    for (let i = 0; i < 40; i++) s.update(DT, { ...base, lure, nextTug: 5 }, o.a, o.b, o.f);
    expect(fromLure(s, lure)).toBeGreaterThan(2.5);
  });

  it('holds the float during the bite, follows the hooked fish, and leaves when the line comes in', () => {
    const s = new FishShadows(depth, 5), o = out();
    const lure = { x: 14, z: 0 };
    for (let i = 0; i < 90; i++) s.update(DT, { ...base, lure, nextTug: 1.5 - i * DT }, o.a, o.b, o.f);
    for (let i = 0; i < 30; i++) s.update(DT, { ...base, lure, biting: true }, o.a, o.b, o.f);
    expect(fromLure(s, lure)).toBeLessThan(1.3);
    const fish = { x: 11, z: 3, len: 2 };
    for (let i = 0; i < 60; i++) s.update(DT, { ...base, fish }, o.a, o.b, o.f);
    expect(s.biter.mode).toBe('fight');
    expect(Math.hypot(s.biter.x - fish.x, s.biter.z - fish.z)).toBeLessThan(0.2);
    for (let i = 0; i < 60 * 3; i++) s.update(DT, base, o.a, o.b, o.f);
    expect(s.biter.mode).toBe('off');
    expect(o.b[SHADOW_N - 1].z).toBeLessThan(0.01);
  });

  it('a splash sends nearby shadows away from it', () => {
    const s = new FishShadows(depth, 11), o = out();
    for (let i = 0; i < 60 * 10; i++) s.update(DT, base, o.a, o.b, o.f);
    const i0 = o.b.findIndex((b, i) => i < SHADOW_N - 1 && b.z > 0.1);
    const at = { x: o.a[i0].x, z: o.a[i0].y };
    s.scatter(at.x + 0.3, at.z, 5);
    for (let i = 0; i < 45; i++) s.update(DT, base, o.a, o.b, o.f);
    expect(Math.hypot(o.a[i0].x - at.x, o.a[i0].y - at.z)).toBeGreaterThan(1.5);
  });

  it('stalkRadius shrinks to nothing at the tug', () => {
    expect(stalkRadius(0)).toBe(0);
    expect(stalkRadius(1)).toBeCloseTo(1.6);
    expect(stalkRadius(30)).toBe(8);
    for (let t = 0; t < 10; t += 0.1) expect(stalkRadius(t + 0.1)).toBeGreaterThanOrEqual(stalkRadius(t));
  });
});

describe('nextTug', () => {
  it('counts down to the next nibble or the bite while waiting, and is Infinity otherwise', () => {
    const s = new FishingSession(ctx(), new Rng(4));
    expect(s.nextTug).toBe(Infinity);
    s.update(DT, { ...NO_INPUT, primary: true, primaryPressed: true });
    while (s.power < 0.6) s.update(DT, { ...NO_INPUT, primary: true });
    s.update(DT, { ...NO_INPUT, primaryReleased: true });
    while (s.phase === 'casting') s.update(DT, NO_INPUT);
    expect(s.phase).toBe('waiting');
    let last = s.nextTug, tugs = 0;
    expect(last).toBeGreaterThan(0);
    for (let i = 0; i < 60 * 40 && s.phase === 'waiting'; i++) {
      s.update(DT, NO_INPUT);
      const now = s.nextTug;
      if (s.events.some((e) => e.type === 'nibble' || e.type === 'bite')) { tugs++; expect(last).toBeLessThan(0.05); s.events.length = 0; }
      else if (s.phase === 'waiting') expect(now).toBeLessThanOrEqual(last + 1e-9);
      last = now;
    }
    expect(tugs).toBeGreaterThan(0);
    expect(s.phase).toBe('bite');
    expect(s.nextTug).toBe(Infinity);
  });
});
