/**
 * The things that come up on a line and are not fish: a crate, a sea chest, and whatever is in the oilcloth.
 *
 * On the line (`'line'`) a relic is only its bundle, and a box is shut. Held up (`'held'`) the chest is open
 * and the relic is itself, small enough for two hands. Crate and chest are the library's models, with
 * stand-ins built here when a file is missing; the bundle and the relics are built here. Everything is made
 * new each time and frees what it made when it is put away.
 */
import {
  BoxGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, IcosahedronGeometry, Mesh, MeshStandardMaterial, TorusGeometry,
} from 'three';
import type { FindKind } from '../core/fishing';
import { assets, freeOwn } from './assets';
import { Builder } from './builder';
import type { FishObject } from './fish-models';
import { PALETTE } from './palette';
import { createPropMaterial } from './props';

const C = (h: string) => new Color(h);
const INK = '#2B2630';
const FLAT: [number, number, number] = [Math.PI / 2, 0, 0];

// ---------------------------------------------------------------- stand-ins

/** A drift crate, 0.6 x 0.6 x 0.78 like the library's, standing on the origin. */
function crateStandIn(b: Builder) {
  const wood = C(PALETTE.driftwood), dark = wood.clone().multiplyScalar(0.66);
  b.add(new BoxGeometry(0.54, 0.54, 0.72), wood, { pos: [0, 0.3, 0] });
  for (const y of [0.05, 0.55]) b.add(new BoxGeometry(0.6, 0.08, 0.78), dark, { pos: [0, y, 0] });
  for (const x of [-1, 1]) for (const z of [-1, 1]) b.add(new BoxGeometry(0.07, 0.56, 0.07), dark, { pos: [x * 0.27, 0.3, z * 0.36] });
  for (const x of [-1, 1]) b.add(new BoxGeometry(0.03, 0.07, 0.8), dark, { pos: [x * 0.275, 0.3, 0], rot: [0.62, 0, 0] });
}

/** A sea chest, 0.66 wide, lock on +Z, standing on the origin. */
function chestStandIn(b: Builder, open: boolean) {
  const wood = C(PALETTE.driftwood).multiplyScalar(0.85), iron = C(PALETTE.slate);
  b.add(new BoxGeometry(0.66, 0.3, 0.44), wood, { pos: [0, 0.15, 0] });
  for (const x of [-0.2, 0.2]) b.add(new BoxGeometry(0.07, 0.32, 0.46), iron, { pos: [x, 0.15, 0] });
  if (open) {
    b.add(new BoxGeometry(0.66, 0.12, 0.44), wood, { pos: [0, 0.5, -0.27], rot: [-1.83, 0, 0] });
    b.add(new BoxGeometry(0.56, 0.02, 0.36), C(PALETTE.wick), { pos: [0, 0.29, 0] }, { emissive: 1, jitter: 0 });
  } else {
    b.add(new BoxGeometry(0.68, 0.13, 0.46), wood, { pos: [0, 0.365, 0] });
    for (const x of [-0.2, 0.2]) b.add(new BoxGeometry(0.07, 0.15, 0.48), iron, { pos: [x, 0.365, 0] });
  }
  b.add(new BoxGeometry(0.1, 0.1, 0.03), C(PALETTE.lantern), { pos: [0, 0.26, 0.225] }, { emissive: 0.3 });
}

/** Something wrapped in oilcloth and tied twice round, about 0.9 long. Whatever it is shows a little at one seam. */
function bundle(b: Builder) {
  const cloth = C(PALETTE.slate).lerp(C(PALETTE.pine), 0.45).multiplyScalar(0.8);
  b.add(Builder.wobble(new DodecahedronGeometry(0.36, 0), 0.09, 5), cloth, { scale: [1.25, 0.72, 0.9] });
  b.add(Builder.wobble(new BoxGeometry(0.52, 0.3, 0.42, 2, 1, 2), 0.06, 7), cloth.clone().multiplyScalar(0.85), { pos: [0.03, 0.02, 0], rot: [0.1, 0.5, 0.05] });
  for (const x of [-0.17, 0.19]) b.add(new TorusGeometry(0.29, 0.02, 4, 10), C(PALETTE.bone), { pos: [x, 0, 0], rot: [0, Math.PI / 2, 0], scale: [1, 0.92, 1.12] });
  b.add(new IcosahedronGeometry(0.045, 0), C(PALETTE.bone), { pos: [0.19, 0.27, 0] });
  b.add(new BoxGeometry(0.26, 0.035, 0.035), C(PALETTE.dreamViolet), { pos: [0, 0.2, 0.17], rot: [0.2, 0.3, 0.08] }, { emissive: 1.3, jitter: 0 });
}

// ---------------------------------------------------------------- relics

/**
 * The fished-up relics, each about one unit across, upright, its face to +Z. `more` takes what cannot be merged
 * into the one painted mesh (glass).
 */
const RELIC_SHAPES: Record<string, (b: Builder, more: Group) => void> = {
  'isoldes-spectacles': (b) => {
    const wire = C(PALETTE.lagoon).lerp(C(PALETTE.seafoam), 0.3);
    for (const x of [-0.25, 0.25]) b.add(new TorusGeometry(0.2, 0.032, 5, 12), wire, { pos: [x, 0, 0] });
    b.add(new TorusGeometry(0.07, 0.026, 4, 6, Math.PI), wire, { pos: [0, 0.05, 0] });
    for (const x of [-0.46, 0.46]) b.add(new BoxGeometry(0.035, 0.035, 0.5), wire, { pos: [x, 0.03, -0.24], rot: [0.08, 0, 0] });
    // One lens is plain glass. In the other the moon has a twin, a little to the left, and the twin is the brighter.
    b.add(new CylinderGeometry(0.175, 0.175, 0.02, 10), C(PALETTE.seafoam), { pos: [-0.25, 0, 0], rot: FLAT }, { emissive: 0.1, jitter: 0.02 });
    b.add(new CylinderGeometry(0.175, 0.175, 0.02, 10), C(PALETTE.dreamViolet), { pos: [0.25, 0, 0], rot: FLAT }, { emissive: 0.9, jitter: 0 });
    b.add(new CylinderGeometry(0.035, 0.035, 0.03, 8), C(PALETTE.bone), { pos: [0.31, 0.04, 0] , rot: FLAT }, { emissive: 0.8, jitter: 0 });
    b.add(new CylinderGeometry(0.05, 0.05, 0.035, 8), C(PALETTE.wick), { pos: [0.19, 0.05, 0], rot: FLAT }, { emissive: 1.6, jitter: 0 });
  },
  'cork-float': (b) => {
    const cork = C(PALETTE.driftwood).lerp(C(PALETTE.bone), 0.45);
    b.add(new CylinderGeometry(0.25, 0.1, 0.24, 8), cork, { pos: [0, -0.2, 0] });
    b.add(new CylinderGeometry(0.25, 0.25, 0.17, 8), C(PALETTE.coral), { pos: [0, 0.005, 0] });
    b.add(new CylinderGeometry(0.1, 0.25, 0.24, 8), cork, { pos: [0, 0.21, 0] });
    b.add(new CylinderGeometry(0.026, 0.026, 0.98, 5), C(PALETTE.driftwood).multiplyScalar(0.7));
    // The two names, cut with a knife: the longer one, and under it the one somebody began to sand away.
    b.add(new BoxGeometry(0.2, 0.03, 0.02), C(INK), { pos: [0, 0.22, 0.185], rot: [-0.56, 0, 0] }, { jitter: 0 });
    b.add(new BoxGeometry(0.035, 0.03, 0.02), C(INK), { pos: [0, 0.15, 0.225], rot: [-0.56, 0, 0] }, { jitter: 0 });
    b.add(new TorusGeometry(0.085, 0.022, 4, 8), C(PALETTE.bone), { pos: [0, -0.56, 0] });
  },
  'tide-table': (b) => {
    const ink = C(PALETTE.slate);
    b.add(new BoxGeometry(0.66, 0.9, 0.02), C(PALETTE.heather), { pos: [0, 0, -0.035] });
    b.add(new BoxGeometry(0.62, 0.86, 0.06), C(PALETTE.bone));
    b.add(new BoxGeometry(0.09, 0.9, 0.085), C(PALETTE.duskViolet), { pos: [-0.3, 0, -0.01] });
    for (let i = 0; i < 7; i++) b.add(new BoxGeometry(i === 0 ? 0.3 : 0.42, 0.022, 0.012), ink, { pos: [i === 0 ? -0.02 : 0.04, 0.32 - i * 0.1, 0.034] }, { jitter: 0 });
    // One date is underlined twice.
    for (const y of [-0.115, -0.14]) b.add(new BoxGeometry(0.2, 0.012, 0.012), C(PALETTE.coral), { pos: [-0.07, y, 0.034] }, { jitter: 0 });
  },
  'packet-ticket': (b) => {
    b.add(new BoxGeometry(0.92, 0.46, 0.025), C(PALETTE.bone));
    b.add(new BoxGeometry(0.2, 0.46, 0.03), C(PALETTE.lantern), { pos: [-0.36, 0, 0] });
    for (let i = 0; i < 3; i++) b.add(new BoxGeometry(0.44 - i * 0.09, 0.036, 0.032), C(PALETTE.slate), { pos: [0.06 - i * 0.045, 0.11 - i * 0.1, 0] }, { jitter: 0 });
    // It has been punched.
    b.add(new CylinderGeometry(0.045, 0.045, 0.034, 8), C(INK), { pos: [0.37, -0.12, 0], rot: FLAT }, { jitter: 0 });
  },
  'return-half': (b) => {
    const card = C(PALETTE.bone);
    b.add(new BoxGeometry(0.5, 0.46, 0.025), card);
    b.add(new BoxGeometry(0.5, 0.1, 0.03), C(PALETTE.heather), { pos: [0, 0.16, 0] });
    for (let i = 0; i < 2; i++) b.add(new BoxGeometry(0.3 - i * 0.08, 0.036, 0.032), C(PALETTE.slate), { pos: [0.02 - i * 0.04, 0.01 - i * 0.1, 0] }, { jitter: 0 });
    // The edge it was torn along.
    for (let i = 0; i < 5; i++) b.add(new ConeGeometry(0.05, 0.07, 3), card, { pos: [-0.28, -0.19 + i * 0.095, 0], rot: [0, 0, Math.PI / 2], scale: [1, 1, 0.25] });
  },
  'fen-light-jar': (b, more) => {
    b.add(new CylinderGeometry(0.21, 0.21, 0.08, 9), C(PALETTE.wick), { pos: [0, 0.32, 0] });
    b.add(new TorusGeometry(0.2, 0.022, 4, 9), C(PALETTE.driftwood), { pos: [0, 0.26, 0], rot: FLAT });
    b.add(new CylinderGeometry(0.2, 0.2, 0.03, 9), C(PALETTE.slate), { pos: [0, -0.29, 0] });
    // It was empty when it came up.
    b.add(new IcosahedronGeometry(0.13, 0), C(PALETTE.wrongCyan), { pos: [0, -0.04, 0] }, { emissive: 1.7, jitter: 0 });
    b.add(new IcosahedronGeometry(0.05, 0), C(PALETTE.wick), { pos: [0.07, 0.09, 0.04] }, { emissive: 1.7, jitter: 0 });
    more.add(new Mesh(new CylinderGeometry(0.24, 0.22, 0.56, 9), new MeshStandardMaterial({ color: C(PALETTE.seafoam), transparent: true, opacity: 0.3, roughness: 0.15, flatShading: true, depthWrite: false })));
  },
  'isolde-log-sump': (b) => {
    const paper = C(PALETTE.bone), damp = C(PALETTE.bone).lerp(C(PALETTE.lagoon), 0.28);
    for (const side of [-1, 1]) {
      b.add(new BoxGeometry(0.34, 0.86, 0.02), (c) => (c.y < -0.2 - side * 0.08 ? damp : paper), { pos: [side * 0.17, 0, 0.02], rot: [0, -side * 0.18, 0] });
      for (let i = 0; i < 7; i++) b.add(new BoxGeometry(i === 6 && side > 0 ? 0.14 : 0.26, 0.018, 0.012), C(PALETTE.slate), { pos: [side * 0.17 - (i === 6 && side > 0 ? 0.06 : 0), 0.32 - i * 0.1, 0.034], rot: [0, -side * 0.18, 0] }, { jitter: 0 });
    }
    // Where the hook went through.
    b.add(new TorusGeometry(0.035, 0.013, 4, 6), C(INK), { pos: [0.25, 0.37, 0.022] }, { jitter: 0 });
  },
  'stopped-watch': (b) => {
    const brass = C(PALETTE.lantern).multiplyScalar(0.78);
    b.add(new CylinderGeometry(0.33, 0.33, 0.1, 14), brass, { rot: FLAT });
    b.add(new CylinderGeometry(0.28, 0.28, 0.11, 14), C(PALETTE.bone), { pos: [0, 0, 0.005], rot: FLAT }, { emissive: 0.25, jitter: 0.01 });
    for (let h = 0; h < 12; h += 3) { const a = (h / 12) * Math.PI * 2; b.add(new BoxGeometry(0.02, 0.05, 0.012), C(INK), { pos: [Math.sin(a) * 0.23, Math.cos(a) * 0.23, 0.062], rot: [0, 0, -a] }, { jitter: 0 }); }
    // Ten to four.
    const hand = (len: number, deg: number, w: number) => {
      const a = (deg * Math.PI) / 180;
      b.add(new BoxGeometry(w, len, 0.016), C(INK), { pos: [(Math.sin(a) * len) / 2, (Math.cos(a) * len) / 2, 0.068], rot: [0, 0, -a] }, { jitter: 0 });
    };
    hand(0.23, 300, 0.028); hand(0.15, 115, 0.04);
    b.add(new CylinderGeometry(0.03, 0.03, 0.03, 6), C(INK), { pos: [0, 0, 0.07], rot: FLAT }, { jitter: 0 });
    b.add(new CylinderGeometry(0.05, 0.05, 0.1, 6), brass, { pos: [0, 0.37, 0] });
    b.add(new TorusGeometry(0.075, 0.02, 4, 8), brass, { pos: [0, 0.47, 0] });
    // The tarred lanyard.
    b.add(new TorusGeometry(0.2, 0.024, 4, 9, Math.PI * 1.25), C(INK), { pos: [0.17, 0.6, 0], rot: [0, 0, -0.7] });
  },
};

// ---------------------------------------------------------------- the made thing

/** How big each is: on the line a find is a little larger than life, to read at casting distance; held, it fits two hands. */
const SIZE = { line: { crate: 1.3, chest: 1.3, relic: 1.05 }, held: { crate: 0.6, chest: 0.52, relic: 0.4 } };
/** A model facing +Z, turned to face out of the keeper's hands (the catch socket's own +Z is the keeper's left). */
const HELD_YAW = -Math.PI / 2;

/**
 * `id` is the find's own: `crate:<region>`, `chest:<region>`, or a relic's id. `how`: under the line, or held
 * up once it is aboard.
 */
export function makeFind(kind: FindKind, id: string, how: 'line' | 'held' = 'held'): FishObject {
  const obj = new Group(), turn = new Group(), inner = new Group();
  obj.add(turn); turn.add(inner);
  const held = how === 'held';
  const region = id.slice(id.indexOf(':') + 1);
  const glows: { value: number }[] = [];
  const paint = (make: (b: Builder, more: Group) => void, seed: number) => {
    const b = new Builder(seed, 0.05);
    make(b, inner);
    const mat = createPropMaterial();
    glows.push(mat.userData.uniforms.uGlow);
    const m = new Mesh(b.build(), mat);
    m.castShadow = true;
    inner.add(m);
  };
  let rise = 0;
  if (kind === 'relic') {
    const shape = held ? RELIC_SHAPES[id] : undefined;
    paint(shape ?? bundle, 31);
  } else {
    // What has lain in the Fen has gone green.
    const mossy = region === 'mossglass-fen';
    const key = kind === 'crate' ? 'crate' : held ? 'chestOpen' : 'chest';
    const model = assets.instance(key, mossy);
    if (model) {
      // (The library's wood is painted on, so a tint alone only darkens it: the green is laid over as well.)
      if (mossy) model.traverse((o) => {
        const m = o as Mesh; if (!m.isMesh) return;
        const mat = m.material as MeshStandardMaterial;
        mat.color.lerp(C(PALETTE.moss), 0.6); mat.emissive.copy(C(PALETTE.moss)); mat.emissiveIntensity = 0.15; mat.emissiveMap = null;
      });
      inner.add(model);
    } else {
      paint(kind === 'crate' ? crateStandIn : (b) => chestStandIn(b, held), kind === 'crate' ? 37 : 41);
      if (mossy) ((inner.children[0] as Mesh).material as MeshStandardMaterial).color.copy(C(PALETTE.moss).lerp(new Color(1, 1, 1), 0.35));
    }
    // Boxes stand on their own origin: lift the middle of them to where the hands (or the line) have hold.
    rise = kind === 'crate' ? -0.3 : -0.22;
  }
  const k = SIZE[how][kind];
  inner.scale.setScalar(k);
  inner.position.y = rise * k;
  if (held) turn.rotation.y = HELD_YAW;
  // A box is held low and tipped forward, to show what is in it and not hide the keeper's face.
  // (The chest's open lid stands up behind it: it sits lower still, and is tipped less.)
  if (held && kind === 'crate') { inner.rotation.x = 0.5; inner.position.y -= 0.1; }
  if (held && kind === 'chest') { inner.rotation.x = 0.28; inner.position.y -= 0.26; }
  const relicHeld = held && kind === 'relic';
  return {
    obj,
    animate(t) {
      // A relic is turned a little this way and that to be looked at, and what is lit in it comes and goes.
      if (relicHeld) { turn.rotation.y = HELD_YAW + Math.sin(t * 1.1) * 0.45; inner.rotation.x = -0.12 + Math.sin(t * 0.8) * 0.06; }
      const g = kind === 'relic' ? 0.42 + 0.2 * Math.sin(t * 2.3) : 0.25;
      for (const u of glows) u.value = g;
    },
    dispose() { obj.removeFromParent(); freeOwn(obj); },
  };
}
