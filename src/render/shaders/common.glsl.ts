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
uniform vec4 uMurk;
`;

/**
 * skyColor(dir, mirror): the sky in direction dir. mirror=1 when evaluated as a water
 * reflection: the uncanny second moon only exists there.
 */
export const SKY_FN_GLSL = /* glsl */ `
vec3 mw_clouds(vec3 d, vec3 col, float mirror) {
  if (d.y <= 0.01) return col;
  vec2 uv = d.xz / (d.y + 0.2) * 0.8 + vec2(uTime * 0.003, uTime * 0.0012);
  vec2 warp = vec2(mw_fbm(uv * 0.7 + 3.1), mw_fbm(uv * 0.7 - 7.7)) - 0.5;
  vec2 p = uv * 1.2 + warp * 0.9;
  float n = mw_fbm(p);
  float cover = mix(0.64, 0.4, uCloudCover);
  float m = smoothstep(cover, cover + 0.04, n);
  m *= smoothstep(0.015, 0.14, d.y);
  if (m <= 0.0) return col;
  // Fake self-shadowing: compare density toward the sun to get lit rims and shaded cores.
  vec2 sunH = normalize(uSunDir.xz + 1e-4);
  float n2 = mw_fbm(p + sunH * 0.07);
  float lightK = clamp((n - n2) * 9.0 + 0.5, 0.0, 1.0);
  float lit = smoothstep(0.42, 0.58, lightK);
  float low = 1.0 - smoothstep(-0.05, 0.45, uSunDir.y);
  vec3 core = mix(uZenith * 1.35 + vec3(0.07, 0.05, 0.09), vec3(0.92, 0.94, 1.0), 0.55 * (1.0 - low));
  vec3 rimC = mix(vec3(1.0, 0.98, 0.95), mix(uHorizon, uSunColor, 0.55) * 1.25, 0.25 + 0.75 * low);
  float edge = 1.0 - smoothstep(cover + 0.02, cover + 0.12, n);
  vec3 c = mix(core, rimC, max(lit * 0.85, edge * 0.55 * low));
  c = mix(c, c * vec3(0.5, 0.55, 0.85), uNight * 0.85);
  return mix(col, c, m * 0.96 * (1.0 - 0.45 * mirror));
}

vec3 skyColor(vec3 d, float mirror) {
  d = normalize(d);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.62, pow(h, 0.62)));
  if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.55, clamp(-d.y * 5.0, 0.0, 1.0));
  float sd = max(dot(d, uSunDir), 0.0);
  float day = 1.0 - uNight;
  col += uSunColor * 0.35 * pow(1.0 - h, 5.0) * pow(sd, 3.0) * day;
  col += uSunColor * (pow(sd, 12.0) * 0.25 + pow(sd, 120.0) * 0.6) * day;
  if (uNight > 0.01 && d.y > 0.0) {
    vec3 p = floor(d * 220.0);
    float s = mw_hash3(p);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 40.0);
    col += vec3(0.85, 0.9, 1.0) * step(0.9965, s) * tw * smoothstep(0.55, 0.95, uNight) * smoothstep(0.0, 0.25, d.y);
  }
  col = mw_clouds(d, col, mirror);
  float disc = smoothstep(0.9984, 0.99875, sd);
  col = mix(col, mix(uSunColor * 2.2, vec3(1.0, 0.95, 0.75) * 3.0, smoothstep(0.9988, 0.9998, sd)), disc * day);
  float md = dot(d, uMoonDir);
  float moon = smoothstep(0.99955, 0.9998, md);
  col = mix(col, vec3(0.95, 0.93, 0.85) * 2.2, moon * uNight);
  col += vec3(0.6, 0.7, 1.0) * pow(max(md, 0.0), 60.0) * 0.12 * uNight;
  // The Murmur Fog at the edge of a region: it closes in from the horizon up. The second moon shines through it.
  if (uMurk.a > 0.001) col = mix(col, uMurk.rgb, uMurk.a * (1.0 - 0.5 * smoothstep(0.05, 0.85, d.y)));
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
