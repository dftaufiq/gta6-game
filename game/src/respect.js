// SOLENA BAY — respect ranks + district standing. Missions, races and jobs
// raise Kai's standing in the district where they happen; the HUD shows the
// current district's standing under the location name, and later missions
// require a minimum rank to start.
import { DISTRICTS, rankFor } from './config.js';
import { districtAt } from './city.js';

export const STANDING = [
  { min: 0, name: 'HOSTILE' },
  { min: 25, name: 'COLD' },
  { min: 45, name: 'NEUTRAL' },
  { min: 65, name: 'LIKED' },
  { min: 85, name: 'LOVED' },
];

export function standingLabel(v) {
  let out = STANDING[0];
  for (const s of STANDING) if (v >= s.min) out = s;
  return out.name;
}

export class Respect {
  constructor(G) {
    this.G = G;
    this.standing = {};
    for (const d of DISTRICTS) this.standing[d.name] = 50;
  }

  rank() {
    return rankFor(this.G.player.respect);
  }

  current() {
    const name = districtAt(this.G.player.pos.x, this.G.player.pos.z);
    const value = this.standing[name] ?? 50;
    return { name, value, label: standingLabel(value) };
  }

  add(district, n) {
    if (!(district in this.standing)) return;
    this.standing[district] = Math.max(0, Math.min(100, this.standing[district] + n));
  }

  addHere(n) {
    this.add(districtAt(this.G.player.pos.x, this.G.player.pos.z), n);
  }
}
