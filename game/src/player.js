// SOLENA BAY — the player on foot: Kai Reyes. Movement, jumping, entering cars.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clampWorld, collideCircle } from './city.js';

function limb(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.position.set(x, y, z); m.castShadow = true;
  return m;
}

export function buildPersonMesh(shirt, pants, skin, hair) {
  const g = new THREE.Group();
  const torso = limb(0.85, 0.95, 0.45, shirt, 0, 1.25, 0); g.add(torso);
  const head = limb(0.5, 0.5, 0.5, skin, 0, 2.0, 0); g.add(head);
  const hairM = limb(0.54, 0.22, 0.54, hair, 0, 2.28, 0); g.add(hairM);
  const legL = limb(0.32, 0.8, 0.36, pants, -0.22, 0.4, 0); g.add(legL);
  const legR = limb(0.32, 0.8, 0.36, pants, 0.22, 0.4, 0); g.add(legR);
  const armL = limb(0.24, 0.8, 0.28, shirt, -0.56, 1.25, 0); g.add(armL);
  const armR = limb(0.24, 0.8, 0.28, shirt, 0.56, 1.25, 0); g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Player {
  constructor(scene, x, z) {
    this.mesh = buildPersonMesh(0xf2a541, 0x2b3a4a, 0xc98a5a, 0x2b1d12);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.yaw = Math.PI;
    this.velY = 0;
    this.grounded = true;
    this.speed = 0; // horizontal speed, for animation + HUD
    this.health = 100;
    this.armour = 0;
    this.money = 250;
    this.respect = 0;
    this.weaponIdx = 0;
    this.ammo = {
      pistol: { mag: 12, reserve: 48 },
      smg: { mag: 30, reserve: 120 },
      shotgun: { mag: 6, reserve: 24 },
    };
    this.vehicle = null;
    this.walkPhase = 0;
    this.dead = false;
  }

  get pos() { return this.mesh.position; }

  get speedKmh() {
    if (this.vehicle) return Math.abs(this.vehicle.speed) * 3.6;
    return this.speed * 3.6;
  }

  damage(amount, G) {
    if (this.dead) return;
    let rest = amount;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, rest * 0.6);
      this.armour -= absorbed; rest -= absorbed;
    }
    this.health -= rest;
    if (this.health <= 0) { this.health = 0; this.dead = true; G.onWasted?.(); }
  }

  heal(amount) { this.health = Math.min(100, this.health + amount); }

  update(dt, G) {
    if (this.dead) return;
    if (this.vehicle) {
      // hidden inside the car; position follows the vehicle
      this.mesh.visible = false;
      this.pos.copy(this.vehicle.mesh.position);
      this.speed = Math.abs(this.vehicle.speed);
      return;
    }
    this.mesh.visible = true;
    const input = G.input;
    const ax = input.axis();
    const camYaw = G.camRig.yaw;
    // camera forward on the ground plane
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = -fz, rz = fx;
    let mx = fx * ax.y + rx * ax.x, mz = fz * ax.y + rz * ax.x;
    const len = Math.hypot(mx, mz);
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const top = sprint ? CFG.SPRINT : CFG.WALK;
    if (len > 0.01) {
      mx /= len; mz /= len;
      this.yaw = Math.atan2(mx, mz);
      this.pos.x += mx * top * dt;
      this.pos.z += mz * top * dt;
      this.speed = top;
      this.walkPhase += dt * (sprint ? 13 : 9);
    } else {
      this.speed = 0;
    }
    // jump + gravity
    if (this.grounded && input.hit('Space')) { this.velY = CFG.JUMP; this.grounded = false; }
    if (!this.grounded) {
      this.velY -= CFG.GRAVITY * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.velY = 0; this.grounded = true; }
    }
    collideCircle(this.pos, 0.7, G.city.colliders);
    clampWorld(this.pos);
    this.mesh.rotation.y = this.yaw;
    // walk-cycle swing
    const s = this.speed > 0.1 ? Math.sin(this.walkPhase) * 0.55 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = s; u.legR.rotation.x = -s;
    u.armL.rotation.x = -s * 0.8; u.armR.rotation.x = s * 0.8;
  }

  // Nearest enterable vehicle within range, or null.
  nearestVehicle(G, range = 4.5) {
    let best = null, bd = range;
    for (const v of G.vehicles.list) {
      if (v.dead || v.isTraffic) continue;
      const d = v.mesh.position.distanceTo(this.pos);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  enterVehicle(v, G) {
    this.vehicle = v;
    v.isPlayer = true;
    v.driver = 'player';
    G.camRig.snapBehind(v.yaw);
    G.audio?.engineStart();
    if (v.stolen !== true && !v.owned) {
      v.stolen = true;
      G.police?.addWanted(1, 'car theft');
      G.hud?.showToast('Car stolen — the SPD is on its way');
    }
  }

  exitVehicle(G) {
    const v = this.vehicle;
    if (!v) return;
    this.vehicle = null;
    v.isPlayer = false;
    v.driver = null;
    v.speed = 0;
    // step out to the side of the car
    const sx = Math.cos(v.yaw), sz = -Math.sin(v.yaw);
    this.pos.set(v.mesh.position.x + sx * 2.6, 0, v.mesh.position.z + sz * 2.6);
    collideCircle(this.pos, 0.7, G.city.colliders);
    this.yaw = v.yaw;
    G.audio?.engineStop();
  }
}
