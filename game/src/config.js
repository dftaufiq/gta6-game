// SOLENA BAY — tuning, names, colours. One job: every magic number lives here.
export const CFG = {
  // City layout
  BLOCK: 46, ROAD: 16, PITCH: 62, GRID: 7, // 7x7 blocks, roads on grid lines
  BEACH_X: 225, OCEAN_X: 285, WORLD: 340, // east edge: sand, then water
  // Player
  WALK: 6, SPRINT: 10, JUMP: 8.5, GRAVITY: 22,
  // Wanted
  WANTED_DECAY_DIST: 55, WANTED_DECAY_TIME: 8,
  RESPRAY_COST: 200, AMMO_COST: 100,
  // Clock: one game hour per 90 real seconds, starts 16:40 golden hour
  CLOCK_START_MIN: 16 * 60 + 40, MIN_PER_SEC: 60 / 90,
  SAVE_KEY: 'solena-bay-save-v2',
};

export const DISTRICTS = [
  { name: 'Downtown Solena', x0: -95, x1: 95, z0: -95, z1: 95 },
  { name: 'Marina Walk', x0: 95, x1: 225, z0: -95, z1: 95 },
  { name: 'Solena Beach', x0: 225, x1: 340, z0: -340, z1: 340 },
  { name: 'Old Town', x0: -340, x1: -95, z0: -95, z1: 95 },
  { name: 'Harbor Docks', x0: -95, x1: 225, z0: 95, z1: 340 },
  { name: 'Palm Heights', x0: -95, x1: 225, z0: -340, z1: -95 },
  { name: 'Sunset Strip', x0: -340, x1: -95, z0: 95, z1: 340 },
  { name: 'North Point', x0: -340, x1: -95, z0: -340, z1: -95 },
];

export const CHARACTERS = {
  KAI: { name: 'Kai Reyes', role: 'Driver', color: '#f2a541', skin: '#c98a5a', hair: '#2b1d12' },
  LUZ: { name: 'Mama Luz', role: 'Fixer', color: '#e05a8a', skin: '#b97a52', hair: '#e8e4da' },
  TESS: { name: 'Tess', role: 'Driver', color: '#4fc3f7', skin: '#8a5a3b', hair: '#111111' },
  BO: { name: 'Bo', role: 'Mechanic', color: '#8bc34a', skin: '#d9a077', hair: '#7a4a21' },
  IVY: { name: 'Ivy', role: 'Lookout', color: '#ba68c8', skin: '#e8b88a', hair: '#c93a2e' },
  RICO: { name: 'Rico Vane', role: 'Rival', color: '#ef5350', skin: '#c98a5a', hair: '#1a1a1a' },
  SPD: { name: 'SPD Dispatch', role: 'Solena PD', color: '#5c9ded', skin: '#d9a077', hair: '#3a3a3a' },
};

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', dmg: 12, range: 2.4, rate: 2.2, mag: Infinity, reserve: Infinity, auto: false, icon: '✊' },
  { id: 'pistol', name: 'P9 PISTOL', dmg: 26, range: 70, rate: 3.5, mag: 12, reserve: 72, auto: false, icon: '🔫' },
  { id: 'smg', name: 'VK SMG', dmg: 13, range: 55, rate: 9, auto: true, mag: 30, reserve: 180, icon: '🔫' },
  { id: 'shotgun', name: 'M870 BREACH', dmg: 9, pellets: 6, range: 30, rate: 1.3, auto: false, mag: 6, reserve: 36, icon: '🔫' },
  { id: 'rifle', name: 'VK-9 RIFLE', dmg: 45, range: 120, rate: 2.2, auto: false, mag: 20, reserve: 60, icon: '🔫' },
];

export const VEHICLE_TYPES = {
  sedan: { name: 'Astra Sedan', top: 30, accel: 15, color: 0x9fb3c8 },
  coupe: { name: 'Veloz Comet', top: 38, accel: 19, color: 0xd94f3d },
  suv: { name: 'Bruto Rancher', top: 26, accel: 13, color: 0x5a7d5a },
  taxi: { name: 'Solena Cab', top: 30, accel: 15, color: 0xf2c230 },
  sports: { name: 'Rukan Pelo GT', top: 44, accel: 22, color: 0xff7a1a },
  police: { name: 'SPD Interceptor', top: 37, accel: 20, color: 0x1c2733 },
  swat: { name: 'SPD SWAT Van', top: 30, accel: 14, color: 0x1c2733 },
  van: { name: 'Dock Van', top: 24, accel: 11, color: 0x8a8f98 },
};

export const CAR_COLORS = [0xd94f3d, 0x3d7dd9, 0xf2c230, 0x5a7d5a, 0xe8e4da, 0x2b2f36, 0x9fb3c8, 0xba68c8, 0xff7a1a, 0x4fc3f7];

export const RADIO = [
  { name: 'SOL 98.4', genre: 'Island Pop', scale: [0, 2, 4, 7, 9], root: 220, tempo: 112, wave: 'triangle' },
  { name: 'BAY FM 101', genre: 'Sunset Synth', scale: [0, 3, 5, 7, 10], root: 196, tempo: 96, wave: 'sawtooth' },
  { name: 'TALK 770', genre: 'Solena Talk', scale: [0, 4, 7], root: 174, tempo: 70, wave: 'sine' },
];

export const RANKS = [
  { rp: 0, name: 'NOBODY' }, { rp: 200, name: 'ERRAND BOY' }, { rp: 500, name: 'WHEELMAN' },
  { rp: 1000, name: 'FIXER' }, { rp: 1800, name: 'SHOT CALLER' }, { rp: 3000, name: 'BAY LEGEND' },
];

export function rankFor(rp) {
  let r = RANKS[0];
  for (const x of RANKS) if (rp >= x.rp) r = x;
  return r;
}

// Deterministic RNG (mulberry32) so ?shot= scenes stage identically.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function range(rng, a, b) { return a + rng() * (b - a); }
