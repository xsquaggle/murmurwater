// fen-parts.mjs : pieces that more than one of the Mossglass Fen props is built from.
import { rotX, rotY, move, compose, rad } from './kit.mjs';

/** The atlas rectangles a caged lantern needs, for pack(): sizes in pixels for a lantern `px` pixels tall. */
export const lanternRects = (px, hue, { frame = 'brass', bars = 'iron', pre = 'lan' } = {}) => {
  const k = px / 256, s = (w, h) => [Math.max(8, Math.round(w * k)), Math.max(8, Math.round(h * k))];
  return {
    [pre + 'Base']: [...s(240, 48), { mat: frame, tile_x: true, edge: 0.5 }], [pre + 'Glass']: [...s(288, 150), { mat: 'glass', hue, panes: 6, soft: 0 }],
    [pre + 'Bar']: [...s(16, 150), { mat: bars, rust: 0.3 }], [pre + 'Band']: [...s(240, 12), { mat: bars, rust: 0.2, tile_x: true }],
    [pre + 'Roof']: [...s(240, 72), { mat: frame, tile_x: true, top: 0.5, edge: 0.6 }], [pre + 'Eave']: [...s(240, 20), { mat: frame, tile_x: true, light: 0.6 }],
    [pre + 'Ring']: [...s(96, 20), { mat: bars, rust: 0.2, tile_x: true }],
  };
};

/**
 * A six-sided caged lantern: a base, a glass, a bar up every corner with a band round the middle, a roof with eaves,
 * and on top either a ring to hang it by or a finial. `at` is the middle of the underside of its base, `h` its height
 * to the top of the ring or finial, `r` the radius of the glass. Geometry goes into the parts `frame` and `glass`
 * (the caller makes them, with whatever transform and material they need); R holds the rectangles of lanternRects().
 * Returns the heights a caller hangs or lights it by.
 */
export const cagedLantern = (frame, glass, R, { at = [0, 0, 0], h = 0.28, r = 0.048, sides = 6, ring = true, pre = 'lan', turn = 0 } = {}) => {
  const [x, y0, z] = at, put = compose(move([x, 0, z]), rotY(turn)); const P = (pts) => pts.map(([rr, y]) => [rr, y0 + y * h]);
  const on = (part, fn) => { const keep = part.xf; part.xf = compose(keep, put); fn(part); part.xf = keep; };
  const g0 = 0.12, g1 = 0.70, top = ring ? 0.90 : 0.86;
  on(frame, (f) => {
    f.lathe(P([[0, 0], [r * 1.15, 0], [r * 1.28, 0.035], [r * 1.28, 0.095], [r * 1.02, g0]]), sides, R[pre + 'Base']);
    for (let j = 0; j < sides; j++) { const a = 2 * Math.PI * j / sides, rb = r * 1.07, c = [rb * Math.cos(a), 0, -rb * Math.sin(a)]; f.tube([[c[0], y0 + g0 * h, c[2]], [c[0], y0 + g1 * h, c[2]]], r * 0.09, 3, R[pre + 'Bar'], { open: true, twist: -a + Math.PI }); }
    const ym = (g0 + g1) / 2; f.lathe(P([[r * 1.10, ym - 0.022], [r * 1.10, ym + 0.022]]), sides, R[pre + 'Band']);
    f.lathe(P([[r * 1.0, g1], [r * 1.58, g1]]), sides, R[pre + 'Eave']);
    f.lathe(P([[r * 1.58, g1], [r * 0.52, top - 0.04], [r * 0.30, top - 0.005], [0, top]]), sides, R[pre + 'Roof']);
    if (ring) f.torus(h * 0.058, h * 0.014, 6, 3, R[pre + 'Ring'], { xf: compose(move([0, y0 + (top + 0.045) * h, 0]), rotX(rad(90))) });
    else f.lathe(P([[r * 0.16, top - 0.01], [r * 0.24, top + 0.05], [0, 1.0]]), 4, R[pre + 'Ring']);
  });
  on(glass, (g) => g.lathe(P([[r, g0], [r, g1]]), sides, R[pre + 'Glass']));
  return { glassMid: y0 + (g0 + g1) / 2 * h, ringMid: y0 + (top + 0.045) * h, top: y0 + h };
};
