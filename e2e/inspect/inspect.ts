// Dev-only model inspector: /e2e/inspect/?model=characters/player.glb&clip=idle&t=0.5&bone=RightHand
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const r = new THREE.WebGLRenderer({ canvas, antialias: true }); r.setSize(1024, 768, false);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#2a2238');
scene.add(new THREE.HemisphereLight(0xffffff, 0x443355, 2)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(3, 5, 4); scene.add(d);
const cam = new THREE.PerspectiveCamera(35, 4 / 3, 0.01, 100);
const g = await new GLTFLoader().loadAsync('/' + (q.get('model') ?? 'models/characters/player.glb'));
scene.add(g.scene);
const out: any = { clips: g.animations.map((a) => [a.name, +a.duration.toFixed(2), a.tracks.length]) };
const bones: string[] = [];
g.scene.traverse((o) => { if ((o as any).isBone) bones.push(o.name + '<' + o.parent?.name); });
out.bones = bones;
const mixer = new THREE.AnimationMixer(g.scene);
const clip = g.animations.find((a) => a.name === q.get('clip'));
if (clip) { const a = mixer.clipAction(clip); a.play(); mixer.setTime(+(q.get('t') ?? 0)); }
g.scene.updateMatrixWorld(true);
const boneName = q.get('bone') ?? 'RightHand';
const b = g.scene.getObjectByName(boneName);
if (b) {
  const p = new THREE.Vector3(), qq = new THREE.Quaternion(), s = new THREE.Vector3();
  b.matrixWorld.decompose(p, qq, s);
  const ax = (v: THREE.Vector3) => v.applyQuaternion(qq).toArray().map((x) => +x.toFixed(2));
  out.bone = { name: boneName, pos: p.toArray().map((x) => +x.toFixed(3)), scale: s.toArray().map((x) => +x.toFixed(3)), X: ax(new THREE.Vector3(1, 0, 0)), Y: ax(new THREE.Vector3(0, 1, 0)), Z: ax(new THREE.Vector3(0, 0, 1)) };
  const h = new THREE.AxesHelper(0.25); b.add(h); h.scale.divide(s);
}
const box = new THREE.Box3().setFromObject(g.scene); out.box = [box.min.toArray(), box.max.toArray()].map((v) => v.map((x) => +x.toFixed(3)));
const c = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()).length();
const yaw = +(q.get('yaw') ?? 0.6);
cam.position.set(c.x + Math.sin(yaw) * size * 1.4, c.y + size * 0.3, c.z + Math.cos(yaw) * size * 1.4); cam.lookAt(c);
r.render(scene, cam);
(window as any).__INSPECT__ = out;
// Gait analysis: ground speed implied by an in-place clip (foot speed while planted).
const gait = q.get('gait');
if (gait) {
  const cl = g.animations.find((a) => a.name === gait)!;
  const m2 = new THREE.AnimationMixer(g.scene); m2.stopAllAction(); mixer.stopAllAction();
  const act = m2.clipAction(cl); act.play();
  const foot = g.scene.getObjectByName('LeftFoot')!;
  const samples: [number, number, number][] = [];
  const n = 240;
  for (let i = 0; i <= n; i++) { m2.setTime((cl.duration * i) / n); g.scene.updateMatrixWorld(true); const p = new THREE.Vector3().setFromMatrixPosition(foot.matrixWorld); samples.push([(cl.duration * i) / n, p.y, p.z]); }
  const minY = Math.min(...samples.map((s) => s[1]));
  const v: number[] = [];
  for (let i = 1; i < samples.length; i++) if (samples[i][1] < minY + 0.03) v.push((samples[i][2] - samples[i - 1][2]) / (samples[i][0] - samples[i - 1][0]));
  v.sort((a, b) => a - b);
  const zs = samples.map((s) => s[2]);
  out.gait = { clip: gait, duration: cl.duration, plantedSamples: v.length, medianPlantedVz: v[Math.floor(v.length / 2)], zRange: [Math.min(...zs), Math.max(...zs)], steps: 'see zRange' };
  (window as any).__INSPECT__ = out;
}
