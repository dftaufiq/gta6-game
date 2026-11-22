// SOLENA BAY — story missions (10) and the objective beacon. Each mission
// is a staged list: goto / enter / timed / lose / kill / escape / race.
// Later missions need a minimum respect rank to start, and the race stage
// borrows a route from the street-race system.
import * as THREE from 'three';
import { CFG, rankFor } from './config.js';

export const MISSIONS = [
  {
    title: 'FIRST WHEELS', giver: 'LUZ', reward: 300, rp: 120, needRp: 0,
    brief: 'Mama Luz needs a driver. Steal the Comet on Strand Row and bring it to her.',
    stages: [
      { kind: 'goto', x: -93, z: -93, r: 7, text: 'Go to the marked Comet on Strand Row',
        say: { who: 'LUZ', text: 'Kai, baby. A pretty Comet is parked on Strand Row. Bring it to me — and try not to scratch it.' } },
      { kind: 'enter', text: 'Steal the Comet (press E)',
        say: { who: 'KAI', text: 'Nice. This one is mine now.' } },
      { kind: 'goto', x: -62, z: -124, r: 9, text: 'Drive the Comet to Mama Luz',
        say: { who: 'LUZ', text: 'Good boy. Park it by the house and come inside.' } },
    ],
  },
  {
    title: 'THE DROP', giver: 'LUZ', reward: 450, rp: 150, needRp: 0,
    brief: 'A package at the docks, a buyer at the Marina. 120 seconds. No excuses.',
    stages: [
      { kind: 'goto', x: 170, z: 178, r: 8, text: 'Pick up the package at the Harbor Docks',
        say: { who: 'LUZ', text: 'The package is waiting at the docks. Grab it and move — the buyer does not wait.' } },
      { kind: 'timed', x: 186, z: -62, r: 9, t: 120, text: 'Deliver the package to the Marina buyer',
        say: { who: 'KAI', text: 'One hundred and twenty seconds across town. Easy money.' } },
    ],
  },
  {
    title: 'HEAT ON THE STRIP', giver: 'TESS', reward: 500, rp: 180, needRp: 0,
    brief: 'Tess set off every alarm on the Strip. Lose the heat, then get home.',
    stages: [
      { kind: 'lose', text: 'Lose the 2-star wanted level — break line of sight',
        say: { who: 'TESS', text: 'Okay, maybe I tripped an alarm. Or three. Lose them, Kai — then come home.' } },
      { kind: 'goto', x: -62, z: -124, r: 9, text: 'Reach the safehouse',
        say: { who: 'LUZ', text: 'Tess! You are lucky Kai drives like the devil himself.' } },
    ],
  },
  {
    title: 'REPO RUN', giver: 'BO', reward: 700, rp: 220, needRp: 0,
    brief: 'A Pelo GT sits in a downtown garage. Take it, shake the SPD, get it resprayed.',
    stages: [
      { kind: 'goto', x: 124, z: 124, r: 7, text: 'Go to the Pelo GT in the downtown garage',
        say: { who: 'BO', text: 'There is a Pelo GT downtown with your name on it. Well — with no name on it. Take it.' } },
      { kind: 'enter', text: 'Steal the Pelo GT (press E)',
        say: { who: 'KAI', text: 'This is the one. Bo is going to love this engine.' } },
      { kind: 'goto', x: -124, z: 62, r: 9, text: 'Reach the Respray shop and swap the plates',
        say: { who: 'BO', text: 'SPD is all over that car. Respray shop, now — new plates, new paint, new life.' } },
    ],
  },
  {
    title: 'DOCKSIDE DEAL', giver: 'IVY', reward: 900, rp: 300, needRp: 0,
    brief: "Rico Vane's crew crashed the deal at the docks. Protect Tess. Send them home.",
    stages: [
      { kind: 'goto', x: 170, z: 178, r: 10, text: 'Get to the Harbor Docks',
        say: { who: 'IVY', text: 'Rico\u2019s crew is at the docks with guns out. Tess is pinned behind the containers!' } },
      { kind: 'kill', n: 6, text: 'Take out Rico\u2019s crew (6 left)',
        say: { who: 'TESS', text: 'Kai! About time — they are everywhere. Watch the containers!' } },
      { kind: 'goto', x: -62, z: -124, r: 9, text: 'Bring Tess back to the safehouse',
        say: { who: 'LUZ', text: 'Both of you, inside. Rico will hear about this — and he will not like it.' } },
    ],
  },
  {
    title: 'GOLDEN GETAWAY', giver: 'LUZ', reward: 1500, rp: 500, needRp: 0,
    brief: 'The whole city is after you. Four stars, one helicopter, and a boat at Pier 9.',
    stages: [
      { kind: 'escape', x: CFG.OCEAN_X + 20, z: 150, r: 10, wanted: 4, text: 'Escape to the boat at Pier 9 — the whole SPD is on you',
        say: { who: 'LUZ', text: 'The boat leaves in minutes, Kai! The whole SPD is coming — drive like your life depends on it. Because it does.' } },
    ],
  },
  {
    title: 'THE VAULT RUN', giver: 'LUZ', reward: 1200, rp: 400, needRp: 500,
    brief: 'The Bank of Solena keeps its vault light at dusk. Walk in like you own it — but Rico heard about it too.',
    stages: [
      { kind: 'goto', x: 31, z: -31, r: 8, text: 'Reach the Bank of Solena downtown',
        say: { who: 'LUZ', text: 'The bank on Meridian Row keeps its vault light at dusk. Walk in like you own it.' } },
      { kind: 'kill', n: 5, x: 31, z: -31, text: 'Rico\u2019s crew crashed the job — take them out (5 left)',
        say: { who: 'KAI', text: 'Rico again. Nobody crashes my job and walks away.' } },
      { kind: 'timed', x: -62, z: -124, r: 9, t: 100, text: 'Get the vault cash home — 100 seconds',
        say: { who: 'LUZ', text: 'The vault is open and the SPD is coming. Home. Now.' } },
    ],
  },
  {
    title: 'STRIP CHAMPION', giver: 'TESS', reward: 800, rp: 350, needRp: 500,
    brief: 'The Marina Sprint decides who owns the Strip. Beat the clock — and Tess.',
    stages: [
      { kind: 'goto', x: 186, z: -186, r: 9, text: 'Get to the Marina Sprint start line',
        say: { who: 'TESS', text: 'The Marina Sprint. Beat my time and the Strip is yours, Kai.' } },
      { kind: 'race', route: 1, text: 'Win the Marina Sprint',
        say: { who: 'TESS', text: 'No brakes, no mercy. Win it.' } },
    ],
  },
  {
    title: 'DOCKSIDE WAR', giver: 'IVY', reward: 1800, rp: 600, needRp: 1000,
    brief: "Rico brought everyone to the docks. End it — then outrun a 5-star response to Pier 9.",
    stages: [
      { kind: 'goto', x: 170, z: 178, r: 10, text: 'Get to the Harbor Docks',
        say: { who: 'IVY', text: 'Rico brought everyone. Eight guns at the docks, Kai. End it.' } },
      { kind: 'kill', n: 8, text: 'Take out Rico\u2019s crew (8 left)',
        say: { who: 'RICO', text: 'You should have stayed a driver, Reyes!' } },
      { kind: 'escape', x: CFG.OCEAN_X + 20, z: 150, r: 10, wanted: 5, text: 'Escape to the boat at Pier 9 — 5 stars, SWAT is rolling',
        say: { who: 'LUZ', text: 'The whole SPD is coming for you. The boat is your only way out.' } },
    ],
  },
  {
    title: 'KING OF THE BAY', giver: 'LUZ', reward: 2500, rp: 800, needRp: 1200,
    brief: 'Rico is waiting at Pier 9. This ends tonight — then drive home a legend.',
    stages: [
      { kind: 'goto', x: CFG.OCEAN_X + 20, z: 150, r: 10, text: 'Meet Rico at Pier 9 — finish this',
        say: { who: 'LUZ', text: 'Rico is waiting at Pier 9. This ends tonight, one way or the other.' } },
      { kind: 'kill', n: 6, sx: 272, sz: 150, text: 'Rico\u2019s last crew — take them down (6 left)',
        say: { who: 'RICO', text: 'Solena Bay was mine before you were born, Reyes!' } },
      { kind: 'timed', x: -62, z: -124, r: 9, t: 150, text: 'Drive home a legend — 150 seconds',
        say: { who: 'LUZ', text: 'It is done. Come home, King of the Bay.' } },
    ],
  },
];

export class Missions {
  constructor(scene, G) {
    this.scene = scene; this.G = G;
    this.done = 0; // missions completed
    this.active = null;
    // objective beacon: glowing cylinder + ground ring
    this.beacon = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 14, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    cyl.position.y = 7;
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15;
    this.beacon.add(cyl); this.beacon.add(ring);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.beaconRing = ring;
  }

  get current() { return this.active ? MISSIONS[this.active.idx] : null; }

  // Rank gate for the next mission (null when open).
  lockFor(idx) {
    const def = MISSIONS[idx];
    if (!def || this.G.player.respect >= (def.needRp || 0)) return null;
    return { rp: def.needRp, rank: rankFor(def.needRp).name };
  }

  get markerPos() {
    if (this.G.races?.active) return this.G.races.markerPos();
    if (this.active) {
      const s = MISSIONS[this.active.idx].stages[this.active.stage];
      if (s.x !== undefined) return { x: s.x, z: s.z, label: 'Objective' };
    }
    if (this.done < MISSIONS.length) {
      const l = this.G.city.landmarks.safehouse;
      return { x: l.x, z: l.z, label: 'Mission' };
    }
    return null;
  }

  startMission(idx) {
    const G = this.G;
    const lock = this.lockFor(idx);
    if (lock) {
      G.hud?.showToast(`${MISSIONS[idx].title} needs ${lock.rank} rank (${lock.rp} RP) — earn respect first`);
      return false;
    }
    this.active = { idx, stage: 0, timer: 0, kills: 0, failT: 0 };
    // mission cars exist from the start so the player can see the target
    if (idx === 0) this.active.targetVehicle = G.vehicles.spawn('coupe', -93, -93, Math.PI / 2, { owned: false });
    if (idx === 3) this.active.targetVehicle = G.vehicles.spawn('sports', 124, 124, 0, { owned: false });
    G.hud?.showBanner(MISSIONS[idx].title, MISSIONS[idx].brief, 3.2);
    G.audio?.jingle();
    this.enterStage();
    return true;
  }

  // Try to start the race for a 'race' stage (needs a car; retried by update).
  tryRaceStage() {
    const G = this.G, m = this.active;
    if (!m || G.races.active) return;
    const s = MISSIONS[m.idx].stages[m.stage];
    G.races.start(s.route ?? 0, {
      onWin: () => { if (this.active === m) this.advance(); },
      onLose: () => { if (this.active === m) this.failMission('You lost the race — retry at the safehouse'); },
    });
  }

  enterStage() {
    const G = this.G, m = this.active;
    const s = MISSIONS[m.idx].stages[m.stage];
    m.kills = 0;
    if (s.say) G.hud?.showDialogue(s.say.who, s.say.text, 6);
    if (s.kind === 'timed') m.timer = s.t;
    if (s.kind === 'lose') G.police.addWanted(2, 'mission heat');
    if (s.kind === 'escape') G.police.addWanted(s.wanted ?? 4, 'mission heat');
    if (s.kind === 'race') this.tryRaceStage();
    if (s.kind === 'enter' && m.idx === 3) {
      G.hud?.showToast('The Pelo GT is parked here — steal it');
    }
    if (s.kind === 'kill') {
      const cx = s.sx ?? s.x ?? G.city.landmarks.docks.x;
      const cz = s.sz ?? s.z ?? G.city.landmarks.docks.z;
      const spots = [[-8, -6], [6, -10], [14, 4], [-14, 8], [0, 14], [18, -6], [-6, 18], [10, 16]];
      for (let i = 0; i < s.n; i++) {
        const [ox, oz] = spots[i % spots.length];
        G.combat.spawnEnemy(cx + ox, cz + oz);
      }
      m.need = s.n;
    }
    this.updateBeacon();
  }

  updateBeacon() {
    const mp = this.markerPos;
    if (mp && (this.active || this.G.races?.active)) {
      this.beacon.visible = true;
      this.beacon.position.set(mp.x, 0, mp.z);
    } else {
      this.beacon.visible = false;
    }
  }

  advance() {
    const m = this.active, def = MISSIONS[m.idx];
    if (m.stage + 1 < def.stages.length) {
      m.stage++;
      this.enterStage();
      this.G.audio?.blip();
    } else {
      this.completeMission();
    }
  }

  completeMission() {
    const G = this.G, def = MISSIONS[this.active.idx];
    G.player.money += def.reward;
    G.player.respect += def.rp;
    G.respect?.addHere(8);
    this.done++;
    this.active = null;
    this.beacon.visible = false;
    G.hud?.showBanner('MISSION PASSED', `${def.title}  ·  +$${def.reward}  ·  +${def.rp} RP`, 3.5);
    G.audio?.jingle();
    G.saveGame?.();
    if (this.done >= MISSIONS.length) {
      G.hud?.showDialogue('LUZ', 'That is the whole story, Kai. King of the Bay — races, shops, the whole city. Go enjoy it.', 8);
    } else {
      const lock = this.lockFor(this.done);
      G.hud?.showToast(lock
        ? `Next job needs ${lock.rank} rank (${lock.rp} RP) — race or work the streets`
        : 'Next mission available at the safehouse (M)');
    }
  }

  failMission(text) {
    const G = this.G;
    G.hud?.showBanner('MISSION FAILED', text, 3);
    this.active = null;
    this.beacon.visible = false;
    G.hud?.showToast('Mission failed — return to the safehouse (M) to retry');
  }

  onEnemyKilled() {
    if (!this.active) return;
    const s = MISSIONS[this.active.idx].stages[this.active.stage];
    if (s.kind !== 'kill') return;
    this.active.kills++;
    const left = s.n - this.active.kills;
    this.G.hud?.showToast(`${left} hostile${left === 1 ? '' : 's'} left`);
    if (left <= 0) this.advance();
  }

  update(dt, G) {
    this.beaconRing.rotation.z += dt * 1.5;
    if (!this.active) return;
    const m = this.active, s = MISSIONS[m.idx].stages[m.stage];
    const p = G.player.pos;
    if (s.kind === 'timed') {
      m.timer -= dt;
      if (m.timer <= 0) { this.failMission('Too slow — the buyer walked'); return; }
    }
    switch (s.kind) {
      case 'goto': case 'timed': case 'escape':
        if (Math.hypot(p.x - s.x, p.z - s.z) < s.r) {
          if (m.idx === 3 && m.stage === 2) {
            G.police.clearWanted();
            G.hud?.showToast('Plates swapped — heat is off');
          }
          this.advance();
        }
        break;
      case 'enter':
        if (G.player.vehicle) {
          // theft already added 1 star; the Pelo GT job adds 2 more (3 total)
          if (m.idx === 3) G.police.addWanted(2, 'stolen car');
          this.advance();
        }
        break;
      case 'lose':
        if (G.police.wanted === 0) this.advance();
        break;
      case 'race':
        // waits for the race callbacks; retry the start if the player was
        // on foot when the stage began
        if (!G.races.active) this.tryRaceStage();
        break;
      case 'kill':
        break; // advanced by onEnemyKilled
    }
  }

  // HUD panel data
  panel() {
    const G = this.G;
    if (G.races?.active) {
      const rp = G.races.panel();
      if (this.active && MISSIONS[this.active.idx].stages[this.active.stage].kind === 'race') {
        const def = MISSIONS[this.active.idx];
        return {
          title: `MISSION ${this.active.idx + 1} · ${def.title}`,
          stage: rp.stage, stageNum: this.active.stage + 1, stageTotal: def.stages.length,
          text: rp.text, timer: rp.timer, next: 'Complete the mission',
        };
      }
      return rp;
    }
    if (!this.active) {
      if (this.done < MISSIONS.length) {
        const lock = this.lockFor(this.done);
        return {
          title: 'FREE ROAM', stage: `MISSIONS ${this.done}/${MISSIONS.length}`,
          stageNum: this.done, stageTotal: MISSIONS.length,
          text: lock
            ? `Next job locked — needs ${lock.rank} rank (${lock.rp} RP)`
            : 'Go to Mama Luz (M) to start the next job',
          timer: null, next: MISSIONS[this.done].title,
        };
      }
      return {
        title: 'FREE ROAM', stage: 'ALL MISSIONS DONE',
        stageNum: MISSIONS.length, stageTotal: MISSIONS.length,
        text: 'Solena Bay is yours — race, shop, explore', timer: null,
        next: 'Sunset Strip Race',
      };
    }
    const def = MISSIONS[this.active.idx];
    const s = def.stages[this.active.stage];
    const next = def.stages[this.active.stage + 1];
    let text = s.text;
    if (s.kind === 'kill') text = s.text.replace(/\(\d+ left\)/, `(${s.n - this.active.kills} left)`);
    return {
      title: `MISSION ${this.active.idx + 1} · ${def.title}`,
      stage: `STAGE ${this.active.stage + 1}/${def.stages.length}`,
      stageNum: this.active.stage + 1, stageTotal: def.stages.length,
      text, timer: s.kind === 'timed' ? Math.ceil(this.active.timer) : null,
      next: next ? next.text : 'Complete the mission',
    };
  }
}
