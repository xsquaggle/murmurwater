/**
 * The fishing state machine: charge → cast → wait (nibbles) → bite → hook → fight → landed/lost.
 * Pure logic, fixed-step, seeded RNG. Presentation reads `state` and drains `events`.
 * Tuning constants live in FEEL so they can be adjusted in one place (and by tests/sims).
 */
import { Rng } from './rng';
import { FISH, inHours, type BaitDef, type FishDef, type RodDef, type Rarity, RARITIES } from './content';

export const FEEL = {
  chargeTime: 0.95,          // s to go from 0 to full power
  sweetSpot: [0.8, 0.96] as [number, number],
  minCastPower: 0.12,
  flightBase: 0.45, flightPerMetre: 0.022,
  waitMin: 4.5, waitMax: 11,
  cleanCastWait: 0.75, hotspotWait: 0.6,
  nibbleSpookWindow: 0.45,   // pressing within this after a nibble spooks the fish
  spookPenalty: 3, earlyPenalty: 1.2,
  perfectFraction: 0.38,     // first part of the bite window counts as Perfect
  perfectStamina: 0.82,      // fish starts the fight with this much stamina after a Perfect hook
  landDistance: 1.6,
  // Fight
  tensionRise: 0.36,         // per second, scaled by (fish pull / rod control)^tensionExponent
  tensionExponent: 1.55,
  runTension: 0.2,           // tension a running fish adds per second, even when not reeling     // >1 makes strong fish disproportionately harder; better rods matter
  tensionRelax: 0.95,        // per second when not reeling
  tensionRelaxReeling: 0.22, // natural relief while reeling in calm water
  slackThreshold: 0.07, slackTime: 2.4,
  runWarn: 0.4,
  runInterval: [1.6, 4.2] as [number, number],
  runDuration: [0.9, 1.9] as [number, number],
  thrashDuration: 0.85,
  staminaDrain: 0.03, staminaDrainReel: 0.045, staminaDrainCounter: 0.13,
  fishSwimOut: 0.55,         // m/s fish gains distance when not reeled, scaled by pull
};

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 62, uncommon: 24, rare: 9.5, epic: 3.4, legendary: 1.0, uncanny: 0.35 };

export type Phase = 'idle' | 'charging' | 'casting' | 'waiting' | 'bite' | 'fighting' | 'landed' | 'lost';
export type LostReason = 'snap' | 'slack' | 'missed' | 'cancel';

export type FishingEvent =
  | { type: 'cast'; power: number; clean: boolean; distance: number }
  | { type: 'splash' }
  | { type: 'nibble'; strength: number }
  | { type: 'bite'; fishId: string; window: number }
  | { type: 'hook'; grade: 'perfect' | 'good' }
  | { type: 'tooEarly'; spooked: boolean }
  | { type: 'missed' }
  | { type: 'runWarn'; dir: -1 | 1 }
  | { type: 'run'; dir: -1 | 1 }
  | { type: 'thrash' }
  | { type: 'landed'; catch: CatchResult }
  | { type: 'lost'; reason: LostReason; fishId?: string }
  | { type: 'reeledIn' };

export interface CatchResult {
  fishId: string; weight: number; sizeFactor: number; trait: StrangeTrait | null;
  perfectHook: boolean; cleanCast: boolean; fightTime: number;
}

export const STRANGE_TRAITS = [
  { id: 'glimmering', name: 'Glimmering', mult: 2, weight: 50 },
  { id: 'hollow', name: 'Hollow', mult: 3, weight: 25 },
  { id: 'two-faced', name: 'Two-Faced', mult: 4, weight: 14 },
  { id: 'humming', name: 'Humming', mult: 5, weight: 8 },
  { id: 'inverted', name: 'Inverted', mult: 8, weight: 3 },
] as const;
export type StrangeTrait = (typeof STRANGE_TRAITS)[number]['id'];

export interface FishingInput {
  primary: boolean;        // LMB held
  primaryPressed: boolean; // LMB went down this tick
  primaryReleased: boolean;
  steer: number;           // -1..1 (A/D or mouse)
  cancel: boolean;         // RMB/E pressed this tick
}
export const NO_INPUT: FishingInput = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };

export interface SpotInfo { zoneId: string | null; depth: number; hotspot: boolean }

export interface FishingContext {
  rod: RodDef;
  bait: BaitDef;
  hour: number;
  luck: number;               // extra luck from gear/relics/echoes (0 = none)
  biteWindowMult: number;     // ≥ 1 widens bite windows
  strangeChance: number;      // base ~0.03
  flags: Set<string>;         // story flags for gated fish
  region: string;
  spot: (distance: number) => SpotInfo; // where the lure lands for a given cast distance
}

export interface FightState {
  fish: FishDef;
  distance: number;
  tension: number;
  stamina: number;            // 1 → 0
  run: -1 | 0 | 1;
  runTimer: number;
  nextRunIn: number;
  warned: boolean;
  pendingRun: -1 | 1;
  thrash: number;             // seconds of thrash remaining
  overload: number;
  slack: number;
  time: number;
  perfect: boolean;
}

export class FishingSession {
  phase: Phase = 'idle';
  power = 0;
  private chargeDir = 1;
  private chargeT = 0;
  castDistance = 0;
  cleanCast = false;
  private flight = 0;
  private wait = 0;
  private nibbles: number[] = [];
  private lastNibble = -99;
  private waitElapsed = 0;
  private biteTimer = 0;
  biteWindow = 0;
  private biteFish: FishDef | null = null;
  spot: SpotInfo = { zoneId: null, depth: 0, hotspot: false };
  fight: FightState | null = null;
  lastCatch: CatchResult | null = null;
  lostReason: LostReason | null = null;
  private resultTimer = 0;
  readonly events: FishingEvent[] = [];

  constructor(public ctx: FishingContext, public rng: Rng) {}

  get busy() { return this.phase !== 'idle'; }

  /** Fixed-step update. */
  update(dt: number, input: FishingInput) {
    switch (this.phase) {
      case 'idle':
        if (input.primaryPressed) { this.phase = 'charging'; this.power = 0; this.chargeDir = 1; this.chargeT = 0; }
        break;
      case 'charging': this.updateCharge(dt, input); break;
      case 'casting':
        this.flight -= dt;
        if (input.cancel) { this.reelIn(); break; }
        if (this.flight <= 0) { this.events.push({ type: 'splash' }); this.startWait(false); }
        break;
      case 'waiting': this.updateWait(dt, input); break;
      case 'bite': this.updateBite(dt, input); break;
      case 'fighting': this.updateFight(dt, input); break;
      case 'landed':
      case 'lost':
        this.resultTimer -= dt;
        if (this.resultTimer <= 0 || input.primaryPressed) this.phase = 'idle';
        break;
    }
  }

  private updateCharge(dt: number, input: FishingInput) {
    if (input.cancel) { this.phase = 'idle'; return; }
    this.chargeT += dt;
    this.power += (this.chargeDir * dt) / FEEL.chargeTime;
    if (this.power >= 1) { this.power = 1; this.chargeDir = -1; }
    if (this.power <= 0.25 && this.chargeDir < 0) this.chargeDir = 1;
    if (input.primaryReleased || !input.primary) this.release();
  }

  private release() {
    const p = this.power;
    if (p < FEEL.minCastPower) { this.phase = 'idle'; return; }
    const [lo, hi] = FEEL.sweetSpot;
    this.cleanCast = p >= lo && p <= hi;
    // Overcharged casts (falling back from max) lose a bit of distance.
    this.castDistance = Math.max(3, this.ctx.rod.reach * (0.25 + 0.75 * p));
    this.spot = this.ctx.spot(this.castDistance);
    this.flight = FEEL.flightBase + this.castDistance * FEEL.flightPerMetre;
    this.phase = 'casting';
    this.events.push({ type: 'cast', power: p, clean: this.cleanCast, distance: this.castDistance });
  }

  private startWait(afterMiss: boolean) {
    this.phase = 'waiting';
    let w = this.rng.range(FEEL.waitMin, FEEL.waitMax) / this.ctx.bait.biteSpeed;
    if (this.cleanCast && !afterMiss) w *= FEEL.cleanCastWait;
    if (this.spot.hotspot) w *= FEEL.hotspotWait;
    this.wait = w;
    this.waitElapsed = 0;
    const n = this.rng.int(0, 3);
    this.nibbles = [];
    for (let i = 0; i < n; i++) this.nibbles.push(this.rng.range(0.8, Math.max(1, w - 0.9)));
    this.nibbles.sort((a, b) => a - b);
  }

  private updateWait(dt: number, input: FishingInput) {
    if (input.cancel) { this.reelIn(); return; }
    this.waitElapsed += dt;
    while (this.nibbles.length && this.nibbles[0] <= this.waitElapsed) {
      this.nibbles.shift();
      this.lastNibble = this.waitElapsed;
      this.events.push({ type: 'nibble', strength: this.rng.range(0.3, 0.8) });
    }
    if (input.primaryPressed) {
      const spooked = this.waitElapsed - this.lastNibble < FEEL.nibbleSpookWindow;
      this.events.push({ type: 'tooEarly', spooked });
      this.wait += spooked ? FEEL.spookPenalty : FEEL.earlyPenalty;
      return;
    }
    if (this.waitElapsed >= this.wait) {
      const f = this.rollFish();
      if (!f) { this.startWait(true); return; }
      this.biteFish = f;
      this.biteWindow = f.biteWindow * this.ctx.biteWindowMult;
      this.biteTimer = 0;
      this.phase = 'bite';
      this.events.push({ type: 'bite', fishId: f.id, window: this.biteWindow });
    }
  }

  private updateBite(dt: number, input: FishingInput) {
    this.biteTimer += dt;
    if (input.primaryPressed) {
      const perfect = this.biteTimer <= this.biteWindow * FEEL.perfectFraction;
      this.events.push({ type: 'hook', grade: perfect ? 'perfect' : 'good' });
      this.startFight(this.biteFish!, perfect);
      return;
    }
    if (input.cancel) { this.reelIn(); return; }
    if (this.biteTimer > this.biteWindow) {
      this.events.push({ type: 'missed' });
      this.biteFish = null;
      this.startWait(true);
    }
  }

  private startFight(f: FishDef, perfect: boolean) {
    this.phase = 'fighting';
    this.fight = {
      fish: f, distance: this.castDistance, tension: 0.25, stamina: perfect ? FEEL.perfectStamina : 1,
      run: 0, runTimer: 0, nextRunIn: this.rng.range(0.8, 1.8), warned: false, pendingRun: 1, thrash: 0,
      overload: 0, slack: 0, time: 0, perfect,
    };
  }

  /** Effective pull of the fish right now (m/s-ish units). */
  static pull(fs: FightState): number {
    const f = fs.fish.fight;
    let p = f.strength * (0.35 + 0.65 * fs.stamina);
    if (fs.run !== 0) p *= 1.7;
    if (fs.thrash > 0) p *= 2.0;
    return p;
  }

  private updateFight(dt: number, input: FishingInput) {
    const fs = this.fight!;
    const rod = this.ctx.rod;
    const f = fs.fish.fight;
    fs.time += dt;
    if (input.cancel) { this.lose('cancel'); return; }

    // Run scheduling with a telegraph.
    if (fs.run === 0) {
      fs.nextRunIn -= dt;
      if (!fs.warned && fs.nextRunIn <= FEEL.runWarn) {
        fs.warned = true;
        fs.pendingRun = this.rng.chance(0.5) ? 1 : -1;
        this.events.push({ type: 'runWarn', dir: fs.pendingRun });
      }
      if (fs.nextRunIn <= 0) {
        fs.run = fs.pendingRun;
        fs.runTimer = this.rng.range(...FEEL.runDuration) * (0.7 + 0.3 * fs.stamina);
        this.events.push({ type: 'run', dir: fs.run });
        if (this.rng.chance(f.thrash)) { fs.thrash = FEEL.thrashDuration; this.events.push({ type: 'thrash' }); }
      }
    } else {
      fs.runTimer -= dt;
      if (fs.runTimer <= 0) {
        fs.run = 0; fs.warned = false;
        const [a, b] = FEEL.runInterval;
        fs.nextRunIn = this.rng.range(a, b) / Math.max(0.3, f.temper);
      }
    }
    if (fs.thrash > 0) fs.thrash = Math.max(0, fs.thrash - dt);

    const pull = FishingSession.pull(fs);
    const steer = Math.max(-1, Math.min(1, input.steer));
    let steerFactor = 1;
    let countering = 0;
    if (fs.run !== 0 && steer !== 0) {
      if (Math.sign(steer) === -fs.run) { countering = Math.abs(steer); steerFactor = 1 - 0.6 * countering; }
      else steerFactor = 1 + 0.7 * Math.abs(steer);
    }

    // During a run the fish pulls against the drag whether or not you reel: counter-steer or risk a snap.
    if (fs.run !== 0) {
      const steerMod = countering > 0 ? 1 - 0.8 * countering : steer !== 0 ? 1.35 : 1;
      fs.tension += FEEL.runTension * Math.pow(pull / rod.control, FEEL.tensionExponent) * steerMod * dt;
    }
    if (input.primary) {
      const rise = FEEL.tensionRise * Math.pow(pull / rod.control, FEEL.tensionExponent) * steerFactor * (fs.thrash > 0 ? 2.2 : 1);
      fs.tension += (rise - FEEL.tensionRelaxReeling) * dt;
      const reel = rod.power * (1 - 0.35 * fs.tension) - pull * 0.55 * (fs.run !== 0 ? 1 - 0.5 * countering : 0.5);
      fs.distance -= Math.max(0, reel) * dt;
    } else {
      fs.tension -= FEEL.tensionRelax * dt;
      fs.distance += FEEL.fishSwimOut * pull * (fs.run !== 0 ? 1 : 0.4) * dt;
    }
    fs.tension = Math.max(0, Math.min(1.05, fs.tension));
    fs.distance = Math.max(0, Math.min(this.ctx.rod.reach * 1.35, fs.distance));

    const drain = FEEL.staminaDrain + (input.primary ? FEEL.staminaDrainReel : 0) + countering * FEEL.staminaDrainCounter;
    fs.stamina = Math.max(0, fs.stamina - (drain / Math.max(0.4, f.stamina)) * dt);

    if (fs.tension >= 1) { fs.overload += dt; if (fs.overload > rod.grace) { this.lose('snap'); return; } }
    else fs.overload = Math.max(0, fs.overload - dt * 2);

    if (fs.tension < FEEL.slackThreshold && !input.primary) { fs.slack += dt; if (fs.slack > FEEL.slackTime) { this.lose('slack'); return; } }
    else fs.slack = Math.max(0, fs.slack - dt * 3);

    if (fs.distance <= FEEL.landDistance) this.land();
  }

  private land() {
    const fs = this.fight!;
    const f = fs.fish;
    const r = Math.pow(this.rng.next(), 1.7);
    const weight = Math.round((f.weight[0] + (f.weight[1] - f.weight[0]) * r) * 100) / 100;
    const sizeFactor = 0.75 + 0.6 * r;
    let trait: StrangeTrait | null = null;
    const chance = this.ctx.strangeChance * (fs.perfect ? 1.25 : 1) * (this.cleanCast ? 1.15 : 1);
    if (this.rng.chance(chance)) trait = this.rng.weighted(STRANGE_TRAITS, (t) => t.weight).id;
    this.lastCatch = { fishId: f.id, weight, sizeFactor, trait, perfectHook: fs.perfect, cleanCast: this.cleanCast, fightTime: fs.time };
    this.phase = 'landed';
    this.resultTimer = 2.2;
    this.events.push({ type: 'landed', catch: this.lastCatch });
    this.fight = null;
  }

  private lose(reason: LostReason) {
    this.lostReason = reason;
    this.events.push({ type: 'lost', reason, fishId: this.fight?.fish.id });
    this.fight = null;
    this.phase = 'lost';
    this.resultTimer = 1.4;
  }

  reelIn() {
    this.phase = 'idle';
    this.fight = null;
    this.events.push({ type: 'reeledIn' });
  }

  /** Pick which fish bites, from the current spot, time, bait and luck. */
  rollFish(): FishDef | null {
    const c = this.ctx;
    const zone = this.spot.zoneId;
    const cands = FISH.filter((f) => f.region === c.region && (!zone || f.zones.includes(zone)) && inHours(c.hour, f.hours) && (!f.requires || c.flags.has(f.requires)));
    if (!cands.length) return null;
    const luck = c.luck + c.rod.luck + (c.bait.rarityBoost ?? 0) + (this.cleanCast ? 0.08 : 0) + (this.spot.hotspot ? 0.15 : 0);
    return this.rng.weighted(cands, (f) => {
      const tier = RARITIES.indexOf(f.rarity);
      return RARITY_WEIGHT[f.rarity] * (1 + luck * tier * 0.6) * (c.bait.affinity[f.id] ?? 1);
    });
  }
}
