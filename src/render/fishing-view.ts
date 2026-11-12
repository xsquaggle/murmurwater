/** Presents a FishingSession in 3D: bobber, line, the hooked fish, splashes and ripples. */
import { Color, Group, Mesh, MeshStandardMaterial, SphereGeometry, CylinderGeometry, Vector2, Vector3 } from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { FishingSession } from '../core/fishing';
import type { Fx } from './fx';
import { makeFish, type FishObject } from './fish-models';
import { PALETTE } from './palette';

const LINE_PTS = 24;

export class FishingView {
  readonly group = new Group();
  private bobber = new Group();
  private line: Line2;
  private lineGeo = new LineGeometry();
  private lineMat: LineMaterial;
  private linePos = new Float32Array(LINE_PTS * 3);
  private fishObj: FishObject | null = null;
  private fishId: string | null = null;
  private t = 0;
  private bobberY = 0; private bobberV = 0;
  private fishPos = new Vector3();
  private lateral = 0;
  private jump = -1;
  readonly target = new Vector3();
  readonly bobberPos = new Vector3();
  private castFrom = new Vector3();
  private castT = 0; private castDur = 1;
  private dir = new Vector3(0, 0, 1);
  private side = new Vector3(1, 0, 0);
  private wasPhase = 'idle';
  private wakeTimer = 0;

  constructor(private fx: Fx, private waveY: (x: number, z: number) => number) {
    const red = new MeshStandardMaterial({ color: new Color(PALETTE.coral), roughness: 0.4, flatShading: true });
    const white = new MeshStandardMaterial({ color: new Color(PALETTE.bone), roughness: 0.4, flatShading: true });
    const top = new Mesh(new SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), red);
    const bot = new Mesh(new SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white);
    const stick = new Mesh(new CylinderGeometry(0.012, 0.012, 0.22, 4), red); stick.position.y = 0.15;
    this.bobber.add(top, bot, stick);
    this.bobber.visible = false;
    this.group.add(this.bobber);
    this.lineGeo.setPositions(this.linePos);
    this.lineMat = new LineMaterial({ color: 0xf2ecdc, linewidth: 1.6, transparent: true, opacity: 0.85, worldUnits: false });
    this.line = new Line2(this.lineGeo, this.lineMat);
    this.line.frustumCulled = false;
    this.line.visible = false;
    this.group.add(this.line);
  }

  setResolution(w: number, h: number) { this.lineMat.resolution = new Vector2(w, h); }

  /** Called when a cast starts: from the rod tip toward the aim direction. */
  beginCast(tip: Vector3, origin: Vector3, yaw: number, distance: number, flight: number) {
    this.dir.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.side.set(this.dir.z, 0, -this.dir.x);
    this.target.copy(origin).addScaledVector(this.dir, distance);
    this.target.y = 0;
    this.castFrom.copy(tip);
    this.castT = 0; this.castDur = flight;
    this.bobber.visible = true;
  }

  update(dt: number, s: FishingSession, tip: Vector3, player: Vector3) {
    this.t += dt;
    const phase = s.phase;
    const wy = this.waveY(this.target.x, this.target.z);
    if (phase !== this.wasPhase) this.onPhase(this.wasPhase, phase, s);
    this.wasPhase = phase;

    let end = this.bobberPos;
    let sag = 0.06;
    let showLine = true;
    switch (phase) {
      case 'idle': case 'charging':
        this.bobber.visible = false; showLine = false; this.clearFish(); break;
      case 'casting': {
        this.castT = Math.min(1, this.castT + dt / this.castDur);
        const k = this.castT;
        end.lerpVectors(this.castFrom, this.target, k);
        end.y = this.castFrom.y * (1 - k) + wy * k + Math.sin(k * Math.PI) * (2 + this.castFrom.distanceTo(this.target) * 0.12);
        this.bobber.position.copy(end);
        sag = 0.02;
        break;
      }
      case 'waiting': case 'bite': {
        // Spring-damped bobbing on the waves; nibbles and bites kick it down.
        const k = 140, damp = 9;
        const restY = phase === 'bite' ? -0.32 + Math.sin(this.t * 30) * 0.05 : 0;
        this.bobberV += ((restY - this.bobberY) * k - this.bobberV * damp) * dt;
        this.bobberY += this.bobberV * dt;
        end.set(this.target.x + (phase === 'bite' ? Math.sin(this.t * 17) * 0.06 : 0), wy + this.bobberY, this.target.z);
        this.bobber.position.copy(end);
        this.bobber.rotation.z = Math.sin(this.t * 1.7) * 0.08 + this.bobberV * 0.02;
        sag = 0.1;
        break;
      }
      case 'fighting': {
        const fs = s.fight!;
        this.lateral += ((fs.run || 0) * 0.45 - this.lateral * 0.25) * dt * 2.2;
        this.lateral = Math.max(-1, Math.min(1, this.lateral));
        const d = Math.max(1, fs.distance);
        this.fishPos.copy(player).addScaledVector(this.dir, d).addScaledVector(this.side, this.lateral * Math.min(8, d * 0.4));
        let fy = this.waveY(this.fishPos.x, this.fishPos.z) - 0.35;
        if (fs.thrash > 0 && this.jump < 0) this.jump = 0;
        if (this.jump >= 0) {
          this.jump += dt / 0.75;
          fy += Math.sin(Math.min(1, this.jump) * Math.PI) * 1.6;
          if (this.jump >= 1) { this.jump = -1; this.splash(this.fishPos, 1.2); }
        }
        this.fishPos.y = fy;
        this.ensureFish(fs.fish.id);
        const fo = this.fishObj!.obj;
        this.fishObj!.animate(this.t, Math.min(1, 0.35 + (fs.run !== 0 ? 0.5 : 0) + (this.jump >= 0 ? 0.4 : 0)));
        fo.position.copy(this.fishPos);
        fo.lookAt(this.fishPos.x - this.dir.x - this.side.x * this.lateral, fy + (this.jump >= 0 ? Math.cos(this.jump * Math.PI) * 0.8 : 0), this.fishPos.z - this.dir.z - this.side.z * this.lateral);
        fo.rotation.z += Math.sin(this.t * 14) * 0.25;
        this.bobber.visible = false;
        end = this.fishPos;
        sag = 0.12 * (1 - fs.tension);
        this.wakeTimer -= dt;
        if (this.wakeTimer <= 0) {
          this.wakeTimer = fs.run !== 0 ? 0.08 : 0.22;
          const p = this.fishPos.clone(); p.y = this.waveY(p.x, p.z);
          this.fx.ripples.spawn(p, fs.run !== 0 ? 1.4 : 0.8, 0.9);
          this.fx.spray.burst(p, fs.run !== 0 ? 6 : 2, new Color(PALETTE.seafoam), 1.2, 1.6, 0.6, 0.12);
        }
        break;
      }
      case 'landed': case 'lost':
        this.bobber.visible = false; showLine = false;
        break;
    }
    this.line.visible = showLine;
    if (showLine) this.updateLine(tip, end, sag, phase === 'fighting' ? s.fight?.tension ?? 0 : 0);
  }

  private updateLine(a: Vector3, b: Vector3, sag: number, tension: number) {
    const len = a.distanceTo(b);
    const hum = tension > 0.75 ? (tension - 0.75) * 0.08 : 0;
    for (let i = 0; i < LINE_PTS; i++) {
      const t = i / (LINE_PTS - 1);
      const s = Math.sin(t * Math.PI);
      this.linePos[i * 3] = a.x + (b.x - a.x) * t;
      this.linePos[i * 3 + 1] = a.y + (b.y - a.y) * t - s * sag * len + Math.sin(this.t * 90 + t * 20) * hum * s;
      this.linePos[i * 3 + 2] = a.z + (b.z - a.z) * t;
    }
    this.lineGeo.setPositions(this.linePos);
    // Line warms toward amber, then coral, as tension climbs.
    const c = new Color(0xf2ecdc).lerp(new Color(PALETTE.lantern), Math.min(1, tension * 1.2)).lerp(new Color(PALETTE.coral), Math.max(0, (tension - 0.8) * 4));
    this.lineMat.color.copy(c);
  }

  private onPhase(_from: string, to: string, s: FishingSession) {
    if (to === 'waiting' && _from === 'casting') { this.splash(this.target, 0.6); this.bobberY = -0.25; this.bobberV = 0; }
    if (to === 'bite') { this.splash(this.target, 0.9); }
    if (to === 'landed') {
      const p = this.fishPos.clone(); this.splash(p, 1.0);
      this.clearFish();
    }
    if (to === 'lost') { this.clearFish(); }
    if (to === 'fighting') { this.lateral = 0; this.jump = -1; this.ensureFish(s.fight!.fish.id); }
  }

  nibble() { this.bobberV -= 2.2; this.fx.ripples.spawn(this.target, 0.7, 0.8); }

  splash(at: Vector3, size: number) {
    const p = at.clone(); p.y = this.waveY(p.x, p.z) + 0.05;
    this.fx.spray.burst(p, Math.round(18 * size), new Color(PALETTE.seafoam), 1.6 * size, 3.2 * size, 0.9, 0.16 * size);
    this.fx.ripples.spawn(p, 1.6 * size, 1.3);
    this.fx.ripples.spawn(p, 0.9 * size, 0.9);
  }

  private ensureFish(id: string) {
    if (this.fishId === id && this.fishObj) return;
    this.clearFish();
    this.fishObj = makeFish(id);
    this.fishObj.obj.scale.setScalar(1.6); // read clearly at casting distance
    this.fishId = id;
    this.group.add(this.fishObj.obj);
  }
  private clearFish() { if (this.fishObj) { this.fishObj.dispose(); this.fishObj = null; this.fishId = null; } }
}
