// SOLENA BAY — the Solena PD: wanted stars, pursuit AI, roadblocks with
// spike strips, the CONDOR-1 helicopter, the SWAT van at 5 stars, and
// dispatch radio chatter for the response panel.
import * as THREE from 'three';
import { CFG, mulberry32 } from './config.js';

const UNIT_NAMES = ['SPD-12', 'SPD-07', 'RAM-03', 'RAM-09', 'TAC-45', 'TAC-21', 'CRU-18', 'CRU-33'];
const HELI_NAME = 'CONDOR-1';
const SWAT_NAME = 'SWAT-1';

const CHATTER = [
  'CONDOR-1: Visual on the target — still moving fast',
  'RAM-03: Requesting spike strips on the Strip',
  'DISPATCH: All units, suspect is armed — approach with caution',
  'TAC-45: Roadblock set — he is coming right at us',
  'SPD-12: He is heading for the pier, cut him off!',
  'CONDOR-1: Spotlight on the target, all units converge',
  'DISPATCH: Air support has the eye — ground units close in',
  'RAM-09: He rammed me! Requesting backup on Meridian Row',
  'SWAT-1: Rolling — five stars, full tactical response',
  'DISPATCH: Suspect vehicle is a Pelo GT, last seen downtown',
];

export class Police {
  constructor(scene, G) {
    this.scene = scene;
    this.G = G;
    this.wanted = 0;
    this.cops = []; // vehicle refs
    this.roadblocks = []; // vehicle refs parked across roads
    this.strips = []; // spike strips: { mesh, x, z, used }
    this.swat = null; // SWAT van vehicle ref (5 stars)
    this.heli = null;
    this.heliAngle = 0;
    this.decayT = 0;
    this.bustedT = 0;
    this.spawnT = 0;
    this.roadblockT = 0;
    this.inSight = false;
    this.lastCrimeT = -99;
    this.chatter = '';
    this.chatterT = 0;
    this.chatterIdx = 0;
    this.rng = mulberry32(4242);
  }

  addWanted(n, reason) {
    if (n <= 0) return;
    const now = performance.now() / 1000;
    if (reason === 'gunfire' && now - this.lastCrimeT < 5) return;
    this.lastCrimeT = now;
    const before = this.wanted;
    this.wanted = Math.max(0, Math.min(5, this.wanted + n));
    if (this.wanted > before) {
      this.G.hud?.flashWanted(this.wanted);
      this.G.audio?.sirenBlip?.();
      if (this.wanted === 5) this.G.hud?.showToast('5 STARS — SWAT is rolling, CONDOR-1 is overhead');
    }
    if (this.wanted > 0) this.decayT = 0;
  }

  clearWanted() {
    this.wanted = 0; this.decayT = 0;
    for (const c of this.cops) this.G.vehicles.remove(c);
    this.cops = [];
    this.clearRoadblocks();
    this.removeSwat();
    this.removeHeli();
    this.chatter = '';
  }

  clearRoadblocks() {
    for (const r of this.roadblocks) this.G.vehicles.remove(r);
    this.roadblocks = [];
    for (const s of this.strips) this.scene.remove(s.mesh);
    this.strips = [];
  }

  spawnCop() {
    const G = this.G, p = G.player.pos;
    // spawn on a road 70-100 units from the player
    const lines = G.city.roadLines;
    for (let tries = 0; tries < 12; tries++) {
      const a = this.rng() * Math.PI * 2;
      const d = 70 + this.rng() * 30;
      let x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      // snap to nearest road
      const near = (v) => lines.reduce((b, l) => (Math.abs(l - v) < Math.abs(b - v) ? l : b), lines[0]);
      if (this.rng() < 0.5) x = near(x); else z = near(z);
      if (Math.abs(x) > G.city.half + 20 || Math.abs(z) > G.city.half + 20) continue;
      const cop = G.vehicles.spawn('police', x, z, Math.atan2(p.x - x, p.z - z), { cop: true });
      cop.unitName = UNIT_NAMES[this.cops.length % UNIT_NAMES.length];
      cop.state = 'chase';
      this.cops.push(cop);
      return cop;
    }
    return null;
  }

  // The SWAT van: slow, heavy, 300 HP — it rams like a truck.
  spawnSwat() {
    const G = this.G, p = G.player.pos;
    const lines = G.city.roadLines;
    const a = this.rng() * Math.PI * 2;
    let x = p.x + Math.cos(a) * 85, z = p.z + Math.sin(a) * 85;
    const near = (v) => lines.reduce((b, l) => (Math.abs(l - v) < Math.abs(b - v) ? l : b), lines[0]);
    if (this.rng() < 0.5) x = near(x); else z = near(z);
    const van = G.vehicles.spawn('swat', x, z, Math.atan2(p.x - x, p.z - z), { cop: true });
    van.unitName = SWAT_NAME;
    van.state = 'chase';
    van.maxHealth = 300; van.health = 300;
    this.swat = van;
    return van;
  }

  removeSwat() {
    if (!this.swat) return;
    this.G.vehicles.remove(this.swat);
    this.swat = null;
  }

  spawnRoadblock() {
    const G = this.G, p = G.player.pos;
    const heading = G.player.vehicle ? G.player.vehicle.yaw : G.player.yaw;
    const ahead = 46;
    const bx = p.x + Math.sin(heading) * ahead, bz = p.z + Math.cos(heading) * ahead;
    // snap to nearest road line so the block sits on a road
    const lines = G.city.roadLines;
    const near = (v) => lines.reduce((b, l) => (Math.abs(l - v) < Math.abs(b - v) ? l : b), lines[0]);
    const rx = Math.abs(bx - near(bx)) < Math.abs(bz - near(bz)) ? near(bx) : bx;
    const rz = Math.abs(bx - near(bx)) < Math.abs(bz - near(bz)) ? bz : near(bz);
    const perp = heading + Math.PI / 2;
    for (const side of [-3.2, 3.2]) {
      const c = G.vehicles.spawn('police', rx + Math.sin(perp) * side, rz + Math.cos(perp) * side, perp, { cop: true });
      c.unitName = 'TAC-45'; c.state = 'roadblock';
      this.roadblocks.push(c);
    }
    // spike strip across the road between the two cars
    const strip = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.12, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }));
    strip.add(base);
    const spikeGeo = new THREE.ConeGeometry(0.14, 0.5, 5);
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.8, roughness: 0.3 });
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(spikeGeo, spikeMat);
      s.position.set(-3.4 + i * 0.85, 0.3, 0);
      strip.add(s);
    }
    strip.position.set(rx, 0.08, rz);
    strip.rotation.y = perp;
    this.scene.add(strip);
    this.strips.push({ mesh: strip, x: rx, z: rz, used: false });
    G.hud?.showToast('SPD roadblock ahead — spike strips on the road');
  }

  spawnHeli() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.4, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 5.2), bodyMat); g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ef, roughness: 0.1, metalness: 0.7 }));
    glass.position.set(0, 0.25, 1.8); g.add(glass);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111 }));
    rotor.position.y = 1.1; g.add(rotor);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.4), bodyMat);
    tail.position.set(0, 0.2, -4); g.add(tail);
    // spotlight cone
    const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 34, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.y = -17; g.add(cone);
    const spot = new THREE.Mesh(new THREE.CircleGeometry(6, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.3, depthWrite: false }));
    spot.rotation.x = -Math.PI / 2; g.add(spot);
    this.scene.add(g);
    this.heli = { mesh: g, rotor, spot, cone, angle: 0 };
    this.G.hud?.showToast(`${HELI_NAME} air support is over you`);
  }

  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.mesh);
    this.heli = null;
  }

  nearestCopDist() {
    const p = this.G.player.pos;
    let best = Infinity;
    for (const c of [...this.cops, ...this.roadblocks, ...(this.swat ? [this.swat] : [])]) {
      if (c.dead) continue;
      best = Math.min(best, c.mesh.position.distanceTo(p));
    }
    return best;
  }

  // Rows for the SPD RESPONSE panel.
  unitRows() {
    const p = this.G.player.pos;
    const rows = [];
    const statusFor = (d) => (d < 12 ? 'RAMMING' : d < 32 ? 'FLANKING' : 'CLOSING IN');
    for (const c of this.cops) {
      if (c.dead) continue;
      const d = Math.round(c.mesh.position.distanceTo(p));
      rows.push({ name: c.unitName ?? 'SPD', dist: d, status: statusFor(d) });
    }
    if (this.swat && !this.swat.dead) {
      rows.push({ name: SWAT_NAME, dist: Math.round(this.swat.mesh.position.distanceTo(p)), status: 'SWAT' });
    }
    for (const r of this.roadblocks) {
      if (r.dead) continue;
      rows.push({ name: r.unitName ?? 'TAC', dist: Math.round(r.mesh.position.distanceTo(p)), status: 'ROADBLOCK' });
    }
    if (this.heli) rows.push({ name: HELI_NAME, dist: Math.round(this.heli.mesh.position.distanceTo(p)), status: 'SPOTLIGHT' });
    // helicopter first so it is never cut by the 5-row slice
    rows.sort((a, b) => (a.name === HELI_NAME ? -1 : b.name === HELI_NAME ? 1 : 0));
    this.totalUnits = rows.length;
    return rows.slice(0, 5);
  }

  update(dt, G) {
    const p = G.player.pos;
    // heat off: pursuit stands down, roadblocks clear
    if (this.wanted === 0 && this.cops.length) {
      for (const c of this.cops) G.vehicles.remove(c);
      this.cops = [];
    }
    if (this.wanted < 3 && this.roadblocks.length) this.clearRoadblocks();
    if (this.wanted < 5 && this.swat) this.removeSwat();
    // desired pursuit units by wanted level (3 max while staging a shot,
    // so the staged car cannot be boxed in by six rammers)
    const want = this.wanted === 0 ? 0 : Math.min(2 + this.wanted, G.shotMode ? 3 : 6);
    this.spawnT -= dt;
    if (this.cops.filter((c) => !c.dead).length < want && this.spawnT <= 0) {
      this.spawnCop();
      this.spawnT = 1.2;
    }
    // SWAT van at 5 stars
    if (this.wanted >= 5 && !this.swat) this.spawnSwat();
    // roadblocks at 3+
    if (this.wanted >= 3) {
      this.roadblockT -= dt;
      if (this.roadblockT <= 0 && this.roadblocks.length < 2) {
        this.spawnRoadblock();
        this.roadblockT = 22;
      }
    }
    // helicopter at 4+
    if (this.wanted >= 4 && !this.heli) this.spawnHeli();
    if (this.wanted < 4 && this.heli) this.removeHeli();

    // dispatch radio chatter while wanted
    if (this.wanted > 0) {
      this.chatterT -= dt;
      if (this.chatterT <= 0) {
        this.chatter = CHATTER[this.chatterIdx % CHATTER.length];
        this.chatterIdx++;
        this.chatterT = 7;
      }
    }

    // spike strips shred tyres
    if (G.player.vehicle) {
      for (const s of this.strips) {
        if (s.used) continue;
        const v = G.player.vehicle;
        if (Math.hypot(v.mesh.position.x - s.x, v.mesh.position.z - s.z) < 3.5 && Math.abs(v.speed) > 6) {
          s.used = true;
          v.speed *= 0.35;
          G.vehicles.damage(v, 20, G);
          G.hud?.showToast('Spike strip — tyres shredded!');
          G.audio?.crash(12);
        }
      }
    }

    // drive the pursuit (cops + SWAT van)
    const pursuers = [...this.cops, ...(this.swat ? [this.swat] : [])];
    for (const c of pursuers) {
      if (c.dead) {
        if (c === this.swat) this.swat = null;
        else this.cops.splice(this.cops.indexOf(c), 1);
        continue;
      }
      const dx = p.x - c.mesh.position.x, dz = p.z - c.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(dx, dz);
      let dy = wantYaw - c.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dy * 2.4));
      const ram = dist < 14;
      const throttle = c.speed < (ram ? c.def.top : c.def.top * 0.92) ? 1 : 0;
      G.vehicles.drive(c, dt, throttle, steer, false, G);
      // teleport back if hopelessly lost (keeps pressure on)
      if (dist > 160) {
        const lines = G.city.roadLines;
        const a = Math.random() * Math.PI * 2;
        c.mesh.position.set(p.x + Math.cos(a) * 80, 0, p.z + Math.sin(a) * 80);
        c.yaw = Math.atan2(p.x - c.mesh.position.x, p.z - c.mesh.position.z);
        c.speed = 10;
      }
    }
    // heli circles the player — in shot mode it hovers behind-above instead,
    // lower, so it stays in the chase camera's frame
    if (this.heli) {
      let hx, hz;
      const heliH = G.shotMode ? 26 : 34;
      if (G.shotMode) {
        const pyaw = G.player.vehicle ? G.player.vehicle.yaw : G.player.yaw;
        const sway = Math.sin(performance.now() / 3000) * 6;
        hx = p.x - Math.sin(pyaw) * 24 + Math.cos(pyaw) * (8 + sway);
        hz = p.z - Math.cos(pyaw) * 24 - Math.sin(pyaw) * (8 + sway);
        this.heli.cone.scale.y = heliH / 34;
        this.heli.cone.position.y = -heliH / 2;
      } else {
        this.heli.angle += dt * 0.35;
        hx = p.x + Math.cos(this.heli.angle) * 26;
        hz = p.z + Math.sin(this.heli.angle) * 26;
      }
      this.heli.mesh.position.set(hx, heliH, hz);
      this.heli.mesh.lookAt(p.x, 0, p.z);
      this.heli.rotor.rotation.y += dt * 22;
      this.heli.spot.position.set(p.x - hx, -heliH + 0.2, p.z - hz);
    }
    // in sight? any cop within 55, or the heli
    this.inSight = this.nearestCopDist() < 55 || !!this.heli;
    // wanted decay when unseen
    if (this.wanted > 0 && !this.inSight) {
      this.decayT += dt;
      if (this.decayT >= CFG.WANTED_DECAY_TIME) {
        this.wanted--; this.decayT = 0;
        if (this.wanted === 0) { this.clearRoadblocks(); this.removeSwat(); this.removeHeli(); G.hud?.showToast('You lost them — heat is off'); }
        else G.hud?.showToast(`Heat cooling — ${this.wanted} star${this.wanted > 1 ? 's' : ''} left`);
      }
    } else this.decayT = 0;
    // busted: on foot, slow, cop close (not while staging a screenshot)
    if (!G.shotMode && this.wanted > 0 && !G.player.vehicle && G.player.speed < 1.5 && this.nearestCopDist() < 5) {
      this.bustedT += dt;
      if (this.bustedT > 2.5) { this.bustedT = 0; G.onBusted?.(); }
    } else this.bustedT = 0;
  }
}
