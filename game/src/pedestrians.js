// SOLENA BAY — pedestrians: sidewalk walkers who flee gunfire and traffic.
import * as THREE from 'three';
import { CFG, mulberry32, pick, range } from './config.js';
import { buildPersonMesh } from './player.js';
import { collideCircle } from './city.js';

const SHIRTS = [0xe05a8a, 0x4fc3f7, 0x8bc34a, 0xf2c230, 0xba68c8, 0xef5350, 0xe8e4da, 0x2b2f36];
const PANTS = [0x2b3a4a, 0x4a3a2b, 0x333333, 0x5a6a7a];
const SKINS = [0xc98a5a, 0x8a5a3b, 0xe8b88a, 0xd9a077, 0x6b4423];
const HAIRS = [0x1a1a1a, 0x7a4a21, 0xe8e4da, 0xc93a2e, 0x3a2a1a];

export class Pedestrians {
  constructor(scene, city, rng) {
    this.scene = scene; this.city = city; this.rng = rng;
    this.list = [];
    this.scarePos = null; this.scareT = 0;
  }

  spawn(x, z) {
    const mesh = buildPersonMesh(pick(this.rng, SHIRTS), pick(this.rng, PANTS), pick(this.rng, SKINS), pick(this.rng, HAIRS));
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const p = {
      mesh, yaw: this.rng() * Math.PI * 2, speed: range(this.rng, 1.1, 1.9),
      state: 'walk', target: this.randomSidewalkPoint(), phase: this.rng() * 6,
      downT: 0, fleeT: 0,
    };
    mesh.userData.kind = 'ped'; mesh.userData.ref = p;
    this.list.push(p);
    return p;
  }

  randomSidewalkPoint() {
    const lines = this.city.roadLines, half = this.city.half;
    // a point on a sidewalk edge: just off a road line, near a block
    const r = pick(this.rng, lines);
    const along = range(this.rng, -half, half);
    const off = CFG.ROAD / 2 + 3.5;
    return this.rng() < 0.5 ? { x: r + off, z: along } : { x: along, z: r + off };
  }

  populate(n) {
    for (let i = 0; i < n; i++) {
      const p = this.randomSidewalkPoint();
      this.spawn(p.x, p.z);
    }
  }

  scare(x, z) { this.scarePos = { x, z }; this.scareT = 4; }

  hit(p, G) {
    if (p.state === 'down') return;
    p.state = 'down'; p.downT = 0;
    p.mesh.rotation.x = -Math.PI / 2;
    p.mesh.position.y = 0.4;
    G.police?.addWanted(1, 'hitting a pedestrian');
    G.hud?.showToast('Pedestrian down — witnesses called the SPD');
  }

  update(dt, G) {
    if (this.scareT > 0) this.scareT -= dt;
    for (const p of [...this.list]) {
      const pos = p.mesh.position;
      if (p.state === 'down') {
        p.downT += dt;
        if (p.downT > 5) {
          this.scene.remove(p.mesh);
          this.list.splice(this.list.indexOf(p), 1);
          const np = this.randomSidewalkPoint();
          this.spawn(np.x, np.z);
        }
        continue;
      }
      // flee from the scare point
      if (this.scareT > 0 && this.scarePos) {
        const dx = pos.x - this.scarePos.x, dz = pos.z - this.scarePos.z;
        if (Math.hypot(dx, dz) < 32) { p.state = 'flee'; p.fleeT = 2.5; }
      }
      if (p.state === 'flee') {
        p.fleeT -= dt;
        const dx = pos.x - (this.scarePos?.x ?? pos.x), dz = pos.z - (this.scarePos?.z ?? pos.z);
        const d = Math.hypot(dx, dz) || 1;
        p.yaw = Math.atan2(dx / d, dz / d);
        pos.x += (dx / d) * 6.5 * dt; pos.z += (dz / d) * 6.5 * dt;
        if (p.fleeT <= 0) { p.state = 'walk'; p.target = this.randomSidewalkPoint(); }
      } else {
        const dx = p.target.x - pos.x, dz = p.target.z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 2) { p.target = this.randomSidewalkPoint(); }
        else {
          p.yaw = Math.atan2(dx / d, dz / d);
          pos.x += (dx / d) * p.speed * dt; pos.z += (dz / d) * p.speed * dt;
        }
      }
      collideCircle(pos, 0.6, G.city.colliders);
      p.mesh.rotation.y = p.yaw;
      p.phase += dt * (p.state === 'flee' ? 13 : 8);
      const s = Math.sin(p.phase) * 0.5;
      const u = p.mesh.userData;
      u.legL.rotation.x = s; u.legR.rotation.x = -s;
      u.armL.rotation.x = -s * 0.7; u.armR.rotation.x = s * 0.7;
      // hit by a moving car?
      for (const v of G.vehicles.list) {
        if (v.dead || Math.abs(v.speed) < 4) continue;
        if (v.mesh.position.distanceTo(pos) < 2.4) {
          this.hit(p, G);
          if (v.isPlayer) G.audio?.thud?.();
          break;
        }
      }
    }
  }
}
