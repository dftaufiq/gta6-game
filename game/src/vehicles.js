// SOLENA BAY — vehicles: factory, arcade drive physics, traffic AI, damage,
// garage upgrades (engine/armour), headlights at dusk, skid marks, and
// burning wrecks with fire + smoke.
import * as THREE from 'three';
import { CFG, VEHICLE_TYPES, CAR_COLORS, pick } from './config.js';
import { clampWorld, collideCircle } from './city.js';
import { boxPart, cylPart, mergeGeoms } from './merge.js';

// One shared vertex-colour material for every car body.
const CAR_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.35 });
// Shared police strobe materials (all units flash in sync, driven by time).
const STROBE_RED = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 });
const STROBE_BLUE = new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 2 });
const LIGHTBAR_GEO = new THREE.BoxGeometry(0.6, 0.24, 0.44);
const SKID_GEO = new THREE.PlaneGeometry(0.55, 1.5);
const SKID_MAT = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.5, depthWrite: false });
const FIRE_MAT = new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.9 });

export function buildCarMesh(type, color) {
  const g = new THREE.Group();
  const isVan = type === 'van' || type === 'swat';
  const isSuv = type === 'suv';
  const isPolice = type === 'police' || type === 'swat';
  const bodyH = isVan ? 1.5 : 0.85, bodyY = isVan ? 1.15 : 0.75;
  const glass = 0x1a2530, lampW = 0xfff2b0, lampR = 0xff2a2a, tyre = 0x151515;
  const parts = [boxPart(0, bodyY, 0, 2.0, bodyH, 4.4, color)];
  if (!isVan) parts.push(boxPart(0, bodyY + bodyH / 2 + 0.3, -0.2, 1.8, 0.7, 2.2, glass));
  parts.push(boxPart(0, bodyY + bodyH / 2 + 0.05, 1.15, 1.85, 0.06, 0.9, 0x2c4258));
  parts.push(boxPart(-0.7, 0.75, 2.22, 0.45, 0.22, 0.1, lampW));
  parts.push(boxPart(0.7, 0.75, 2.22, 0.45, 0.22, 0.1, lampW));
  parts.push(boxPart(-0.7, 0.75, -2.22, 0.45, 0.22, 0.1, lampR));
  parts.push(boxPart(0.7, 0.75, -2.22, 0.45, 0.22, 0.1, lampR));
  if (isPolice) parts.push(boxPart(0, bodyY + bodyH / 2 + 0.02, 0.4, 2.0, 0.12, 1.4, 0xffffff));
  if (type === 'taxi') parts.push(boxPart(0, bodyY + bodyH / 2 + 0.85, -0.2, 0.9, 0.3, 0.5, 0xf2c230));
  if (isSuv) parts.push(boxPart(0, bodyY + bodyH / 2 + 0.45, -0.3, 1.9, 0.5, 3.4, color));
  if (type === 'swat') parts.push(boxPart(0, bodyY + 0.1, 0, 2.05, 0.5, 4.45, 0x2a4a7a));
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    parts.push(cylPart(wx, 0.42, wz, 0.42, 0.35, tyre, 0, Math.PI / 2));
  }
  const body = new THREE.Mesh(mergeGeoms(parts), CAR_MAT);
  body.castShadow = true;
  g.add(body);
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
    bar.position.set(0, bodyY + bodyH / 2 + 0.75, -0.2);
    g.add(bar);
    const rl = new THREE.Mesh(LIGHTBAR_GEO, STROBE_RED);
    rl.position.set(-0.4, bodyY + bodyH / 2 + 0.78, -0.2);
    const bl = new THREE.Mesh(LIGHTBAR_GEO, STROBE_BLUE);
    bl.position.set(0.4, bodyY + bodyH / 2 + 0.78, -0.2);
    g.add(rl); g.add(bl);
  }
  return g;
}

// Drive the shared strobe materials from wall-clock time (all units in sync).
export function updateStrobes() {
  const on = Math.sin(performance.now() / 70) > 0;
  STROBE_RED.emissiveIntensity = on ? 3 : 0.2;
  STROBE_BLUE.emissiveIntensity = on ? 0.2 : 3;
}

export class Vehicles {
  constructor(scene, city, rng) {
    this.scene = scene; this.city = city; this.rng = rng;
    this.list = [];
    this.skids = []; // { mesh, t }
  }

  spawn(type, x, z, yaw, opts = {}) {
    const def = VEHICLE_TYPES[type];
    const color = opts.color ?? (type === 'police' || type === 'swat' ? 0x1c2733 : pick(this.rng, CAR_COLORS));
    const mesh = buildCarMesh(type, color);
    mesh.position.set(x, 0, z); mesh.rotation.y = yaw;
    this.scene.add(mesh);
    const v = {
      mesh, type, def, color, yaw, speed: 0, steer: 0,
      health: 100, maxHealth: 100, dead: false, isPlayer: false, isCop: !!opts.cop,
      isTraffic: !!opts.traffic, driver: opts.driver ?? null,
      owned: !!opts.owned, stolen: false, smoking: false,
      upgrades: { engine: 0, armour: 0 }, repainted: false,
      traffic: opts.traffic ? { axis: 'x', lane: z, dir: 1, wp: null } : null,
      name: opts.name ?? def.name,
      flashT: 0, skidding: false, skidAcc: 0, headlight: null, headTarget: null,
    };
    mesh.userData.kind = 'vehicle'; mesh.userData.ref = v;
    this.list.push(v);
    return v;
  }

  remove(v) {
    if (v.headlight) { v.mesh.remove(v.headlight); v.mesh.remove(v.headTarget); }
    this.scene.remove(v.mesh);
    this.list.splice(this.list.indexOf(v), 1);
  }

  // Garage repaint: rebuild the mesh in a new colour, keeping position,
  // heading, upgrades and the headlight.
  repaint(v, color) {
    const mesh = buildCarMesh(v.type, color);
    mesh.position.copy(v.mesh.position);
    mesh.rotation.y = v.yaw;
    mesh.userData.kind = 'vehicle'; mesh.userData.ref = v;
    if (v.headlight) {
      v.mesh.remove(v.headlight); v.mesh.remove(v.headTarget);
      mesh.add(v.headlight); mesh.add(v.headTarget);
    }
    this.scene.remove(v.mesh);
    this.scene.add(mesh);
    v.mesh = mesh;
    v.color = color;
  }

  // Headlights: one spotlight on the player's car, visible after dusk.
  setHeadlights(v, on) {
    if (on && !v.headlight) {
      const light = new THREE.SpotLight(0xffe9b0, 90, 45, 0.55, 0.6, 1.1);
      light.position.set(0, 1.1, 2.2);
      const target = new THREE.Object3D();
      target.position.set(0, 0, 18);
      v.mesh.add(light); v.mesh.add(target);
      light.target = target;
      v.headlight = light; v.headTarget = target;
    } else if (!on && v.headlight) {
      v.mesh.remove(v.headlight); v.mesh.remove(v.headTarget);
      v.headlight = null; v.headTarget = null;
    }
  }

  damage(v, amount, G) {
    if (v.dead) return;
    // armour plating shrugs off part of every hit
    amount *= 1 - 0.15 * (v.upgrades?.armour || 0);
    v.health -= amount;
    if (v.health <= v.maxHealth * 0.4 && !v.smoking) { v.smoking = true; this.addSmoke(v); }
    if (v.health <= 0) {
      v.dead = true; v.speed = 0;
      this.explode(v, G);
    }
  }

  addSmoke(v) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x333333, transparent: true, opacity: 0.6 }));
    s.position.set(0, 1.6, 1.6); v.mesh.add(s); v.smokeMesh = s;
  }

  explode(v, G) {
    // fireball flash + burning wreck with fire + smoke, then remove
    const flash = new THREE.PointLight(0xff7722, 60, 30, 1.5);
    flash.position.copy(v.mesh.position).add(new THREE.Vector3(0, 2, 0));
    this.scene.add(flash);
    v.mesh.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 }); });
    // fire cone + smoke column on top of the blackened wreck
    const fire = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.8, 8), FIRE_MAT);
    fire.position.set(0, 2.2, 0);
    v.mesh.add(fire);
    v.fireMesh = fire;
    if (!v.smokeMesh) this.addSmoke(v);
    if (v.smokeMesh) { v.smokeMesh.scale.setScalar(2.2); v.smokeMesh.position.y = 2.6; }
    G.audio?.explosion();
    setTimeout(() => this.scene.remove(flash), 700);
    v.explodeT = 0;
    if (v.isPlayer) { G.player.exitVehicle(G); G.player.damage(25, G); }
  }

  // Shared arcade physics: accelerate/brake/steer a vehicle along its heading.
  drive(v, dt, throttle, steerInput, handbrake, G) {
    const def = v.def;
    const tune = 1 + 0.12 * (v.upgrades?.engine || 0);
    const top = (v.topOverride ?? def.top) * tune;
    const accel = def.accel * tune;
    const maxReverse = 12;
    if (throttle > 0) v.speed += accel * throttle * dt;
    else if (throttle < 0) {
      if (v.speed > 0.5) v.speed -= 26 * dt; // brake
      else v.speed -= accel * 0.5 * dt; // reverse
    } else {
      v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 6 * dt);
    }
    if (handbrake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 22 * dt);
    v.speed = Math.max(-maxReverse, Math.min(top, v.speed));
    v.skidding = handbrake && Math.abs(v.speed) > 8;
    const spd = Math.abs(v.speed);
    const grip = handbrake ? 1.6 : 1;
    const turnRate = (2.4 * grip) / (1 + spd * 0.045);
    v.yaw += steerInput * turnRate * dt * Math.sign(v.speed || 1) * Math.min(1, spd / 4 + 0.25);
    this.move(v, dt, G);
  }

  dropSkid(v, dt) {
    v.skidAcc += dt;
    if (v.skidAcc < 0.14) return;
    v.skidAcc = 0;
    if (this.skids.length > 80) {
      const old = this.skids.shift();
      this.scene.remove(old.mesh);
    }
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    for (const side of [-0.95, 0.95]) {
      const m = new THREE.Mesh(SKID_GEO, SKID_MAT);
      const sx = Math.cos(v.yaw) * side, sz = -Math.sin(v.yaw) * side;
      m.position.set(v.mesh.position.x - fx * 1.4 + sx, 0.07, v.mesh.position.z - fz * 1.4 + sz);
      m.rotation.set(-Math.PI / 2, 0, -v.yaw);
      this.scene.add(m);
      this.skids.push({ mesh: m, t: 6 });
    }
  }

  move(v, dt, G) {
    if (v.speed === 0) return;
    if (v.skidding) this.dropSkid(v, dt);
    const nx = v.mesh.position.x + Math.sin(v.yaw) * v.speed * dt;
    const nz = v.mesh.position.z + Math.cos(v.yaw) * v.speed * dt;
    const before = { x: v.mesh.position.x, z: v.mesh.position.z };
    v.mesh.position.x = nx; v.mesh.position.z = nz;
    const hitWall = collideCircle(v.mesh.position, 2.1, G.city.colliders);
    clampWorld(v.mesh.position, 2);
    if (hitWall) {
      const impact = Math.abs(v.speed);
      if (impact > 6) {
        this.damage(v, (impact - 6) * 1.6, G);
        G.audio?.crash(impact);
        if (v.isCop) G.police?.addWanted(0); // no-op, cops hitting walls is fine
      }
      v.speed *= -0.22;
      v.mesh.position.x = before.x; v.mesh.position.z = before.z;
      collideCircle(v.mesh.position, 2.1, G.city.colliders);
    }
    // car-car collisions
    for (const o of this.list) {
      if (o === v || o.dead) continue;
      const dx = o.mesh.position.x - v.mesh.position.x, dz = o.mesh.position.z - v.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 4.2 && d > 0.01) {
        const push = (4.2 - d) / 2;
        const px = (dx / d) * push, pz = (dz / d) * push;
        // in shot mode the staged player car is unpushable (cops bounce off
        // instead of boxing it in) and keeps its speed through rams
        const anchored = G.shotMode && v.isPlayer;
        if (!anchored) { v.mesh.position.x -= px; v.mesh.position.z -= pz; }
        if (!o.isPlayer) { o.mesh.position.x += px * (anchored ? 2 : 1); o.mesh.position.z += pz * (anchored ? 2 : 1); }
        const rel = Math.abs(v.speed - o.speed);
        if (rel > 5) {
          this.damage(v, rel * 0.8, G); this.damage(o, rel * 0.8, G);
          G.audio?.crash(rel);
          if (o.isCop && v.isPlayer) G.police.addWanted(1, 'ramming a cop');
          if (v.isCop && o.isPlayer) G.police.addWanted(0);
        }
        if (!anchored) v.speed *= 0.55;
      }
    }
    v.mesh.rotation.y = v.yaw;
    if (v.smokeMesh) { v.smokeMesh.scale.setScalar(1 + Math.sin(performance.now() / 130) * 0.25); }
  }

  // Traffic AI: drive along roads via waypoints at intersections.
  updateTraffic(v, dt, G) {
    const t = v.traffic;
    const pos = v.mesh.position;
    if (!t.wp) t.wp = this.nextWaypoint(v, G);
    const dx = t.wp.x - pos.x, dz = t.wp.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) { t.wp = this.nextWaypoint(v, G); return; }
    // slow for a car ahead
    let target = 11;
    for (const o of this.list) {
      if (o === v || o.dead) continue;
      const ox = o.mesh.position.x - pos.x, oz = o.mesh.position.z - pos.z;
      const ahead = ox * Math.sin(v.yaw) + oz * Math.cos(v.yaw);
      const side = Math.abs(ox * Math.cos(v.yaw) - oz * Math.sin(v.yaw));
      if (ahead > 0 && ahead < 12 && side < 3) { target = 0; break; }
    }
    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - v.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dy * 2.2));
    const throttle = v.speed < target ? 0.7 : 0;
    this.drive(v, dt, throttle, steer, false, G);
  }

  nextWaypoint(v, G) {
    const lines = G.city.roadLines, half = G.city.half;
    const pos = v.mesh.position;
    // nearest road line on each axis
    const near = (a) => lines.reduce((b, l) => (Math.abs(l - a) < Math.abs(b - a) ? l : b), lines[0]);
    const cx = near(pos.x), cz = near(pos.z);
    const onX = Math.abs(pos.z - cz) < Math.abs(pos.x - cx); // travelling along x-road
    const r = this.rng();
    if (onX) {
      const dir = Math.sin(v.yaw) >= 0 ? 1 : -1;
      const nextX = cx + dir * CFG.PITCH * (1 + Math.floor(this.rng() * 2));
      if (Math.abs(nextX) > half || r < 0.3) {
        // turn onto the z road at the nearest intersection
        return { x: cx, z: cz + (this.rng() < 0.5 ? -1 : 1) * CFG.PITCH * (1 + Math.floor(this.rng() * 2)) };
      }
      return { x: nextX, z: cz };
    }
    const dir = Math.cos(v.yaw) >= 0 ? 1 : -1;
    const nextZ = cz + dir * CFG.PITCH * (1 + Math.floor(this.rng() * 2));
    if (Math.abs(nextZ) > half || r < 0.3) {
      return { x: cx + (this.rng() < 0.5 ? -1 : 1) * CFG.PITCH * (1 + Math.floor(this.rng() * 2)), z: cz };
    }
    return { x: cx, z: nextZ };
  }

  update(dt, G) {
    updateStrobes();
    // skid marks fade out after a few seconds
    for (const s of [...this.skids]) {
      s.t -= dt;
      if (s.t <= 0) { this.scene.remove(s.mesh); this.skids.splice(this.skids.indexOf(s), 1); }
    }
    for (const v of [...this.list]) {
      if (v.dead) {
        v.explodeT = (v.explodeT ?? 0) + dt;
        // burning wreck: flickering fire, rising smoke
        if (v.fireMesh) {
          const f = 1 + Math.sin(performance.now() / 60) * 0.25;
          v.fireMesh.scale.set(f, 1 + Math.sin(performance.now() / 90) * 0.3, f);
          if (v.explodeT > 3) { v.mesh.remove(v.fireMesh); v.fireMesh = null; }
        }
        if (v.smokeMesh && v.explodeT < 6) {
          v.smokeMesh.position.y += dt * 0.4;
          v.smokeMesh.scale.multiplyScalar(1 + dt * 0.15);
        }
        if (v.explodeT > 6 && !v.isPlayer) this.remove(v);
        continue;
      }
      // headlights switch on after dusk (18:00) and before dawn
      if (v.headlight) {
        const mins = G.timeMin % (24 * 60);
        v.headlight.visible = mins >= 18 * 60 || mins < 6 * 60;
      }
      if (v.isTraffic) this.updateTraffic(v, dt, G);
      else if (v.isCop) { /* police.js drives cops */ }
    }
  }
}
