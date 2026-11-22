// SOLENA BAY — the crew. Kai's three friends each bring one ability with a
// cooldown: Tess swaps plates (lose a wanted star), Bo repairs the car on
// the spot, Ivy puts every SPD unit on the minimap for 20 seconds.
export const CREW = [
  { id: 'plates', key: 'Z', name: 'SWAP PLATES', who: 'Tess · Driver', desc: 'Lose 1 wanted star', cooldown: 45 },
  { id: 'fix', key: 'X', name: 'QUICK FIX', who: 'Bo · Mechanic', desc: 'Repair your car', cooldown: 60 },
  { id: 'eyes', key: 'C', name: 'EYES OUT', who: 'Ivy · Lookout', desc: 'Reveal all cops 20s', cooldown: 40 },
];

export class Crew {
  constructor(G) {
    this.G = G;
    this.cd = { plates: 0, fix: 0, eyes: 0 };
    this.eyesT = 0;
  }

  max(id) {
    return CREW.find((c) => c.id === id).cooldown;
  }

  // Fraction of the cooldown remaining (1 = just used, 0 = ready).
  frac(id) {
    return Math.max(0, this.cd[id] / this.max(id));
  }

  ready(id) {
    return this.cd[id] <= 0;
  }

  use(id) {
    const G = this.G;
    if (!this.ready(id)) return;
    if (id === 'plates') {
      if (G.police.wanted === 0) { G.hud?.showToast('No heat to lose right now'); return; }
      G.police.wanted = Math.max(0, G.police.wanted - 1);
      G.hud?.showToast('Tess swapped your plates — 1 star lost');
      this.cd.plates = this.max('plates');
    } else if (id === 'fix') {
      if (!G.player.vehicle) { G.hud?.showToast('Quick Fix needs a car'); return; }
      const v = G.player.vehicle;
      v.health = v.maxHealth ?? 100;
      v.smoking = false;
      if (v.smokeMesh) { v.mesh.remove(v.smokeMesh); v.smokeMesh = null; }
      G.hud?.showToast('Bo patched the car up — good as new');
      this.cd.fix = this.max('fix');
    } else if (id === 'eyes') {
      this.eyesT = 20;
      G.eyesOutT = 20;
      G.hud?.showToast('Ivy is watching — all SPD units on the minimap');
      this.cd.eyes = this.max('eyes');
    }
    G.audio?.blip();
  }

  update(dt) {
    for (const k of Object.keys(this.cd)) this.cd[k] = Math.max(0, this.cd[k] - dt);
    if (this.eyesT > 0) {
      this.eyesT -= dt;
      this.G.eyesOutT = Math.max(0, this.eyesT);
    }
  }
}
