/**
 * The things a region's data stands about (RegionContent.props): a hut, a box, a board. Each is the delivered
 * model when the library has one, else a TEMPORARY procedural stand-in of the same size and facing (front +Z,
 * origin on the ground under its middle) with the same named parts.
 */
import {
  BoxGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry, Vector3,
  type BufferGeometry,
} from 'three';
import { Builder } from './builder';
import { PALETTE } from './palette';
import { assets } from './assets';
import { buildNoticeBoard, createPropMaterial } from './props';

const C = (h: string) => new Color(h);

export interface PropBuild {
  object: Object3D;
  /** Stand-in materials: they take the dusk glow like every other procedural prop. */
  mats: MeshStandardMaterial[];
  /** `Glass` materials of a delivered model (lamps, lit windows): the game turns them up after dark. */
  glass: MeshStandardMaterial[];
  /** A pennant to stir in the wind, if it flies one, and a wind vane to turn. */
  pennant: Object3D | null;
  vane: Object3D | null;
  /** Where its lit lantern hangs, in its own frame, if it has one. */
  lamp: Vector3 | null;
}

interface Part { name?: string; geo: BufferGeometry; pos?: [number, number, number] }
interface Spec {
  /** The key of the delivered model in the library. */ asset: string;
  /** The stand-in: the body, then any parts that must be nodes of their own. */ standIn: () => Part[];
  lamp?: [number, number, number];
}

/** Mara's packet box: a lidded sea crate on short legs, a scale pan on the lid, her pennant on a pole. */
function packetBox(): Part[] {
  const b = new Builder(81, 0.05);
  const wood = C(PALETTE.driftwood), dark = C('#5E4634'), brass = C('#C9A24A'), iron = C('#3A3442');
  for (const x of [-0.38, 0.38]) for (const z of [-0.23, 0.23]) b.add(new BoxGeometry(0.08, 0.16, 0.08), dark, { pos: [x, 0.08, z] });
  b.add(new BoxGeometry(0.9, 0.5, 0.6), wood, { pos: [0, 0.41, 0] });
  b.add(new BoxGeometry(0.96, 0.1, 0.66), C('#9C7A58'), { pos: [0, 0.71, 0] });
  for (const x of [-0.3, 0.3]) b.add(new BoxGeometry(0.06, 0.62, 0.63), iron, { pos: [x, 0.45, 0] });
  // Her mark on the front: a cream panel with a fish.
  b.add(new BoxGeometry(0.34, 0.2, 0.012), C(PALETTE.bone), { pos: [0, 0.42, 0.305] });
  b.add(new SphereGeometry(0.06, 6, 4), C(PALETTE.coral), { pos: [-0.03, 0.42, 0.312], scale: [1.6, 0.7, 0.15] });
  b.add(new ConeGeometry(0.05, 0.08, 4), C(PALETTE.coral), { pos: [0.1, 0.42, 0.312], rot: [0, 0, Math.PI / 2], scale: [1, 1, 0.15] });
  b.add(new CylinderGeometry(0.02, 0.03, 0.14, 5), brass, { pos: [0.22, 0.83, 0] });
  b.add(new CylinderGeometry(0.16, 0.1, 0.04, 10), brass, { pos: [0.22, 0.91, 0] });
  b.add(new CylinderGeometry(0.025, 0.03, 1.8, 5), dark, { pos: [-0.52, 0.9, -0.3] });
  // The pennant, in the stripes of her stall: its own node, pivoted at the pole.
  const p = new Builder(82, 0.03);
  const n = 5, len = 0.6;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, h = 0.3 * (1 - t * 0.85);
    p.add(new BoxGeometry(len / n, h, 0.012), C(i % 2 ? PALETTE.bone : PALETTE.coral), { pos: [t * len, -0.15, 0] });
  }
  return [{ geo: b.build() }, { name: 'Pennant', geo: p.build(), pos: [-0.52, 1.78, -0.3] }];
}

/** Dr. Calloway's field hut: a plank hut on stilts with a reed thatch, a deck across the front and a ladder down. */
function stiltHut(): Part[] {
  const b = new Builder(83, 0.06);
  const plank = C(PALETTE.driftwood), dark = C('#6E5440'), thatch = C('#B9A262'), thatchD = C('#9C8A4E'), iron = C('#3A3442');
  for (const x of [-1.35, 1.35]) for (const z of [-1.35, 1.35]) b.add(new CylinderGeometry(0.09, 0.12, 2.9, 6), dark, { pos: [x, 0.85, z] });
  for (const x of [-1.5, 1.5]) b.add(new CylinderGeometry(0.07, 0.09, 2.8, 5), dark, { pos: [x, 0.85, 2.5] });
  b.add(new BoxGeometry(3.05, 0.07, 0.07), dark, { pos: [0, 1.15, -1.35], rot: [0, 0, 0.42] });
  b.add(new BoxGeometry(0.07, 0.07, 3.05), dark, { pos: [1.35, 1.15, 0], rot: [0.42, 0, 0] });
  // The floor runs out in front as the deck.
  b.add(new BoxGeometry(3.3, 0.14, 4.25), plank, { pos: [0, 2.2, 0.55] });
  b.add(new BoxGeometry(3.0, 2.0, 3.0), (c) => (Math.floor((c.y - 2.27) / 0.34) % 2 ? plank : C('#7C5E46')), { pos: [0, 3.27, 0] });
  b.add(new BoxGeometry(0.8, 1.6, 0.05), dark, { pos: [-0.55, 3.07, 1.51] });
  b.add(new BoxGeometry(0.7, 0.6, 0.05), C('#FFC98A'), { pos: [0.7, 3.5, 1.51] }, { emissive: 1.4, jitter: 0 });
  b.add(new BoxGeometry(0.78, 0.05, 0.07), dark, { pos: [0.7, 3.5, 1.52] });
  b.add(new BoxGeometry(0.05, 0.68, 0.07), dark, { pos: [0.7, 3.5, 1.52] });
  // Thatch: a low pyramid with a darker skirt at the eaves.
  b.add(new ConeGeometry(2.75, 1.7, 4), thatch, { pos: [0, 5.1, 0.1], rot: [0, Math.PI / 4, 0] });
  b.add(new ConeGeometry(2.98, 0.5, 4), thatchD, { pos: [0, 4.45, 0.1], rot: [0, Math.PI / 4, 0] });
  // A rail along the deck (open at the ladder), a rain gauge and a wind vane on it.
  for (const x of [-0.2, 0.7, 1.58]) b.add(new BoxGeometry(0.07, 0.9, 0.07), dark, { pos: [x, 2.72, 2.6] });
  b.add(new BoxGeometry(1.85, 0.06, 0.08), dark, { pos: [0.69, 3.15, 2.6] });
  b.add(new CylinderGeometry(0.06, 0.06, 0.3, 6), C('#9FB0B5'), { pos: [1.58, 3.33, 2.6] });
  b.add(new CylinderGeometry(0.015, 0.015, 0.7, 4), iron, { pos: [-0.2, 3.52, 2.6] });
  b.add(new BoxGeometry(0.36, 0.1, 0.015), C(PALETTE.coral), { pos: [-0.2, 3.86, 2.6], rot: [0, 0.6, 0] });
  // The ladder, leaning out from the deck's edge.
  for (const x of [-1.25, -0.75]) b.add(new BoxGeometry(0.06, 2.6, 0.06), dark, { pos: [x, 1.1, 2.95], rot: [-0.26, 0, 0] });
  for (let i = 0; i < 6; i++) b.add(new BoxGeometry(0.5, 0.05, 0.06), plank, { pos: [-1.0, 0.3 + i * 0.36, 3.16 - i * 0.096] });
  // The lantern by the door.
  b.add(new BoxGeometry(0.04, 0.04, 0.26), iron, { pos: [0.08, 4.02, 1.63] });
  b.add(new CylinderGeometry(0.09, 0.11, 0.22, 6), C(PALETTE.wick), { pos: [0.08, 3.86, 1.74] }, { emissive: 1.6, jitter: 0 });
  return [{ geo: b.build() }];
}

/** Her field table (a measuring board, a brass scale, jars, a notebook) and the theodolite on its tripod beside it. */
function fieldKit(): Part[] {
  const b = new Builder(85, 0.05);
  const wood = C('#A08062'), dark = C('#5E4634'), brass = C('#C9A24A');
  b.add(new BoxGeometry(1.2, 0.04, 0.6), wood, { pos: [0, 0.74, 0] });
  for (const x of [-0.5, 0.5]) for (const r of [0.62, -0.62]) b.add(new BoxGeometry(0.04, 0.92, 0.04), dark, { pos: [x, 0.37, 0], rot: [r, 0, 0] });
  b.add(new BoxGeometry(0.62, 0.025, 0.16), C(PALETTE.bone), { pos: [-0.2, 0.775, 0.12] });
  b.add(new BoxGeometry(0.03, 0.07, 0.16), dark, { pos: [-0.5, 0.8, 0.12] });
  b.add(new SphereGeometry(0.07, 6, 4), C('#7FAE8A'), { pos: [-0.22, 0.815, 0.12], scale: [2.6, 0.5, 0.8] });
  b.add(new CylinderGeometry(0.1, 0.12, 0.04, 8), brass, { pos: [0.36, 0.78, -0.1] });
  b.add(new CylinderGeometry(0.015, 0.015, 0.26, 5), brass, { pos: [0.36, 0.92, -0.1] });
  b.add(new BoxGeometry(0.34, 0.02, 0.02), brass, { pos: [0.36, 1.05, -0.1] });
  for (const x of [-0.15, 0.15]) b.add(new CylinderGeometry(0.07, 0.05, 0.02, 8), brass, { pos: [0.36 + x, 0.97, -0.1] });
  for (const [x, z, c] of [[0.1, 0.18, '#9FD8C8'], [0.22, 0.2, '#CFE7B0'], [0.02, -0.16, '#9FD8C8']] as const) b.add(new CylinderGeometry(0.045, 0.045, 0.13, 6), C(c), { pos: [x, 0.83, z] });
  b.add(new BoxGeometry(0.2, 0.025, 0.26), C('#6B4A3A'), { pos: [-0.36, 0.775, -0.14], rot: [0, 0.3, 0] });
  b.add(new BoxGeometry(0.17, 0.01, 0.22), C(PALETTE.bone), { pos: [-0.36, 0.79, -0.14], rot: [0, 0.3, 0] });
  const tx = 1.15, tz = 0.25, lean = 0.3;
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094 + 0.4;
    b.add(new CylinderGeometry(0.02, 0.025, 1.35, 4), dark, { pos: [tx + Math.sin(a) * 0.2, 0.63, tz + Math.cos(a) * 0.2], rot: [-lean * Math.cos(a), 0, lean * Math.sin(a)] });
  }
  b.add(new CylinderGeometry(0.07, 0.07, 0.05, 8), brass, { pos: [tx, 1.28, tz] });
  b.add(new BoxGeometry(0.05, 0.16, 0.12), brass, { pos: [tx, 1.38, tz] });
  b.add(new CylinderGeometry(0.03, 0.036, 0.3, 6), brass, { pos: [tx, 1.45, tz], rot: [Math.PI / 2 - 0.2, 0.5, 0] });
  return [{ geo: b.build() }];
}

/** The far stake of Calloway's line: a brass tag, a rag of red, and the tape pulled tight away into the reeds. */
function surveyStake(): Part[] {
  const b = new Builder(87, 0.05);
  b.add(new CylinderGeometry(0.035, 0.045, 1.5, 5), C('#A08062'), { pos: [0, 0.55, 0], rot: [0.04, 0, -0.05] });
  b.add(new BoxGeometry(0.1, 0.07, 0.012), C('#C9A24A'), { pos: [0.03, 1.0, 0.045] });
  b.add(new BoxGeometry(0.22, 0.14, 0.012), C(PALETTE.coral), { pos: [0.16, 1.2, 0] });
  b.add(new BoxGeometry(0.03, 0.004, 9), C(PALETTE.bone), { pos: [0.02, 0.69, 4.5], rot: [0.035, 0, 0] }, { jitter: 0 });
  return [{ geo: b.build() }];
}

/** Isolde's listening post: a plank platform on short piles, a great brass ear trumpet pointed down at the water, a stool, a dead lantern, a tin box. */
function listeningPost(): Part[] {
  const b = new Builder(89, 0.06);
  const plank = C('#8E8672'), dark = C('#5A5448'), brass = C('#C9A24A');
  for (const x of [-1.05, 1.05]) for (const z of [-1.05, 1.05]) b.add(new CylinderGeometry(0.1, 0.12, 1.3, 6), dark, { pos: [x, -0.1, z] });
  for (let i = 0; i < 8; i++) b.add(new BoxGeometry(0.29, 0.07, 2.4), plank, { pos: [-1.05 + i * 0.3, 0.5, 0], rot: [0, (b.random() - 0.5) * 0.03, 0] });
  // The trumpet: its narrow end where an ear goes, its bell out past the edge and tipped down toward the water.
  const tilt = 0.45, ax: [number, number, number] = [0, Math.sin(tilt), -Math.cos(tilt)];
  const mid: [number, number, number] = [0.2, 1.25, 0.95], bell: [number, number, number] = [mid[0] - ax[0] * 0.8, mid[1] - ax[1] * 0.8, mid[2] - ax[2] * 0.8];
  b.add(new CylinderGeometry(0.05, 0.07, 0.66, 6), dark, { pos: [0.2, 0.86, 0.72] });
  b.add(new BoxGeometry(0.5, 0.05, 0.05), dark, { pos: [0.2, 1.19, 0.72] });
  b.add(new CylinderGeometry(0.035, 0.45, 1.6, 12), brass, { pos: mid, rot: [-(Math.PI / 2 - tilt), 0, 0] });
  b.add(new TorusGeometry(0.45, 0.03, 5, 14), C('#E0BC62'), { pos: bell, rot: [tilt, 0, 0] });
  b.add(new CircleGeometry(0.42, 12), C('#2B2620'), { pos: [bell[0], bell[1] - ax[1] * 0.006, bell[2] - ax[2] * 0.006], rot: [tilt, 0, 0] }, { jitter: 0 });
  // The stool, and the lantern that went out.
  b.add(new CylinderGeometry(0.2, 0.2, 0.05, 8), plank, { pos: [0.2, 0.98, -0.3] });
  for (let i = 0; i < 3; i++) { const a = i * 2.094; b.add(new CylinderGeometry(0.025, 0.03, 0.46, 4), dark, { pos: [0.2 + Math.sin(a) * 0.13, 0.76, -0.3 + Math.cos(a) * 0.13] }); }
  b.add(new CylinderGeometry(0.08, 0.1, 0.2, 6), C('#59646A'), { pos: [-0.75, 0.66, -0.7] });
  b.add(new ConeGeometry(0.12, 0.1, 6), C('#3A3442'), { pos: [-0.75, 0.81, -0.7] });
  const box = new Builder(90, 0.04);
  box.add(new BoxGeometry(0.32, 0.16, 0.22), C('#9FB0B5'), { pos: [0, 0.08, 0] });
  box.add(new BoxGeometry(0.34, 0.03, 0.24), C('#6E7F86'), { pos: [0, 0.175, 0] });
  return [{ geo: b.build() }, { name: 'LogBox', geo: box.build(), pos: [-0.45, 0.535, 0.25] }];
}

const SPECS: Record<string, Spec> = {
  packetBox: { asset: 'packetBox', standIn: packetBox },
  noticeBoard: { asset: 'noticeBoard', standIn: () => [{ geo: buildNoticeBoard() }] },
  stiltHut: { asset: 'stiltHut', standIn: stiltHut, lamp: [0.12, 3.71, 2.05] },
  fieldKit: { asset: 'fieldKit', standIn: fieldKit },
  surveyStake: { asset: 'surveyStake', standIn: surveyStake },
  listeningPost: { asset: 'listeningPost', standIn: listeningPost },
};
export const PROP_MODELS = Object.keys(SPECS);

/** Builds a prop by the name its region's data gives it; null if there is no such thing. */
export function buildProp(model: string): PropBuild | null {
  const spec = SPECS[model];
  if (!spec) return null;
  const lamp = spec.lamp ? new Vector3(...spec.lamp) : null;
  const made = assets.instance(spec.asset);
  if (made) {
    // Lamps and lit windows get a material of their own, so this copy can be turned up and down.
    const glass = new Map<MeshStandardMaterial, MeshStandardMaterial>();
    made.traverse((o) => {
      const m = o as Mesh, mat = m.material as MeshStandardMaterial;
      if (!m.isMesh || mat.name !== 'Glass') return;
      if (!glass.has(mat)) glass.set(mat, mat.clone());
      m.material = glass.get(mat)!;
    });
    return { object: made, mats: [], glass: [...glass.values()], pennant: made.getObjectByName('Pennant') ?? null, vane: made.getObjectByName('Vane') ?? null, lamp };
  }
  const g = new Group(), mat = createPropMaterial();
  let pennant: Object3D | null = null;
  for (const part of spec.standIn()) {
    const m = new Mesh(part.geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    if (part.pos) m.position.set(...part.pos);
    if (part.name) { m.name = part.name; if (part.name === 'Pennant') pennant = m; }
    g.add(m);
  }
  return { object: g, mats: [mat], glass: [], pennant, vane: null, lamp };
}
