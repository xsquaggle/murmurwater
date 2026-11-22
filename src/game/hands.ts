/**
 * The hands aboard: their clocks, which run only while the game does and the boat lies still (the rules are
 * core/crew.ts), what they look like at their work, and what the keeper is told of it. This is the glue to the game.
 */
import { Color, Vector3, type Group } from 'three';
import type { Game } from './game';
import type { BoatRig } from '../render/boat-rig';
import { CatAboard, HollisAboard } from '../render/crew-figures';
import { makeFish, type FishObject } from '../render/fish-models';
import { CREW_BY_ID, aboard, basket, crewKit, crewKnows, darkEnough, tickCrew, working, type CrewCatch, type CrewDef, type CrewEnv } from '../core/crew';
import { fogAt } from '../core/boat';
import { REGIONS_BY_ID, fish, zoneAt } from '../core/content';
import { fmt } from '../core/economy';

/** What one hand is doing, for the Crew page and the bots. */
export type HandState = 'fishing' | 'under way' | 'full' | 'too light' | 'nothing here' | 'ashore';
const SAY: Record<HandState, string> = {
  fishing: 'Fishing', 'under way': 'Waiting for the boat to lie still', full: 'The basket is full', 'too light': 'Too light for him: he fishes after dark, or in fog',
  'nothing here': 'Nothing from your journal swims here for them', ashore: 'Ashore: no berth in this boat',
};
export const handStateText = (st: HandState) => SAY[st];

interface Flying { fish: FishObject; t: number; dur: number; parent: Group; from: Vector3; to: Vector3 }

export class Hands {
  /** Where the boat lies and how, as the crew see it (null with no crew or no boat). */
  env: CrewEnv | null = null;
  private rig: BoatRig | null = null;
  private shown = '';
  private cat: CatAboard | null = null; private hollis: HollisAboard | null = null;
  private catBerth: Group | null = null; private hollisBerth: Group | null = null;
  private zone: string | null = null; private zoneT = 0;
  private fullTold: boolean;
  private stillT = 0;
  private told = new Set<string>();
  private thick: boolean | null = null;
  private flying: Flying[] = [];
  private v = new Vector3();
  private white = new Color('#E8FFF4');

  constructor(private g: Game) {
    // A basket that was full when the game was closed says so once, not as news.
    this.fullTold = basket(g.state).full;
  }

  /** The boat is being changed for another (see Sailing.fitOut): the hands step off before the old hull is broken up. */
  unship() {
    for (const f of this.flying) f.fish.dispose();
    this.flying.length = 0;
    this.cat?.root.removeFromParent(); this.hollis?.root.removeFromParent();
    this.cat = null; this.hollis = null; this.catBerth = null; this.hollisBerth = null;
    this.rig = null; this.shown = '';
  }

  /** What each hand signed on is doing right now. */
  state(def: CrewDef): HandState {
    const s = this.g.state, env = this.env;
    if (!env || !aboard(s).some((c) => c.id === def.id)) return 'ashore';
    if (!env.still) return 'under way';
    if (def.when === 'dark' && !darkEnough(env)) return 'too light';
    if (basket(s).full) return 'full';
    return crewKnows(s, def, env.region, env.zone) > 0 ? 'fishing' : 'nothing here';
  }

  // ------------------------------------------------------------------ fixed step
  step(dt: number) {
    const g = this.g, s = g.state, sail = g.sailing;
    if (!s.crew.hired.length || !sail.owned) { this.env = null; return; }
    const b = sail.boat;
    this.zoneT -= dt;
    if (this.zoneT <= 0) { this.zoneT = 0.25; const r = REGIONS_BY_ID.get(s.world.region); this.zone = r ? zoneAt(r, b.x, b.z)?.id ?? null : null; }
    const env = this.env = { region: s.world.region, zone: this.zone, hour: s.hour, fog: fogAt(sail.env, b.x, b.z), still: Math.abs(b.speed) < 0.5 && !sail.busy };
    for (const c of tickCrew(s, dt, env, crewKit(g.stats))) this.landed(c);

    const bk = basket(s);
    if (bk.full && !this.fullTold) {
      this.fullTold = true;
      g.audio.basketFull();
      g.hud.toast(`The crew basket is full: ${bk.fish} fish, ◉ ${fmt(bk.value)} at the stall`, 'good');
    } else if (!bk.full) this.fullTold = false;

    // Lying still with the keeper aboard, somewhere the journal knows nothing for a hand: said once for each water.
    this.stillT = env.still && sail.aboard ? this.stillT + dt : 0;
    if (this.stillT > 8) {
      this.stillT = -30;
      for (const def of aboard(s)) {
        const key = `${def.id}:${env.region}:${env.zone}`;
        if (this.told.has(key) || !working(def, env) || crewKnows(s, def, env.region, env.zone) > 0) continue;
        this.told.add(key);
        g.hud.toast(`${def.name} has nothing to fish for here: your journal knows no fish of this water that ${def.id === 'biscuit' ? 'she' : 'he'} can land`);
        break;
      }
    }
  }

  private landed(c: CrewCatch) {
    const g = this.g, s = g.state, sail = g.sailing, def = CREW_BY_ID.get(c.who)!, tally = s.crew.tally[c.who];
    const d = Math.hypot(sail.boat.x - g.pos.x, sail.boat.z - g.pos.z), gain = Math.max(0, 1 - d / 45), name = fish(c.fishId).name;
    if (c.who === 'biscuit') {
      if (c.eaten) {
        this.cat?.eat();
        if (gain > 0) g.audio.catEat(gain);
        if (tally?.eaten === 1) g.hud.toast('Biscuit ate that one. Every fourth fish is hers: those are her wages.');
      } else {
        this.cat?.swat();
        if (gain > 0) g.audio.catCatch(gain);
        if (this.catBerth) this.flick(this.catBerth, c);
      }
    } else {
      this.hollis?.pull(c.item ? makeFish(c.fishId, c.item.weight) : null);
      if (gain > 0) g.audio.hollisCatch(gain);
      if (this.hollis && this.hollisBerth) { const [x, z] = this.hollis.lineEnd(); this.ring(this.hollisBerth, x, z, 0.8); }
    }
    if (!c.eaten && tally?.fish === 1) g.hud.toast(`${def.name} landed a ${name}. What the crew catch goes in the crew basket, and sells with yours.`, 'good');
  }

  /** A ring and a little spray on the water beside the boat, at a point given in a berth's own frame. */
  private ring(berth: Group, x: number, z: number, size: number) {
    const g = this.g, p = berth.localToWorld(this.v.set(x, 0, z));
    const y = g.waveY(p.x, p.z);
    g.fx.spray.burst(p.setY(y + 0.08), Math.round(8 * size), this.white, 1.1 * size, 1.8 * size, 0.6, 0.1);
    g.fx.ripples.spawn(p.setY(0), 1.1 * size, 1.1);
  }

  /** The cat's fish: flicked out of the water over the side and into the boat. */
  private flick(berth: Group, c: CrewCatch) {
    this.ring(berth, 0, 1.0, 0.7);
    const f = makeFish(c.fishId, c.item?.weight);
    f.obj.scale.multiplyScalar(0.8);
    berth.add(f.obj);
    this.flying.push({ fish: f, t: 0, dur: 0.5, parent: berth, from: new Vector3(0, this.waterIn(berth, 0, 1.0), 1.0), to: new Vector3(0.25, 0.02, -0.25) });
  }

  /** The water's height at a point of a berth's frame, in that frame. */
  private waterIn(berth: Group, x: number, z: number): number {
    const p = berth.localToWorld(this.v.set(x, 0, z));
    const y = this.g.waveY(p.x, p.z);
    return berth.worldToLocal(p.setY(y)).y;
  }

  // ------------------------------------------------------------------ per frame
  private ship(rig: BoatRig | null, want: string) {
    this.unship();
    this.rig = rig; this.shown = want;
    if (!rig || !want) return;
    want.split(',').forEach((id, i) => {
      const berth = rig.berth(i);
      if (!berth) return;
      if (id === 'biscuit') { this.cat = new CatAboard(); this.catBerth = berth; berth.add(this.cat.root); }
      else if (id === 'hollis') { this.hollis = new HollisAboard(); this.hollisBerth = berth; berth.add(this.hollis.root); }
    });
    this.thick = null;
  }

  present(dt: number) {
    const g = this.g, s = g.state, sail = g.sailing, rig = sail.owned ? sail.rig : null;
    const want = rig ? aboard(s).map((c) => c.id).join(',') : '';
    if (rig !== this.rig || want !== this.shown) this.ship(rig, want);
    if (!rig) return;
    const env = this.env, time = g.world.time;
    if (this.cat) {
      // She knows before the float does: with the keeper's line out from this boat, she leans to the water a
      // second and a half before the bite (not for a nibble).
      const bite = sail.aboard ? g.session.biteIn : Infinity;
      this.cat.update(dt, bite < 1.5 ? 1 : 0);
    }
    if (this.hollis && this.hollisBerth) {
      const thick = !!env && darkEnough(env);
      const fishing = thick && !!env?.still && !basket(s).full;
      this.hollis.update(dt, thick ? 1 : 0, fishing, this.waterIn(this.hollisBerth, 0.1, 1.2));
      // He thins with the light and is there again with the dark or the fog: heard, and said the first time.
      if (this.thick !== null && thick !== this.thick) {
        const near = sail.aboard || Math.hypot(sail.boat.x - g.pos.x, sail.boat.z - g.pos.z) < 40;
        if (near) { if (thick) g.audio.hollisThick(); else g.audio.hollisThin(); }
        const key = thick ? 'hollis-thick' : 'hollis-thin';
        if (near && !this.told.has(key)) {
          this.told.add(key);
          g.hud.toast(thick ? 'Mister Hollis is there again. He lets his line down.' : 'Mister Hollis thins with the daylight. He will fish again after dark, or in fog.');
        }
      }
      this.thick = thick;
    }
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      f.fish.obj.position.lerpVectors(f.from, f.to, k);
      f.fish.obj.position.y += Math.sin(Math.PI * k) * 0.55;
      f.fish.obj.rotation.set(k * 5, k * 3, 0);
      f.fish.animate(time, 1);
      // It lies on the boards for a breath, flapping, and then it is in the basket.
      if (f.t > f.dur + 0.5) { f.fish.dispose(); this.flying.splice(i, 1); }
    }
  }
}
