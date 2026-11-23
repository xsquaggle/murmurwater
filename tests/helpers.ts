import { Rng } from '../src/core/rng';
import { FishingSession, NO_INPUT, type FishingContext, type FishingInput } from '../src/core/fishing';
import { bait, rod, type FishDef } from '../src/core/content';

export function ctx(over: Partial<FishingContext> = {}): FishingContext {
  return {
    rod: rod('driftwood-rod'), bait: bait('breadcrumb'), hour: 12, luck: 0, biteWindowMult: 1, strangeChance: 0.03,
    flags: new Set(), region: 'hearthbay', spot: () => ({ zoneId: 'hb-bay', depth: 5, hotspot: false }), ...over,
  };
}

/** Skilled player policy for the fight phase: pulse the reel to keep tension in band, counter runs. */
export function skilledFightInput(s: FishingSession, reactionDelay = 0.18, state = { warnAt: -1, t: 0 }): FishingInput {
  const fs = s.fight!;
  state.t += 1 / 60;
  const thrash = fs.thrash > 0;
  const reel = !thrash && fs.tension < 0.72;
  const steer = fs.run !== 0 && fs.time > reactionDelay ? -fs.run : 0;
  return { ...NO_INPUT, primary: reel, steer };
}

/** Plays a whole fight with a policy, returns outcome. */
export function playFight(fish: FishDef, opts: { seed?: number; rodId?: string; perfect?: boolean; policy?: 'skilled' | 'mash' | 'idle' } = {}) {
  const s = new FishingSession(ctx({ rod: rod(opts.rodId ?? 'driftwood-rod') }), new Rng(opts.seed ?? 1));
  (s as any).castDistance = s.ctx.rod.reach * 0.8;
  (s as any).startFight(fish, opts.perfect ?? false);
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 180 && s.phase === 'fighting'; i++) {
    let inp: FishingInput;
    if (opts.policy === 'mash') inp = { ...NO_INPUT, primary: true };
    else if (opts.policy === 'idle') inp = NO_INPUT;
    else inp = skilledFightInput(s);
    s.update(dt, inp);
  }
  const ev = s.events.find((e) => e.type === 'landed' || e.type === 'lost');
  return { phase: s.phase, ev, time: s.lastCatch?.fightTime ?? -1 };
}

/**
 * A human-ish policy: decides at ~8 Hz, perceives tension with noise, reacts to runs and thrashes late,
 * and occasionally lapses. Used to tune difficulty toward real players, not perfect bots.
 */
export function humanFightPolicy(seed: number, skill = 0.7) {
  const rng = new Rng(seed * 7919 + 13);
  let next = 0, reel = false, steer = 0, runSeen = 0, runAge = 0, thrashAge = 0, lapse = 0;
  const reaction = 0.42 - 0.22 * skill;
  return (s: FishingSession, t: number): FishingInput => {
    const fs = s.fight!;
    runAge = fs.run !== 0 ? (fs.run === runSeen ? runAge + 1 / 60 : 0) : 0;
    runSeen = fs.run;
    thrashAge = fs.thrash > 0 ? thrashAge + 1 / 60 : 0;
    if (t >= next) {
      next = t + rng.range(0.1, 0.16);
      if (lapse > 0) lapse -= 0.13; else if (rng.chance(0.02 * (1 - skill))) lapse = rng.range(0.3, 0.8);
      const perceived = fs.tension + rng.range(-0.1, 0.1) * (1.2 - skill);
      const thrashKnown = thrashAge > reaction;
      if (lapse <= 0) reel = !thrashKnown && perceived < 0.68 + 0.08 * skill;
      steer = fs.run !== 0 && runAge > reaction ? -fs.run : 0;
    }
    return { ...NO_INPUT, primary: reel, steer };
  };
}

export function playFightHuman(fish: FishDef, opts: { seed?: number; rodId?: string; skill?: number; perfect?: boolean } = {}) {
  const s = new FishingSession(ctx({ rod: rod(opts.rodId ?? 'driftwood-rod') }), new Rng(opts.seed ?? 1));
  (s as any).castDistance = s.ctx.rod.reach * 0.8;
  (s as any).startFight(fish, opts.perfect ?? false);
  const pol = humanFightPolicy(opts.seed ?? 1, opts.skill ?? 0.7);
  const dt = 1 / 60;
  let t = 0;
  for (let i = 0; i < 60 * 180 && s.phase === 'fighting'; i++) { s.update(dt, pol(s, t)); t += dt; }
  const ev = s.events.find((e) => e.type === 'landed' || e.type === 'lost');
  return { phase: s.phase, ev, time: s.lastCatch?.fightTime ?? -1 };
}

/** A careful hand on a haul: pump the reel under the red, and let go at the knock until it has passed. */
export function skilledHaulInput(s: FishingSession): FishingInput {
  const h = s.haul!;
  return { ...NO_INPUT, primary: !h.snag && !h.warned && h.tension < 0.72 };
}

/**
 * A human-ish hand on a haul: decides at ~8 Hz, perceives tension with noise, feels the knock a little late
 * and now and then not at all, and lets go once it knows the thing has caught.
 */
export function humanHaulPolicy(seed: number, skill = 0.7) {
  const rng = new Rng(seed * 6007 + 5);
  let next = 0, reel = false, warnAge = 0, snagAge = 0, deaf = false;
  const reaction = 0.42 - 0.22 * skill;
  return (s: FishingSession, t: number): FishingInput => {
    const h = s.haul!;
    if (h.warned) { if (warnAge === 0) deaf = rng.chance(0.3 * (1 - skill)); warnAge += 1 / 60; } else warnAge = 0;
    snagAge = h.snag ? snagAge + 1 / 60 : 0;
    if ((h.warned && !deaf && warnAge > reaction) || snagAge > reaction) reel = false;
    else if (t >= next) {
      next = t + rng.range(0.1, 0.16);
      const perceived = h.tension + rng.range(-0.1, 0.1) * (1.2 - skill);
      reel = !h.snag && perceived < 0.68 + 0.08 * skill;
    }
    return { ...NO_INPUT, primary: reel };
  };
}

/** Plays a whole haul of a thing of this weight, from the strike, and says how it ended. */
export function playHaul(heft: number, opts: { seed?: number; rodId?: string; policy?: 'skilled' | 'human' | 'mash' | 'idle'; skill?: number; distance?: number } = {}) {
  const s = new FishingSession(ctx({ rod: rod(opts.rodId ?? 'driftwood-rod') }), new Rng(opts.seed ?? 1));
  (s as any).castDistance = opts.distance ?? s.ctx.rod.reach * 0.8;
  (s as any).startHaul({ id: 'crate:hearthbay', kind: 'crate', heft });
  const human = humanHaulPolicy(opts.seed ?? 1, opts.skill ?? 0.7);
  const dt = 1 / 60;
  let t = 0, snags = 0, eased = 0;
  for (let i = 0; i < 60 * 240 && s.phase === 'hauling'; i++, t += dt) {
    const inp = opts.policy === 'mash' ? { ...NO_INPUT, primary: true } : opts.policy === 'idle' ? NO_INPUT : opts.policy === 'human' ? human(s, t) : skilledHaulInput(s);
    s.update(dt, inp);
    for (const e of s.events) { if (e.type === 'snag') snags++; else if (e.type === 'eased') eased++; }
    if (s.phase === 'hauling') s.events.length = 0;
  }
  const ev = s.events.find((e) => e.type === 'found' || e.type === 'lost');
  return { phase: s.phase, ev, time: t, snags, eased };
}
