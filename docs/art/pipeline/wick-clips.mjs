// Wick holding his sketchbook in both hands, palms on its side edges, cover toward whoever he faces.
// The body keeps the library motion; only the arms (and a glance down in the idle) are authored.
// BookSocket (child of LeftHand) is the book's centre; a model with a centre origin and its cover on +Z drops straight in.
export default (c) => {
  const { vec3 } = c.math;
  const V = (a) => vec3.fromValues(a[0], a[1], a[2]);
  const rot = (q, v) => Array.from(vec3.transformQuat(vec3.create(), V(v), q));
  const add = (a, b) => a.map((x, i) => x + b[i]);
  const mul = (a, s) => a.map((x) => x * s);
  const BOOK = { w: 0.24, h: 0.25, t: 0.055 };

  // Book pose in chest space (centre, pitch: negative leans the top back toward him) -> both hand targets.
  const hold = (pos, pitch, o = {}) => {
    const Rb = c.eulerQ([pitch, 0, 0]); const toW = (l) => add(pos, rot(Rb, l));
    const a = (o.fingers === undefined ? 15 : o.fingers) * Math.PI / 180;      // finger direction: 0 = straight out of the cover, 90 = up the edge
    const f = [0, Math.sin(a), Math.cos(a)]; const y0 = o.y === undefined ? 0.01 : o.y;
    const hand = (side) => {
      const s = side === 'Left' ? 1 : -1; const H = c.HAND[side];
      const contact = [s * BOOK.w / 2, y0, 0];
      const wrist = add(add(contact, mul(f, -0.07)), [s * (H.surf + 0.004), 0, 0]);
      return { pos: toW(wrist), fingers: rot(Rb, f), palm: rot(Rb, [-s, 0, 0]), pole: [s * 0.9, -0.4, -0.2] };
    };
    return { lHand: hand('Left'), rHand: hand('Right'), book: { pos, Rb } };
  };
  const LOW = { pos: [0.0, 0.655, 0.272], pitch: -30 };     // resting in front of the tummy, cover tipped up toward his face
  const SHOW = { pos: [0.0, 0.70, 0.285], pitch: -8 };       // lifted to show the drawing
  const mix = (A, B, k) => ({ pos: A.pos.map((v, i) => v + (B.pos[i] - v) * k), pitch: A.pitch + (B.pitch - A.pitch) * k });
  const sm = (k) => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };
  const dur = (clip) => c.existing.get(clip).duration;
  const strip = (h) => ({ lHand: h.lHand, rHand: h.rHand, lockShoulders: true });

  const idleD = dur('idle'), talkD = dur('talk'), lookD = dur('idle_look');
  const glance = (t) => sm((t / idleD - 0.30) / 0.12) * (1 - sm((t / idleD - 0.62) / 0.12));   // looks down at the page once per loop
  const idle = (t) => { const g = glance(t); return { base: { clip: 'idle', t }, ...strip(hold(add(LOW.pos, [0, 0.012 * g, 0]), LOW.pitch - 6 * g)), head: [14 * g, 0, 0] }; };
  const look = (t) => ({ base: { clip: 'idle_look', t }, ...strip(hold(LOW.pos, LOW.pitch)) });
  const talk = (t) => {
    const u = t / talkD; const lift = 0.85 + 0.15 * Math.cos(2 * Math.PI * u);                  // stays up, eases a little mid-way
    const bob = Math.sin(2 * Math.PI * 5 * u) * 0.010 + Math.sin(2 * Math.PI * 3 * u) * 0.006;   // excited little shakes, whole cycles so it loops
    const p = mix(LOW, SHOW, lift);
    return { base: { clip: 'talk', t }, ...strip(hold(add(p.pos, [0, bob, bob * 0.6]), p.pitch + Math.sin(2 * Math.PI * 2 * u) * 4)) };
  };
  const rest = hold(LOW.pos, LOW.pitch);
  return {
    rodSocket: false,
    clips: [
      { name: 'book_idle', duration: idleD, pose: idle },
      { name: 'book_idle_look', duration: lookD, pose: look },
      { name: 'book_talk', duration: talkD, pose: talk },
    ],
    sockets: [{ name: 'BookSocket', joint: 'LeftHand', spec: strip(rest), rot: rest.book.Rb, origin: () => V(rest.book.pos) }],
  };
};
