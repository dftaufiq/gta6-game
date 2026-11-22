// SOLENA BAY — bootstrap + game loop. Builds the world, runs the state machine
// (title / play / pause / wasted / busted), wires interactions, crew powers,
// races, the garage, the weapon wheel and respect.
import * as THREE from 'three';
import { CFG, RADIO, WEAPONS, mulberry32, pick } from './config.js';
import { buildCity } from './city.js';
import { Input } from './input.js';
import { CameraRig } from './camera.js';
import { Player } from './player.js';
import { Vehicles } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions, MISSIONS } from './missions.js';
import { Crew } from './crew.js';
import { Races, RACE_ROUTES } from './races.js';
import { Garage } from './garage.js';
import { Respect } from './respect.js';
import { WeaponWheel } from './weaponwheel.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { applySave, loadGame, saveGame } from './save.js';
import { parseShot, stageShot } from './shots.js';

const { shot, seed } = parseShot();
const rng = mulberry32(shot ? seed : (Date.now() % 2147483647));

// --- renderer / scene ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

// golden-hour sun + sky fill
const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
sun.position.set(-120, 90, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);
scene.add(new THREE.HemisphereLight(0x8fb7ff, 0x8a6a4f, 0.85));
const warm = new THREE.AmbientLight(0xff9a5a, 0.25);
scene.add(warm);

// --- game state object: every system reads this ---
const G = {
  scene, camera, renderer, rng,
  mode: 'title', timeMin: CFG.CLOCK_START_MIN, radioIdx: 0,
  eyesOutT: 0, shotAuto: false, frame: 0, steps: 0,
  onWasted: null, onBusted: null, saveGame: null,
};

G.city = buildCity(scene, shot ? seed : 1337);
G.input = new Input(renderer.domElement);
G.camRig = new CameraRig(camera);
G.player = new Player(scene, G.city.landmarks.safehouse.x + 6, G.city.landmarks.safehouse.z + 8);
G.vehicles = new Vehicles(scene, G.city, rng);
G.peds = new Pedestrians(scene, G.city, rng);
G.police = new Police(scene, G);
G.combat = new Combat(scene, G);
G.missions = new Missions(scene, G);
G.crew = new Crew(G);
G.races = new Races(G);
G.respect = new Respect(G);
G.garage = new Garage(G);
G.wheel = new WeaponWheel(G);
G.audio = new AudioEngine();
G.hud = new HUD(G);
G.saveGame = () => saveGame(G);

// parked cars around town (stealable)
const parkedSpots = [
  [-93, -93, 'coupe'], [31, -31, 'sedan'], [-31, 93, 'suv'], [93, 155, 'sedan'],
  [-155, -31, 'taxi'], [155, -93, 'coupe'], [-31, -155, 'sedan'], [93, 31, 'van'],
  [-155, 155, 'sports'], [217, 31, 'sedan'], [31, 217, 'taxi'], [-217, -93, 'suv'],
];
for (const [x, z, t] of parkedSpots) G.vehicles.spawn(t, x, z, pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]));
// traffic
for (let i = 0; i < 12; i++) {
  const lines = G.city.roadLines;
  const x = pick(rng, lines), z = (Math.floor(rng() * 13) - 6) * 31;
  const t = G.vehicles.spawn(pick(rng, ['sedan', 'sedan', 'suv', 'taxi', 'coupe', 'van']), x, z, pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]), { traffic: true });
  t.speed = 8 + rng() * 4;
}
G.peds.populate(26);

// --- screens / menus ---
const saved = loadGame();
if (saved) G.hud.el['continue-btn'].style.display = 'block';

function startGame(fresh) {
  if (fresh) { G.missions.done = 0; G.player.money = 250; G.player.respect = 0; }
  else if (saved) applySave(G, saved);
  G.mode = 'play';
  G.hud.hideScreens();
  G.audio.ensure();
  if (G.missions.done < MISSIONS.length) {
    G.hud.showDialogue('LUZ', fresh
      ? 'Kai! You are late. Come to the house — I have work for you. Follow the yellow M on your map.'
      : 'Back again, Kai. The city missed you. Work is waiting at the house.', 7);
  }
  document.exitPointerLock?.();
}
document.getElementById('new-game-btn').addEventListener('click', () => startGame(true));
document.getElementById('continue-btn').addEventListener('click', () => startGame(false));
document.getElementById('resume-btn').addEventListener('click', () => { G.mode = 'play'; G.hud.hideScreens(); });
document.getElementById('save-quit-btn').addEventListener('click', () => {
  saveGame(G); G.mode = 'title'; G.hud.showScreen('start-screen');
});
for (const id of ['wasted-respawn-btn', 'busted-respawn-btn']) {
  document.getElementById(id).addEventListener('click', respawn);
}
function respawn() {
  const L = G.city.landmarks.safehouse;
  G.player.dead = false;
  G.player.health = 100;
  G.player.armour = 0;
  if (G.player.vehicle) G.player.exitVehicle(G);
  G.player.pos.set(L.x + 6, L.z + 8);
  G.police.clearWanted();
  G.mode = 'play';
  G.hud.hideScreens();
  G.hud.showToast('You woke up at the safehouse — Mama Luz patched you up');
}

G.onWasted = () => {
  G.player.money = Math.max(0, G.player.money - 100);
  G.mode = 'wasted';
  G.hud.showScreen('wasted-screen');
  G.audio?.explosion();
};
G.onBusted = () => {
  G.player.money = Math.max(0, G.player.money - 200);
  G.police.clearWanted();
  G.mode = 'busted';
  G.hud.showScreen('busted-screen');
};

// --- interactions ---
function nearestInteractable() {
  const p = G.player.pos, L = G.city.landmarks;
  const near = (pt, r) => Math.hypot(p.x - pt.x, p.z - pt.z) < r;
  if (!G.missions.active && G.missions.done < MISSIONS.length && near(L.safehouse, 12) && !G.player.vehicle) {
    const lock = G.missions.lockFor(G.missions.done);
    if (lock) {
      return {
        label: `🔒 ${MISSIONS[G.missions.done].title} — needs ${lock.rank} rank (${lock.rp} RP)`,
        act: () => G.hud.showToast(`${MISSIONS[G.missions.done].title} needs ${lock.rank} rank (${lock.rp} RP) — earn respect first`),
      };
    }
    return { label: `E — Start mission: ${MISSIONS[G.missions.done].title}`, act: () => G.missions.startMission(G.missions.done) };
  }
  if (near(L.garage, 12) && G.player.vehicle) {
    return { label: 'E — Garage: upgrades & respray', act: () => G.garage.toggle() };
  }
  if (near(L.gunshop, 12) && !G.player.vehicle) {
    return { label: `E — Gunsmith: refill all ammo ($${CFG.AMMO_COST})`, act: () => {
      if (G.player.money < CFG.AMMO_COST) { G.hud.showToast('Not enough cash for ammo'); return; }
      G.player.money -= CFG.AMMO_COST;
      for (const w of WEAPONS) {
        if (w.id === 'fists') continue;
        G.player.ammo[w.id].reserve = w.reserve;
        G.player.ammo[w.id].mag = w.mag;
      }
      G.hud.showToast('Ammo refilled — stay dangerous');
    } };
  }
  if (G.player.vehicle && !G.races.active) {
    const routes = [
      { pt: L.raceStart, idx: 0 }, { pt: L.race2, idx: 1 }, { pt: L.race3, idx: 2 },
    ];
    for (const r of routes) {
      if (near(r.pt, 12)) {
        const route = RACE_ROUTES[r.idx];
        return { label: `E — Start the ${route.name} (${route.t}s · $${route.reward})`, act: () => G.races.start(r.idx) };
      }
    }
  }
  return null;
}

// --- input actions ---
G.input.onKey = (code) => {
  G.audio.ensure();
  if (G.garage.open) { G.garage.handleKey(code); return; }
  if (code === 'Escape') {
    if (G.mode === 'play') { G.mode = 'pause'; G.hud.showScreen('pause-menu'); }
    else if (G.mode === 'pause') { G.mode = 'play'; G.hud.hideScreens(); }
  }
  if (G.mode !== 'play') return;
  if (code === 'KeyM') { G.audio.setMuted(!G.audio.muted); G.hud.showToast(G.audio.muted ? 'Sound off' : 'Sound on'); }
  if (code === 'KeyN') {
    G.radioIdx = (G.radioIdx + 1) % RADIO.length;
    G.audio.setRadio(G.radioIdx);
    G.hud.showToast(`Radio: ${RADIO[G.radioIdx].name} — ${RADIO[G.radioIdx].genre}`);
  }
  if (code === 'KeyZ') G.crew.use('plates');
  if (code === 'KeyX') G.crew.use('fix');
  if (code === 'KeyC') G.crew.use('eyes');
  if (code === 'KeyE') {
    const it = nearestInteractable();
    if (it) { it.act(); return; }
    if (G.player.vehicle) G.player.exitVehicle(G);
    else {
      const v = G.player.nearestVehicle(G);
      if (v) G.player.enterVehicle(v, G);
    }
  }
};

// --- title camera orbit ---
let titleAngle = 0.6;
function updateTitleCamera(dt) {
  titleAngle += dt * 0.05;
  const cx = Math.cos(titleAngle) * 150, cz = Math.sin(titleAngle) * 150;
  camera.position.set(cx, 55, cz);
  camera.lookAt(20, 4, 0);
}

// --- main loop ---
// Fixed-timestep simulation (1/30 s steps, up to 20 per frame) so game time
// runs at real speed even when the renderer is slow (software WebGL), with
// one render per animation frame.
const clock = new THREE.Clock();
const STEP = 1 / 30;
let acc = 0;
let saveT = 0;

function stepGame(dt) {
  G.steps++;
  const input = G.input;
  G.timeMin += dt * CFG.MIN_PER_SEC;
  // drive or walk
  const v = G.player.vehicle;
  if (v) {
    const ax = G.shotAuto ? shotAutopilot(G) : input.axis();
    G.vehicles.drive(v, dt, ax.y, ax.x, input.down('Space'), G);
    G.player.update(dt, G); // follows the car
  } else {
    G.player.update(dt, G);
  }
  G.vehicles.update(dt, G);
  G.peds.update(dt, G);
  G.police.update(dt, G);
  G.combat.update(dt, G);
  G.missions.update(dt, G);
  G.races.update(dt, G);
  G.crew.update(dt);
  // autosave
  saveT += dt;
  if (saveT > 60) { saveT = 0; saveGame(G); }
}

// Autopilot for the chase screenshot: hold the lane, dodge cars ahead
// (traffic, roadblocks) by aiming at the clear side, and reverse out
// if wedged against something.
function shotAutopilot(G) {
  const v = G.player.vehicle;
  if (!v) return { x: 0, y: 1 };
  const pos = v.mesh.position;
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  // unstuck: reversing out of a wedge
  if (G.autoReverseT > 0) {
    G.autoReverseT -= 1 / 30;
    return { x: 0.7, y: -1 };
  }
  if (Math.abs(v.speed) < 3) {
    G.autoStuckT = (G.autoStuckT || 0) + 1 / 30;
    if (G.autoStuckT > 1.2) { G.autoStuckT = 0; G.autoReverseT = 0.9; return { x: 0.7, y: -1 }; }
  } else G.autoStuckT = 0;
  // nearest threat ahead in a 5-wide corridor
  let threat = null, threatAhead = Infinity;
  for (const o of G.vehicles.list) {
    if (o === v || o.dead) continue;
    const dx = o.mesh.position.x - pos.x, dz = o.mesh.position.z - pos.z;
    const ahead = dx * fx + dz * fz;
    const side = dx * fz - dz * fx;
    if (ahead > 0 && ahead < 24 && Math.abs(side) < 5 && ahead < threatAhead) {
      threatAhead = ahead; threat = side;
    }
  }
  // aim point: lane centre, or 6.5 units to the clear side when dodging
  const aimX = threat === null ? 31 : (threat > 0 ? 37.5 : 24.5);
  const wantYaw = Math.atan2(aimX - pos.x, -30);
  let dy = wantYaw - v.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, dy * 2.2));
  return { x: steer, y: 1 };
}

function animate() {
  requestAnimationFrame(animate);
  const rawDt = Math.min(clock.getDelta(), 2);
  G.frame++;
  const input = G.input;

  if (G.mode === 'title') {
    updateTitleCamera(rawDt);
    G.vehicles.update(rawDt, G);
    G.peds.update(rawDt, G);
    G.city.wheel.rotation.z -= rawDt * 0.25;
    renderer.render(scene, camera);
    input.endFrame();
    return;
  }
  if (G.mode === 'pause' || G.mode === 'wasted' || G.mode === 'busted') {
    renderer.render(scene, camera);
    input.endFrame();
    return;
  }

  // --- play: simulate in fixed steps (cap 2 s / 60 steps per frame so game
  // time tracks real time even when the renderer is very slow) ---
  acc += rawDt;
  let n = 0;
  while (acc >= STEP && n < 60) { stepGame(STEP); acc -= STEP; n++; }
  if (n === 60) acc = 0;

  const look = input.consumeMouse();
  G.camRig.addLook(look.dx, look.dy);
  // chase shot: camera rides ahead of the car looking back at the pursuit
  if (G.shotAuto && G.player.vehicle) {
    G.camRig.yaw = G.player.vehicle.yaw - 0.36;
    G.camRig.pitch = 0.3;
  }
  G.wheel.update();
  G.hud.setCrewCooldown(0, G.crew.frac('plates'));
  G.hud.setCrewCooldown(1, G.crew.frac('fix'));
  G.hud.setCrewCooldown(2, G.crew.frac('eyes'));

  // interaction prompt (suppressed while staging screenshots)
  if (G.shotMode) G.hud.showPrompt(null);
  else {
    const it = nearestInteractable();
    if (it) G.hud.showPrompt(it.label);
    else if (!G.player.vehicle && G.player.nearestVehicle(G)) G.hud.showPrompt('E — Steal car');
    else if (G.player.vehicle) G.hud.showPrompt('E — Exit car');
    else G.hud.showPrompt(null);
  }

  // camera + sun follow the player (sun snaps only after 15 units, so the
  // shadow map is not re-rendered every frame while standing still)
  const focus = G.player.pos.clone(); focus.y = G.player.vehicle ? 1.5 : 1.2;
  G.camRig.update(rawDt, focus, !!G.player.vehicle);
  if (Math.hypot(G.player.pos.x - sun.target.position.x, G.player.pos.z - sun.target.position.z) > 15) {
    sun.position.set(G.player.pos.x - 120, 90, G.player.pos.z + 60);
    sun.target.position.copy(G.player.pos);
  }
  G.city.wheel.rotation.z -= rawDt * 0.25;

  // audio beds
  G.audio.setEngine(G.player.vehicle ? G.player.speedKmh : 0, !!G.player.vehicle);
  G.audio.setSiren(G.police.wanted, G.police.nearestCopDist());

  G.hud.update(rawDt, G);
  renderer.render(scene, camera);

  // test hook: puppeteer smoke test reads this
  window.__solena = {
    ready: true, mode: G.mode, frame: G.frame, steps: G.steps,
    keys: [...G.input.keys],
    x: +G.player.pos.x.toFixed(1), z: +G.player.pos.z.toFixed(1),
    speedKmh: Math.round(G.player.speedKmh), wanted: G.police.wanted,
    money: G.player.money, mission: G.missions.active ? G.missions.active.idx : -1,
    missionsDone: G.missions.done, race: G.races.active ? G.races.active.idx : -1,
    inCar: !!G.player.vehicle, health: Math.round(G.player.health),
    cops: G.police.cops.length, enemies: G.combat.enemies.length,
    wheelOpen: G.wheel.open, garageOpen: G.garage.open,
    respect: G.player.respect, standing: G.respect.current().value,
  };
  input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// shot staging (after the world exists, before the first frames matter)
if (shot) stageShot(G, shot);
else {
  G.mode = 'title';
  G.hud.showScreen('start-screen');
}
animate();
