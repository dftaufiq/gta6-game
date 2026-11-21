// SOLENA BAY — combat: 4 weapons, shooting, muzzle flash, tracers, enemy AI.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { buildPersonMesh } from './player.js';
import { glowTexture } from './textures.js';

export class Combat {
  constructor(scene, G) {
    this.scene = scene;
    this.G = G;
    this.raycaster = new THREE.Raycaster();
    this.cooldown = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.enemies = [];
    this.tracers = [];
    this.flashLight = new THREE.PointLight(0xffcc66, 0, 18, 1.5);
    scene.add(this.flashLight);
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), transparent: true, opacity: 0, depthWrite: false,
    }));
    this.flashSprite.scale.setScalar(1.6);
    scene.add(this.flashSprite);
    this.flashT = 0;
  }

  get weapon() { return WEAPONS[this.G.player.weaponIdx]; }

  ammoFor(w) {
    if (w.id === 'fists') return { mag: Infinity, reserve: Infinity };
    return this.G.player.ammo[w.id];
  }

  reload() {
    const w = this.weapon;
    if (w.id === 'fists' || this.reloading) return;
    const a = this.ammoFor(w);
    if (a.mag >= w.mag || a.reserve <= 0) return;
    this.reloading = true; this.reloadT = 1.1;
    this.G.audio?.reload();
  }

  // All shootable meshes: enemies, peds, vehicles, buildings.
  shootables() {
    const G = this.G, out = [];
    for (const e of this.enemies) if (e.health > 0) out.push(e.mesh);
    for (const p of G.peds.list) if (p.state !== 'down') out.push(p.mesh);
    for (const v of G.vehicles.list) if (!v.dead) out.push(v.mesh);
    for (const b of G.city.buildingMeshes) out.push(b);
    return out;
  }

  shoot() {
    const G = this.G, w = this.weapon;
    if (this.cooldown > 0 || this.reloading || G.player.dead) return;
    if (w.id === 'fists') { this.melee(); return; }
    const a = this.ammoFor(w);
    if (a.mag <= 0) { this.reload(); return; }
    this.cooldown = 1 / w.rate;
    a.mag--;
    const pellets = w.pellets ?? 1;
    const origin = G.camera.position.clone();
    const dir = new THREE.Vector3();
    G.camera.getWorldDirection(dir);
    for (let i = 0; i < pellets; i++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * 0.03 * (w.pellets ? 3 : 1);
      d.y += (Math.random() - 0.5) * 0.03 * (w.pellets ? 3 : 1);
      d.normalize();
      this.fireRay(origin, d, w);
    }
    // muzzle flash at the player / car
    const src = G.player.vehicle ? G.player.vehicle.mesh.position : G.player.pos;
    this.flashLight.position.set(src.x, src.y + 1.6, src.z);
    this.flashLight.intensity = 40;
    this.flashSprite.position.copy(this.flashLight.position);
    this.flashSprite.material.opacity = 0.95;
    this.flashT = 0.06;
    G.audio?.gunshot(w.id);
    G.police?.addWanted(1, 'gunfire');
    G.peds.scare(src.x, src.z);
    if (a.mag === 0) this.reload();
  }

  fireRay(origin, dir, w) {
    const G = this.G;
    this.raycaster.set(origin, dir);
    this.raycaster.far = w.range;
    const hits = this.raycaster.intersectObjects(this.shootables(), true);
    let end = origin.clone().add(dir.clone().multiplyScalar(w.range));
    if (hits.length) {
      const h = hits[0];
      end = h.point;
      let obj = h.object;
      while (obj && !obj.userData.kind) obj = obj.parent;
      if (obj) {
        if (obj.userData.kind === 'enemy') this.damageEnemy(obj.userData.ref, w.dmg, G);
        else if (obj.userData.kind === 'ped') G.peds.hit(obj.userData.ref, G);
        else if (obj.userData.kind === 'vehicle') G.vehicles.damage(obj.userData.ref, w.dmg * 0.6, G);
      }
    }
    this.addTracer(origin, end);
  }

  addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, t: 0.07 });
  }

  melee() {
    const G = this.G, w = this.weapon;
    this.cooldown = 1 / w.rate;
    G.audio?.swing();
    const p = G.player.pos, yaw = G.player.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const e of this.enemies) {
      if (e.health <= 0) continue;
      const dx = e.mesh.position.x - p.x, dz = e.mesh.position.z - p.z;
      if (Math.hypot(dx, dz) < w.range && dx * fx + dz * fz > 0) this.damageEnemy(e, w.dmg, G);
    }
    for (const ped of G.peds.list) {
      if (ped.state === 'down') continue;
      const dx = ped.mesh.position.x - p.x, dz = ped.mesh.position.z - p.z;
      if (Math.hypot(dx, dz) < w.range && dx * fx + dz * fz > 0) G.peds.hit(ped, G);
    }
  }

  spawnEnemy(x, z, opts = {}) {
    const mesh = buildPersonMesh(0xef5350, 0x2b2f36, 0xc98a5a, 0x1a1a1a);
    mesh.position.set(x, 0, z);
    mesh.userData.kind = 'enemy';
    this.scene.add(mesh);
    const e = {
      mesh, health: opts.health ?? 60, yaw: 0, shootT: 1 + Math.random(),
      burst: 0, burstT: 0, state: 'advance', downT: 0,
    };
    mesh.userData.ref = e;
    this.enemies.push(e);
    return e;
  }

  damageEnemy(e, dmg, G) {
    if (e.health <= 0) return;
    e.health -= dmg;
    // knockback jolt (materials are shared, so no per-enemy flash)
    const p = G.player.pos, pos = e.mesh.position;
    const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz) || 1;
    pos.x += (dx / d) * 0.4; pos.z += (dz / d) * 0.4;
    if (e.health <= 0) {
      e.mesh.rotation.x = -Math.PI / 2;
      e.mesh.position.y = 0.4;
      e.downT = 0;
      G.missions?.onEnemyKilled?.(e);
      G.audio?.enemyDown?.();
    }
  }

  updateEnemies(dt, G) {
    const p = G.player.pos;
    for (const e of [...this.enemies]) {
      if (e.health <= 0) {
        e.downT += dt;
        if (e.downT > 6) { this.scene.remove(e.mesh); this.enemies.splice(this.enemies.indexOf(e), 1); }
        continue;
      }
      const pos = e.mesh.position;
      const dx = p.x - pos.x, dz = p.z - pos.z;
      const d = Math.hypot(dx, dz) || 1;
      e.yaw = Math.atan2(dx / d, dz / d);
      e.mesh.rotation.y = e.yaw;
      if (d > 20) { pos.x += (dx / d) * 5 * dt; pos.z += (dz / d) * 5 * dt; }
      else if (d < 8) { pos.x -= (dx / d) * 3 * dt; pos.z -= (dz / d) * 3 * dt; }
      // shoot bursts at the player
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 45) { e.burst = 3; e.burstT = 0; e.shootT = 1.4 + Math.random() * 0.9; }
      if (e.burst > 0) {
        e.burstT -= dt;
        if (e.burstT <= 0) {
          e.burst--; e.burstT = 0.14;
          const from = pos.clone().add(new THREE.Vector3(0, 1.5, 0));
          const to = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 1.2, (Math.random() - 0.5) * 2.2));
          this.addTracer(from, to);
          G.audio?.gunshot('pistol');
          // hit chance falls with distance
          if (Math.random() < Math.max(0.08, 0.3 - d * 0.01) && !G.player.dead) {
            G.player.damage(5, G);
            G.hud?.showDamageFlash();
          }
        }
      }
    }
  }

  update(dt, G) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.reloading = false;
        const w = this.weapon, a = this.ammoFor(w);
        const need = w.mag - a.mag, take = Math.min(need, a.reserve);
        a.mag += take; a.reserve -= take;
      }
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) { this.flashLight.intensity = 0; this.flashSprite.material.opacity = 0; }
    }
    for (const t of [...this.tracers]) {
      t.t -= dt;
      if (t.t <= 0) { this.scene.remove(t.line); this.tracers.splice(this.tracers.indexOf(t), 1); }
    }
    this.updateEnemies(dt, G);
    // auto-fire while mouse held (auto weapons) / click for semi
    const input = G.input;
    if (G.mode === 'play' && !G.player.vehicle) {
      const w = this.weapon;
      if (w.auto ? input.mouseDown : input.mouseClicked) this.shoot();
    } else if (G.mode === 'play' && G.player.vehicle && input.mouseClicked) {
      // drive-by: pistol only, from the car window
      if (this.weapon.id !== 'fists') this.shoot();
    }
    if (input.hit('KeyR')) this.reload();
    // weapon switching
    for (let i = 0; i < 4; i++) if (input.hit('Digit' + (i + 1))) G.player.weaponIdx = i;
    if (input.wheel !== 0) {
      G.player.weaponIdx = (G.player.weaponIdx + (input.wheel > 0 ? 1 : 3)) % 4;
    }
  }
}
