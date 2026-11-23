/**
 * TEMPORARY stand-ins for the things that stand about Saltbone Reach (docs/briefs/reach-assets.md, groups 2
 * and 3), each of the size and facing of the model asked for (front +Z, origin on the ground under its middle, or
 * at the waterline for what stands in the sea) and with the same named parts. Used until the models land.
 */
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry, TorusGeometry, type BufferGeometry, Vector3 } from 'three';
import { Builder } from './builder';

const C = (h: string) => new Color(h);
export interface Part { name?: string; geo: BufferGeometry; pos?: [number, number, number] }

/** Captain Oake's house: low dry-stone walls under an upturned whaleboat, tarred, keel up; the door in the +Z end. */
export function whaleboatHouse(): Part[] {
  const b = new Builder(151, 0.07);
  const stone = [C('#7D7C74'), C('#6A6A64'), C('#8E8B80')], tar = C('#2E2C2C'), tarL = C('#3E3A36'), wood = C('#6E5440');
  // Walls: courses of stones, a hand thick of shadow between them.
  for (let y = 0; y < 4; y++) for (const side of [-1, 1]) for (let z = -3.4; z < 3.5; z += 0.85) {
    b.add(new BoxGeometry(0.5, 0.36, 0.8), stone[(y + Math.round(z * 3)) % 3], { pos: [side * 1.25, 0.2 + y * 0.37, z + (y % 2) * 0.4 - 0.2], rot: [0, (b.random() - 0.5) * 0.08, 0] });
  }
  for (let y = 0; y < 4; y++) for (const end of [-1, 1]) for (let x = -1; x <= 1; x += 0.85) {
    if (end > 0 && Math.abs(x) < 0.5 && y < 4) continue;
    b.add(new BoxGeometry(0.8, 0.36, 0.5), stone[(y + Math.round(x * 3) + 1) % 3], { pos: [x, 0.2 + y * 0.37, end * 3.45] });
  }
  // The boat: a long half shell turned over the walls, clinker bands, the keel along the top.
  b.add(new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), (c) => (Math.floor((c.y - 1.45) / 0.28) % 2 ? tar : tarL), { pos: [0, 1.45, 0], scale: [1.72, 1.65, 3.85] });
  b.add(new BoxGeometry(0.16, 0.2, 7.4), wood, { pos: [0, 3.12, 0] });
  b.add(new BoxGeometry(0.12, 0.9, 0.16), wood, { pos: [0, 2.7, 3.72], rot: [-0.5, 0, 0] });
  // Door, and a small lit window beside it.
  b.add(new BoxGeometry(0.8, 1.45, 0.08), wood, { pos: [0, 0.73, 3.5] });
  b.add(new BoxGeometry(0.4, 0.34, 0.06), C('#FFC98A'), { pos: [-1.27, 1.05, 1.8], rot: [0, Math.PI / 2, 0] }, { emissive: 1.4, jitter: 0 });
  // The stove pipe through the hull, with its cowl.
  b.add(new CylinderGeometry(0.09, 0.09, 1.3, 6), C('#3A3442'), { pos: [0.7, 3.0, -1.6] });
  b.add(new ConeGeometry(0.2, 0.22, 6), C('#3A3442'), { pos: [0.7, 3.75, -1.6] });
  // A bench by the door; glass net floats on the wall.
  b.add(new BoxGeometry(1.2, 0.08, 0.36), C('#8C7058'), { pos: [1.0, 0.45, 3.85] });
  for (const x of [0.5, 1.5]) b.add(new BoxGeometry(0.08, 0.42, 0.3), C('#6E5440'), { pos: [x, 0.21, 3.85] });
  for (let i = 0; i < 5; i++) b.add(new SphereGeometry(0.13, 7, 5), C(i % 2 ? '#5FA08C' : '#7DBBA6'), { pos: [1.52, 0.9 + (i % 2) * 0.2, -1.6 + i * 0.55] });
  return [{ geo: b.build() }];
}

/** The cold tryworks: a squat brick furnace, two great iron pots in its top (one cracked and full of thrift), a rusted chimney, a skimmer. */
export function tryworks(): Part[] {
  const b = new Builder(152, 0.07);
  const brick = C('#8A5A46'), brickD = C('#6E4838'), iron = C('#3B3634'), rust = C('#7A4A30'), moss = C('#6A7A4E');
  b.add(new BoxGeometry(3, 1.3, 1.8), (c) => (Math.floor(c.y / 0.22) % 2 ? brick : brickD), { pos: [0, 0.65, 0] });
  b.add(new BoxGeometry(3.1, 0.16, 1.9), moss, { pos: [0, 1.38, 0] });
  for (const [x, cracked] of [[-0.7, false], [0.7, true]] as const) {
    b.add(new SphereGeometry(0.66, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), (c) => (c.y > 1.2 ? rust : iron), { pos: [x, 1.5, 0], scale: [1, 0.9, 1] });
    b.add(new TorusGeometry(0.64, 0.06, 5, 12), rust, { pos: [x, 1.5, 0], rot: [Math.PI / 2, 0, 0] });
    if (cracked) {
      b.add(new IcosahedronGeometry(0.5, 0), C('#55704A'), { pos: [x, 1.5, 0], scale: [1, 0.4, 1] });
      for (let i = 0; i < 6; i++) b.add(new SphereGeometry(0.06, 5, 4), C('#E59AB8'), { pos: [x + Math.cos(i) * 0.3, 1.72, Math.sin(i) * 0.3] });
      b.add(new BoxGeometry(0.04, 0.4, 0.05), C('#1E1C1C'), { pos: [x + 0.62, 1.2, 0.2], rot: [0, 0.4, 0.3] });
    } else b.add(new CylinderGeometry(0.6, 0.6, 0.02, 12), C('#2A3A3A'), { pos: [x, 1.42, 0] });
  }
  b.add(new CylinderGeometry(0.18, 0.22, 1.4, 7), rust, { pos: [1.25, 1.9, -0.65] });
  // The skimmer leaning on it.
  b.add(new CylinderGeometry(0.025, 0.025, 2.4, 5), C('#6E5440'), { pos: [-1.65, 1.1, 0.5], rot: [0, 0, 0.35] });
  b.add(new CylinderGeometry(0.2, 0.2, 0.03, 8), rust, { pos: [-2.05, 0.1, 0.5], rot: [0, 0, 0.35] });
  return [{ geo: b.build() }];
}

/** How far the storm mast's top cone is run up its halyard when a storm is near (from where it lies in the file). */
export const CONE_HOIST = 2.79;
/** Oake's weather mast: a spar with a yard, storm cones on halyards, a whale for a vane. `Cone` is the one that is hoisted. */
export function stormMast(): Part[] {
  const b = new Builder(153, 0.05);
  const spar = C('#7C6A56'), tar = C('#262628'), line = C('#B9A27C');
  b.add(new CylinderGeometry(0.07, 0.12, 6, 7), spar, { pos: [0, 3, 0] });
  b.add(new CylinderGeometry(0.04, 0.05, 2.4, 5), spar, { pos: [0, 5.0, 0], rot: [0, 0, Math.PI / 2] });
  for (const x of [-1.05, 1.05]) b.add(new CylinderGeometry(0.008, 0.008, 4.0, 3), line, { pos: [x, 3.0, 0] });
  // The two that are down, at the foot of their halyards.
  for (const x of [-1.05]) {
    b.add(new ConeGeometry(0.32, 0.6, 7), tar, { pos: [x, 1.3, 0] });
    b.add(new ConeGeometry(0.32, 0.6, 7), tar, { pos: [x, 0.66, 0], rot: [Math.PI, 0, 0] });
  }
  b.add(new BoxGeometry(0.5, 0.1, 0.5), C('#6E6A62'), { pos: [0, 0.05, 0] });
  // The vane: a whale, nose into the wind, on a pin at the masthead.
  const v = new Builder(154, 0.03);
  v.add(new SphereGeometry(0.22, 7, 5), tar, { pos: [0, 0, 0.1], scale: [0.5, 0.55, 1.6] });
  v.add(new ConeGeometry(0.14, 0.4, 4), tar, { pos: [0, 0.02, -0.45], rot: [-Math.PI / 2, 0, 0], scale: [0.4, 1, 1] });
  v.add(new BoxGeometry(0.03, 0.06, 0.42), tar, { pos: [0, 0.06, -0.68], rot: [0, 0, Math.PI / 2] });
  const cone = new Builder(155, 0.04);
  cone.add(new ConeGeometry(0.32, 0.6, 7), tar, { pos: [0, 0, 0] });
  return [{ geo: b.build() }, { name: 'Vane', geo: v.build(), pos: [0, 6.15, 0] }, { name: 'Cone', geo: cone.build(), pos: [1.05, 1.9, 0] }];
}

/** Six harpoons and two lances in a rack, points up, every head wrapped in sailcloth and tied. */
export function harpoonRack(): Part[] {
  const b = new Builder(156, 0.05);
  const wood = C('#6E5440'), shaft = C('#9C8466'), cloth = C('#D9CBA8'), twine = C('#7C6A56');
  for (const x of [-0.95, 0.95]) b.add(new BoxGeometry(0.1, 1.6, 0.1), wood, { pos: [x, 0.8, 0] });
  for (const y of [0.35, 1.45]) b.add(new BoxGeometry(2.0, 0.08, 0.12), wood, { pos: [0, y, 0] });
  for (let i = 0; i < 8; i++) {
    const x = -0.8 + i * 0.23, lance = i === 2 || i === 5, len = lance ? 2.3 : 2.1;
    b.add(new CylinderGeometry(0.022, 0.026, len, 5), shaft, { pos: [x, len / 2, 0.08], rot: [0.05, 0, (i % 2 ? 1 : -1) * 0.02] });
    b.add(new ConeGeometry(0.06, lance ? 0.34 : 0.26, 5), cloth, { pos: [x, len + 0.12, 0.09] });
    b.add(new CylinderGeometry(0.035, 0.035, 0.03, 5), twine, { pos: [x, len + 0.02, 0.09] });
  }
  return [{ geo: b.build() }];
}

/** Isolde's Tally Stone: a slate slab set upright in a cairn, cut with strokes in fives on its +Z face; a dead lantern; `LogBox`. */
export function tallyStone(): Part[] {
  const b = new Builder(157, 0.06);
  const slate = C('#4E5660'), cut = C('#8C949C'), cairn = [C('#6E6E68'), C('#5E605C'), C('#7E7A70')];
  b.add(new BoxGeometry(1.2, 2.1, 0.2), slate, { pos: [0, 1.25, 0], rot: [0.03, 0, 0.02] });
  // The strokes: in rows of fives, each four uprights and one across.
  for (let r = 0; r < 9; r++) for (let g = 0; g < 4; g++) {
    const x0 = -0.46 + g * 0.25, y = 0.55 + r * 0.19;
    for (let k = 0; k < 4; k++) b.add(new BoxGeometry(0.014, 0.13, 0.01), cut, { pos: [x0 + k * 0.04, y, 0.105] }, { jitter: 0 });
    b.add(new BoxGeometry(0.19, 0.014, 0.01), cut, { pos: [x0 + 0.06, y, 0.108], rot: [0, 0, 0.55] }, { jitter: 0 });
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, r = 0.55 + 0.4 * b.random();
    b.add(new IcosahedronGeometry(0.25 + 0.15 * b.random(), 0), cairn[i % 3], { pos: [Math.cos(a) * r, 0.15 + (i % 3) * 0.12, Math.sin(a) * r * 0.8] });
  }
  b.add(new CylinderGeometry(0.08, 0.1, 0.22, 6), C('#59646A'), { pos: [0.45, 0.4, 0.55] });
  b.add(new ConeGeometry(0.12, 0.1, 6), C('#3A3442'), { pos: [0.45, 0.56, 0.55] });
  const box = new Builder(158, 0.04);
  box.add(new BoxGeometry(0.32, 0.16, 0.22), C('#9FB0B5'), { pos: [0, 0.08, 0] });
  box.add(new BoxGeometry(0.34, 0.03, 0.24), C('#6E7F86'), { pos: [0, 0.175, 0] });
  return [{ geo: b.build() }, { name: 'LogBox', geo: box.build(), pos: [-0.55, 0.32, 0.35] }];
}

/**
 * The Jaw: the front half of a skull, far too big, lying on a reef, with its two lower jawbones reaching out
 * along the water to make the arms of a cove 9 m wide that opens toward +Z. Origin at the waterline in the middle
 * of the cove's mouth; it goes 2.5 m under.
 */
export function theJaw(): Part[] {
  const b = new Builder(159, 0.06);
  const bone = C('#E2D8C0'), boneD = C('#C8BCA0'), weed = C('#5E6E56'), dark = C('#1E1E22');
  const col = (c: Vector3) => (c.y < 0.35 ? weed : c.y < 1.2 ? boneD : bone);
  // The cranium: a great dome at the back, and the snout coming forward over the cove.
  b.add(Builder.wobble(new SphereGeometry(1, 14, 9), 0.05, 4), col, { pos: [0, 2.2, -19.5], scale: [8, 6.8, 6.6] });
  b.add(Builder.wobble(new SphereGeometry(1, 12, 7), 0.05, 5), col, { pos: [0, 3.4, -13.5], scale: [6.2, 3.4, 5] });
  // Eye sockets high on each side.
  for (const x of [-1, 1]) b.add(new SphereGeometry(1.5, 9, 7), dark, { pos: [x * 5.3, 6.0, -16.8], scale: [0.5, 1, 1] });
  // The upper teeth along the snout's edge, pegs pointing down into the cove.
  for (let i = 0; i < 9; i++) for (const x of [-1, 1]) b.add(new ConeGeometry(0.28, 1.1, 5), boneD, { pos: [x * (4.6 - i * 0.12), 1.0, -9.5 - i * 0.6], rot: [Math.PI, 0, 0] });
  // The jawbones: long tapered bones out along the water either side of the cove, teeth on top.
  for (const x of [-1, 1]) {
    for (let s = 0; s < 5; s++) {
      const z = -12 + s * 2.6, w = 2.1 - s * 0.22;
      b.add(new CylinderGeometry(w * 0.5, w * 0.55, 2.8, 8), col, { pos: [x * (5.6 + s * 0.05), 0.35 - s * 0.05, z], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.75] });
      b.add(new ConeGeometry(0.25, 0.9, 5), boneD, { pos: [x * 5.0, 1.15 - s * 0.05, z], rot: [0, 0, 0] });
    }
    // Down to the reef under the water.
    b.add(new CylinderGeometry(1.2, 1.5, 3, 7), weed, { pos: [x * 5.6, -1.2, -6], scale: [1, 1, 4] });
  }
  b.add(new CylinderGeometry(7, 8, 3, 10), weed, { pos: [0, -1.4, -18] });
  return [{ geo: b.build() }];
}

/** A brass plate let into bone, a ring bolt beside it, a frayed end of rope. Front (+Z) is the plate's face. */
export function ribMark(): Part[] {
  const b = new Builder(160, 0.03);
  b.add(new BoxGeometry(0.3, 0.2, 0.02), C('#D4AE52'), { pos: [0, 0, 0.01] }, { emissive: 0.15 });
  b.add(new BoxGeometry(0.18, 0.02, 0.005), C('#6E5A2A'), { pos: [0, 0.04, 0.022] });
  b.add(new TorusGeometry(0.06, 0.014, 4, 8), C('#5A4A3A'), { pos: [0.26, -0.02, 0.03] });
  b.add(new CylinderGeometry(0.014, 0.01, 0.4, 4), C('#B9A27C'), { pos: [0.29, -0.24, 0.04], rot: [0, 0, 0.15] });
  return [{ geo: b.build() }];
}

/**
 * The ground plan of the Jaw as circles a hull cannot pass and feet cannot cross, in its own frame: [x, z, r].
 * The skull (snout at z -7, its broken back open at z -27, 11.5 m across) and the two jawbones. The last two
 * metres under the back of the skull are left to walk into: a chest is jammed there.
 */
export const JAW_SOLID: [number, number, number][] = [
  [0, -18.5, 6.5], [0, -12.5, 6],
  ...[-1, 1].flatMap((x) => [0, 1, 2, 3, 4].map((s) => [x * 5.6, -12 + s * 2.6, 1.4] as [number, number, number])),
];
