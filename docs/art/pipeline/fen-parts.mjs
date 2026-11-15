// fen-parts.mjs : pieces that more than one of the Mossglass Fen props is built from.
import { rotX, rotY, move, compose, rad, within } from './kit.mjs';

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

/** The atlas rectangles a round window needs: `px` is the width of the glass patch in pixels. */
export const windowRects = (px, hue = 'warm', { frame = 'pale', pre = 'win' } = {}) => ({
  [pre + 'Frame']: [Math.round(px * 2.4), Math.max(16, Math.round(px * 0.3)), { mat: 'wood', tone: frame, along: 'x', weather: 0.5, edge: 0.4 }],
  [pre + 'Glass']: [px, px, { mat: 'glass', hue, soft: 0 }],
});

/**
 * A round window standing proud of a wall: a frame ring of `sides` pieces with a cross of two glazing bars, and the glass.
 * `at` is its middle on the wall's face, `yaw` (degrees) the way the wall faces (0 = +Z, 90 = +X), `r` the radius of the
 * glass, `rim` the width of the frame, `proud` how far it stands out. Geometry goes into the parts `frame` and `glass`.
 */
export const roundWindow = (frame, glass, R, { at, yaw = 0, r = 0.34, rim = 0.09, proud = 0.05, sides = 8, pre = 'win' } = {}) => {
  const xf = compose(move(at), rotY(rad(yaw))), F = R[pre + 'Frame'], G = R[pre + 'Glass'], back = 0.012;
  const pt = (rr, k, z) => { const a = 2 * Math.PI * (k + 0.5) / sides; return [rr * Math.cos(a), rr * Math.sin(a), z]; };
  within(frame, xf, (f) => {
    for (let k = 0; k < sides; k++) {
      const u0 = k / sides, u1 = (k + 1) / sides, o = r + rim;
      f.quad([pt(r, k, proud), F.at(u0, 0.15)], [pt(o, k, proud), F.at(u0, 0.85)], [pt(o, k + 1, proud), F.at(u1, 0.85)], [pt(r, k + 1, proud), F.at(u1, 0.15)]);         // the face of the ring
      f.quad([pt(o, k, 0), F.at(u0, 1), 0.8], [pt(o, k + 1, 0), F.at(u1, 1), 0.8], [pt(o, k + 1, proud), F.at(u1, 0.85)], [pt(o, k, proud), F.at(u0, 0.85)]);       // its outer edge
      f.quad([pt(r, k, proud), F.at(u0, 0.15)], [pt(r, k + 1, proud), F.at(u1, 0.15)], [pt(r, k + 1, back), F.at(u1, 0), 0.7], [pt(r, k, back), F.at(u0, 0), 0.7]);     // the reveal down to the glass
    }
    const w = rim * 0.3, z = proud * 0.55, bar = F.sub(0, 0.3, 0.45, 0.7);
    f.face([-r, -w, z], [r, -w, z], [r, w, z], [-r, w, z], bar); f.face([w, -r, z], [w, r, z], [-w, r, z], [-w, -r, z], bar);
  });
  within(glass, xf, (g) => { const uv = (p) => G.at(0.5 + 0.5 * p[0] / r, 0.5 + 0.5 * p[1] / r);
    for (let k = 0; k < sides; k++) { const a = pt(r, k, back), b = pt(r, k + 1, back); g.tri([a, uv(a)], [b, uv(b)], [[0, 0, back], G.at(0.5, 0.5)]); } });
};
