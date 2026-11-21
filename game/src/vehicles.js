// SOLENA BAY — vehicles: factory, arcade drive physics, traffic AI, damage.
import * as THREE from 'three';
import { CFG, VEHICLE_TYPES, CAR_COLORS, pick } from './config.js';
import { clampWorld, collideCircle } from './city.js';

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.45, metalness: opts.metal ?? 0.35, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1 }));
  m.position.set(x, y, z); m.castShadow = true;
  return m;
}

export function buildCarMesh(type, color) {
  const g = new THREE.Group();
  const isVan = type === 'van', isSuv = type === 'suv', isPolice = type === 'police';
  const bodyH = isVan ? 1.5 : 0.85, bodyY = isVan ? 1.15 : 0.75;
  const body = box(2.0, bodyH, 4.4, color, 0, bodyY, 0); g.add(body);
  if (!isVan) {
    const cabin = box(1.8, 0.7, 2.2, 0x1a2530, 0, bodyY + bodyH / 2 + 0.3, -0.2, { rough: 0.15, metal: 0.6 });
    g.add(cabin);
  }
  // windshield + rear window sheen
  g.add(box(1.85, 0.06, 0.9, 0x2c4258, 0, bodyY + bodyH / 2 + 0.05, 1.15, { rough: 0.1, metal: 0.7 }));
  // headlights / taillights
  g.add(box(0.45, 0.22, 0.1, 0xfff2b0, -0.7, 0.75, 2.22, { emissive: 0xffe9a0, ei: 1.4 }));
  g.add(box(0.45, 0.22, 0.1, 0xfff2b0, 0.7, 0.75, 2.22, { emissive: 0xffe9a0, ei: 1.4 }));
  g.add(box(0.45, 0.22, 0.1, 0xff2a2a, -0.7, 0.75, -2.22, { emissive: 0xff2020, ei: 1.2 }));
  g.add(box(0.45, 0.22, 0.1, 0xff2a2a, 0.7, 0.75, -2.22, { emissive: 0xff2020, ei: 1.2 }));
  if (isPolice) {
    g.add(box(2.0, 0.12, 1.4, 0xffffff, 0, bodyY + bodyH / 2 + 0.02, 0.4, { rough: 0.4 }));
    const lightbar = box(1.5, 0.28, 0.5, 0x222222, 0, bodyY + bodyH / 2 + 0.75, -0.2);
    g.add(lightbar);
    const rl = box(0.6, 0.24, 0.44, 0xff2020, -0.4, bodyY + bodyH / 2 + 0.78, -0.2, { emissive: 0xff2020, ei: 2 });
    const bl = box(0.6, 0.24, 0.44, 0x2040ff, 0.4, bodyY + bodyH / 2 + 0.78, -0.2, { emissive: 0x2040ff, ei: 2 });
    g.add(rl); g.add(bl);
    g.userData.lightL = rl; g.userData.lightR = bl;
  }
  if (type === 'taxi') {
    g.add(box(0.9, 0.3, 0.5, 0xf2c230, 0, bodyY + bodyH / 2 + 0.85, -0.2, { emissive: 0xf2c230, ei: 0.8 }));
  }
  if (isSuv) g.add(box(1.9, 0.5, 3.4, color, 0, bodyY + bodyH / 2 + 0.45, -0.3));
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz);
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Vehicles {
  constructor(scene, city, rng) {
    this.scene = scene; this.city = city; this.rng = rng;
    this.list = [];
  }

  spawn(type, x, z, yaw, opts = {}) {
    const def = VEHICLE_TYPES[type];
    const color = opts.color ?? (type === 'police' ? 0x1c2733 : pick(this.rng, CAR_COLORS));
    const mesh = buildCarMesh(type, color);
    mesh.position.set(x, 0, z); mesh.rotation.y = yaw;
    this.scene.add(mesh);
    const v = {
      mesh, type, def, color, yaw, speed: 0, steer: 0,
      health: 100, dead: false, isPlayer: false, isCop: !!opts.cop,
      isTraffic: !!opts.traffic, driver: opts.driver ?? null,
      owned: !!opts.owned, stolen: false, smoking: false,
      traffic: opts.traffic ? { axis: 'x', lane: z, dir: 1, wp: null } : null,
      name: opts.name ?? def.name,
      flashT: 0,
    };
    mesh.userData.kind = 'vehicle'; mesh.userData.ref = v;
    this.list.push(v);
    return v;
  }

  remove(v) {
    this.scene.remove(v.mesh);
    this.list.splice(this.list.indexOf(v), 1);
  }

  damage(v, amount, G) {
    if (v.dead) return;
    v.health -= amount;
    if (v.health <= 40 && !v.smoking) { v.smoking = true; this.addSmoke(v); }
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
    // fireball flash + darkened wreck, then remove after a few seconds
    const flash = new THREE.PointLight(0xff7722, 60, 30, 1.5);
    flash.position.copy(v.mesh.position).add(new THREE.Vector3(0, 2, 0));
    this.scene.add(flash);
    v.mesh.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 }); });
    G.audio?.explosion();
    setTimeout(() => this.scene.remove(flash), 700);
    v.explodeT = 0;
    if (v.isPlayer) { G.player.exitVehicle(G); G.player.damage(25, G); }
  }

  // Shared arcade physics: accelerate/brake/steer a vehicle along its heading.
  drive(v, dt, throttle, steerInput, handbrake, G) {
    const def = v.def;
    const maxReverse = 12;
    if (throttle > 0) v.speed += def.accel * throttle * dt;
    else if (throttle < 0) {
      if (v.speed > 0.5) v.speed -= 26 * dt; // brake
      else v.speed -= def.accel * 0.5 * dt; // reverse
    } else {
      v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 6 * dt);
    }
    if (handbrake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 22 * dt);
    v.speed = Math.max(-maxReverse, Math.min(def.top, v.speed));
    const spd = Math.abs(v.speed);
    const grip = handbrake ? 1.6 : 1;
    const turnRate = (2.4 * grip) / (1 + spd * 0.045);
    v.yaw += steerInput * turnRate * dt * Math.sign(v.speed || 1) * Math.min(1, spd / 4 + 0.25);
    this.move(v, dt, G);
  }

  move(v, dt, G) {
    if (v.speed === 0) return;
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
        v.mesh.position.x -= px; v.mesh.position.z -= pz;
        if (!o.isPlayer) { o.mesh.position.x += px; o.mesh.position.z += pz; }
        const rel = Math.abs(v.speed - o.speed);
        if (rel > 5) {
          this.damage(v, rel * 0.8, G); this.damage(o, rel * 0.8, G);
          G.audio?.crash(rel);
          if (o.isCop && v.isPlayer) G.police.addWanted(1, 'ramming a cop');
          if (v.isCop && o.isPlayer) G.police.addWanted(0);
        }
        v.speed *= 0.55;
      }
    }
    v.mesh.rotation.y = v.yaw;
    // spin wheels
    const spin = (v.speed * dt) / 0.42;
    for (const w of v.mesh.userData.wheels) w.rotation.x += spin;
    if (v.smokeMesh) { v.smokeMesh.scale.setScalar(1 + Math.sin(performance.now() / 130) * 0.25); }
    // police lightbar strobe
    if (v.isCop) {
      v.flashT += dt;
      const on = Math.sin(v.flashT * 14) > 0;
      const u = v.mesh.userData;
      if (u.lightL) { u.lightL.material.emissiveIntensity = on ? 3 : 0.2; u.lightR.material.emissiveIntensity = on ? 0.2 : 3; }
    }
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
    for (const v of [...this.list]) {
      if (v.dead) {
        v.explodeT = (v.explodeT ?? 0) + dt;
        if (v.explodeT > 6 && !v.isPlayer) this.remove(v);
        continue;
      }
      if (v.isTraffic) this.updateTraffic(v, dt, G);
      else if (v.isCop) { /* police.js drives cops */ }
      else if (!v.isPlayer) {
        // parked car: nothing, but keep lightbar off
      }
      if (v.isCop) {
        v.flashT += dt;
        const on = Math.sin(v.flashT * 14) > 0;
        const u = v.mesh.userData;
        if (u.lightL) { u.lightL.material.emissiveIntensity = on ? 3 : 0.2; u.lightR.material.emissiveIntensity = on ? 0.2 : 3; }
      }
    }
  }
}
