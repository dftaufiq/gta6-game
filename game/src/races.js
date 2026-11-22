// SOLENA BAY — checkpoint street races. Three routes start from three
// corners of the city; win one for cash, respect and district standing.
// Missions can also borrow a route (the race stage completes or fails the
// mission through the onWin / onLose callbacks).
export const RACE_ROUTES = [
  {
    name: 'SUNSET STRIP LOOP', start: 'raceStart', reward: 500, rp: 150, t: 150,
    points: [
      { x: -186, z: -186 }, { x: 186, z: -186 }, { x: 186, z: 186 },
      { x: -186, z: 186 }, { x: -186, z: -186 },
    ],
  },
  {
    name: 'MARINA SPRINT', start: 'race2', reward: 750, rp: 200, t: 120,
    points: [
      { x: 186, z: -186 }, { x: 186, z: 186 }, { x: 93, z: 186 },
      { x: 93, z: -186 }, { x: 186, z: -186 },
    ],
  },
  {
    name: 'HARBOR DASH', start: 'race3', reward: 600, rp: 180, t: 110,
    points: [
      { x: -186, z: 186 }, { x: 62, z: 186 }, { x: 186, z: 155 },
      { x: 186, z: 62 }, { x: -186, z: 62 }, { x: -186, z: 186 },
    ],
  },
];

export class Races {
  constructor(G) {
    this.G = G;
    this.active = null;
    this.won = 0;
    this.onWin = null;
    this.onLose = null;
  }

  get route() {
    return this.active ? RACE_ROUTES[this.active.idx] : null;
  }

  start(idx, opts = {}) {
    const G = this.G;
    if (this.active) return false;
    if (!G.player.vehicle) { G.hud?.showToast('You need a car to race'); return false; }
    const route = RACE_ROUTES[idx];
    this.active = { idx, cp: 0, t: route.t };
    this.onWin = opts.onWin ?? null;
    this.onLose = opts.onLose ?? null;
    G.hud?.showBanner(route.name, `${route.points.length} checkpoints · ${route.t} seconds · $${route.reward} to the winner`, 3);
    G.missions?.updateBeacon();
    return true;
  }

  markerPos() {
    if (!this.active) return null;
    const route = RACE_ROUTES[this.active.idx];
    const cp = route.points[this.active.cp];
    return { x: cp.x, z: cp.z, label: 'Checkpoint' };
  }

  finish(won) {
    const G = this.G;
    const route = RACE_ROUTES[this.active.idx];
    const onWin = this.onWin, onLose = this.onLose;
    this.active = null;
    this.onWin = null; this.onLose = null;
    G.missions?.updateBeacon();
    if (won) {
      this.won++;
      G.player.money += route.reward;
      G.player.respect += route.rp;
      G.respect?.addHere(5);
      G.hud?.showBanner('RACE WON', `+$${route.reward}  ·  +${route.rp} RP`, 3);
      G.audio?.jingle();
      G.saveGame?.();
      onWin?.();
    } else {
      G.hud?.showBanner('RACE LOST', 'Out of time', 2.5);
      onLose?.();
    }
  }

  update(dt, G) {
    const r = this.active;
    if (!r) return;
    const route = RACE_ROUTES[r.idx];
    r.t -= dt;
    if (r.t <= 0) { this.finish(false); return; }
    const p = G.player.pos, cp = route.points[r.cp];
    if (Math.hypot(p.x - cp.x, p.z - cp.z) < 12) {
      r.cp++;
      G.audio?.blip();
      if (r.cp >= route.points.length) this.finish(true);
      else G.missions?.updateBeacon();
    }
  }

  // HUD panel data (same shape as Missions.panel).
  panel() {
    const route = this.route;
    return {
      title: route.name,
      stage: `CHECKPOINT ${this.active.cp + 1}/${route.points.length}`,
      stageNum: this.active.cp + 1, stageTotal: route.points.length,
      text: 'Hit the next checkpoint', timer: Math.ceil(this.active.t),
      next: 'Finish the loop',
    };
  }
}
