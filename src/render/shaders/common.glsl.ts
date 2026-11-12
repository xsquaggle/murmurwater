/** GLSL chunks shared by sky and water so reflections match the sky exactly. */
export const NOISE_GLSL = /* glsl */ `
float mw_hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float mw_hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float mw_vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mw_hash(i), mw_hash(i + vec2(1, 0)), u.x), mix(mw_hash(i + vec2(0, 1)), mw_hash(i + vec2(1, 1)), u.x), u.y);
}
float mw_fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * mw_vnoise(p); p = p * 2.03 + vec2(17.1, 3.7); a *= 0.5; }
  return s;
}
`;

export const SKY_UNIFORMS_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uNight;
uniform float uTime;
uniform float uCloudCover;
`;

/**
 * skyColor(dir, mirror): the sky in direction dir. mirror=1 when evaluated as a water
 * reflection: the uncanny second moon only exists there.
 */
export const SKY_FN_GLSL = /* glsl */ `
vec3 mw_clouds(vec3 d, vec3 col, float mirror) {
  if (d.y <= 0.01) return col;
  vec2 uv = d.xz / (d.y + 0.12) * 1.4 + vec2(uTime * 0.004, uTime * 0.0015);
  float n = mw_fbm(uv * 1.3);
  float cover = mix(0.62, 0.38, uCloudCover);
  float m = smoothstep(cover, cover + 0.12, n);
  m *= smoothstep(0.02, 0.22, d.y);
  if (m <= 0.0) return col;
  // Stylized two-band lighting: lit tops facing the sun, violet undersides.
  float sunFacing = clamp(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-4)) * 0.5 + 0.5, 0.0, 1.0);
  float band = smoothstep(0.62, 0.70, n + sunFacing * 0.08);
  vec3 shade = mix(uZenith * 0.9, vec3(0.231, 0.165, 0.31), 0.45 + 0.25 * uNight);
  vec3 lit = mix(uHorizon, uSunColor, 0.55) * (1.0 - 0.75 * uNight) + uZenith * 0.25;
  vec3 c = mix(shade, lit, band * (0.55 + 0.45 * sunFacing));
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunColor * pow(sd, 6.0) * 0.6 * (1.0 - band) * (1.0 - uNight);
  return mix(col, c, m * 0.92);
}

vec3 skyColor(vec3 d, float mirror) {
  d = normalize(d);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.5));
  if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.55, clamp(-d.y * 5.0, 0.0, 1.0));
  float sd = max(dot(d, uSunDir), 0.0);
  float day = 1.0 - uNight;
  col += uSunColor * 0.35 * pow(1.0 - h, 5.0) * pow(sd, 3.0) * day;
  col += uSunColor * (pow(sd, 12.0) * 0.25 + pow(sd, 120.0) * 0.6) * day;
  if (uNight > 0.01 && d.y > 0.0) {
    vec3 p = floor(d * 220.0);
    float s = mw_hash3(p);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 40.0);
    col += vec3(0.85, 0.9, 1.0) * step(0.9965, s) * tw * uNight * smoothstep(0.0, 0.25, d.y);
  }
  col = mw_clouds(d, col, mirror);
  col += uSunColor * smoothstep(0.99935, 0.99975, sd) * 6.0 * day;
  float md = dot(d, uMoonDir);
  float moon = smoothstep(0.99955, 0.9998, md);
  col = mix(col, vec3(0.95, 0.93, 0.85) * 2.2, moon * uNight);
  col += vec3(0.6, 0.7, 1.0) * pow(max(md, 0.0), 60.0) * 0.12 * uNight;
  // The second moon: only ever seen in reflections.
  if (mirror > 0.5) {
    vec3 m2 = normalize(uMoonDir + vec3(0.18, 0.05, -0.12));
    float md2 = dot(d, m2);
    float moon2 = smoothstep(0.99975, 0.9999, md2);
    col = mix(col, vec3(0.486, 1.0, 0.831) * 1.6, moon2 * max(uNight, 0.35));
    col += vec3(0.486, 1.0, 0.831) * pow(max(md2, 0.0), 300.0) * 0.25 * max(uNight, 0.35);
  }
  return col;
}
`;
