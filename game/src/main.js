// SOLENA BAY — bootstrap + game loop. Builds the world, runs the state machine
// (title / play / pause / wasted / busted), wires interactions and crew powers.
import * as THREE from 'three';
import { CFG, RADIO, mulberry32, pick } from './config.js';
import { buildCity } from './city.js';
import { Input } from './input.js';
import { CameraRig } from './camera.js';
import { Player } from './player.js';
import { Vehicles } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
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

// crew ability cooldowns (seconds remaining)
const cooldowns = { plates: 0, fix: 0, eyes: 0 };
const COOLDOWN_MAX = { plates: 45, fix: 60, eyes: 40 };

// --- screens / menus ---
const saved = loadGame();
if (saved) G.hud.el['continue-btn'].style.display = 'block';

function startGame(fresh) {
  if (fresh) { G.missions.done = 0; G.player.money = 250; G.player.respect = 0; }
  else if (saved) applySave(G, saved);
  G.mode = 'play';
  G.hud.hideScreens();
  G.audio.ensure();
  if (G.missions.done < 6) {
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
  if (!G.missions.active && G.missions.done < 6 && near(L.safehouse, 12) && !G.player.vehicle) {
    return { label: `E — Start mission: ${MISSIONS_TITLE()}`, act: () => G.missions.startMission(G.missions.done) };
  }
  if (near(L.respray, 12) && G.player.vehicle) {
    return { label: `E — Respray: clear wanted + repair ($${CFG.RESPRAY_COST})`, act: () => {
      if (G.player.money < CFG.RESPRAY_COST) { G.hud.showToast('Not enough cash for a respray'); return; }
      G.player.money -= CFG.RESPRAY_COST;
      G.police.clearWanted();
      G.player.vehicle.health = 100;
      G.hud.showToast('Fresh paint, fresh plates — the SPD lost you');
      G.audio?.jingle();
    } };
  }
  if (near(L.gunshop, 12) && !G.player.vehicle) {
    return { label: `E — Gunsmith: refill all ammo ($${CFG.AMMO_COST})`, act: () => {
      if (G.player.money < CFG.AMMO_COST) { G.hud.showToast('Not enough cash for ammo'); return; }
      G.player.money -= CFG.AMMO_COST;
      for (const k of Object.keys(G.player.ammo)) {
        G.player.ammo[k].reserve = k === 'smg' ? 180 : k === 'shotgun' ? 36 : 72;
        G.player.ammo[k].mag = k === 'smg' ? 30 : k === 'shotgun' ? 6 : 12;
      }
      G.hud.showToast('Ammo refilled — stay dangerous');
    } };
  }
  if (near(L.raceStart, 12) && G.player.vehicle && !G.missions.race) {
    return { label: 'E — Start the Sunset Strip Race', act: () => G.missions.startRace() };
  }
  return null;
}
function MISSIONS_TITLE() {
  const titles = ['FIRST WHEELS', 'THE DROP', 'HEAT ON THE STRIP', 'REPO RUN', 'DOCKSIDE DEAL', 'GOLDEN GETAWAY'];
  return titles[G.missions.done] ?? 'FREE ROAM';
}

function useCrewAbility(which) {
  if (cooldowns[which] > 0) return;
  if (which === 'plates') {
    if (G.police.wanted === 0) { G.hud.showToast('No heat to lose right now'); return; }
    G.police.wanted = Math.max(0, G.police.wanted - 1);
    G.hud.showToast('Tess swapped your plates — 1 star lost');
    cooldowns.plates = COOLDOWN_MAX.plates;
  } else if (which === 'fix') {
    if (!G.player.vehicle) { G.hud.showToast('Quick Fix needs a car'); return; }
    G.player.vehicle.health = 100;
    G.hud.showToast('Bo patched the car up — good as new');
    cooldowns.fix = COOLDOWN_MAX.fix;
  } else if (which === 'eyes') {
    G.eyesOutT = 20;
    G.hud.showToast('Ivy is watching — all SPD units on the minimap');
    cooldowns.eyes = COOLDOWN_MAX.eyes;
  }
}

// --- input actions ---
G.input.onKey = (code) => {
  G.audio.ensure();
  if (code === 'Escape') {
    if (G.mode === 'play') { G.mode = 'pause'; G.hud.showScreen('pause-menu'); }
    else if (G.mode === 'pause') { G.mode = 'play'; G.hud.hideScreens(); }
  }
  if (G.mode !== 'play') return;
  if (code === 'KeyM') { G.audio.setMuted(!G.audio.muted); G.hud.showToast(G.audio.muted ? 'Sound off' : 'Sound on'); }
  if (code === 'KeyR' && G.input.down('ShiftLeft')) { /* shift+R unused */ }
  if (code === 'KeyN') {
    G.radioIdx = (G.radioIdx + 1) % RADIO.length;
    G.audio.setRadio(G.radioIdx);
    G.hud.showToast(`Radio: ${RADIO[G.radioIdx].name} — ${RADIO[G.radioIdx].genre}`);
  }
  if (code === 'KeyZ') useCrewAbility('plates');
  if (code === 'KeyX') useCrewAbility('fix');
  if (code === 'KeyC') useCrewAbility('eyes');
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
    const ax = G.shotAuto ? { x: 0, y: 1 } : input.axis();
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
  // cooldowns
  for (const k of Object.keys(cooldowns)) cooldowns[k] = Math.max(0, cooldowns[k] - dt);
  if (G.eyesOutT > 0) G.eyesOutT -= dt;
  // autosave
  saveT += dt;
  if (saveT > 60) { saveT = 0; saveGame(G); }
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
  G.hud.setCrewCooldown(0, cooldowns.plates / COOLDOWN_MAX.plates);
  G.hud.setCrewCooldown(1, cooldowns.fix / COOLDOWN_MAX.fix);
  G.hud.setCrewCooldown(2, cooldowns.eyes / COOLDOWN_MAX.eyes);

  // interaction prompt
  const it = nearestInteractable();
  if (it) G.hud.showPrompt(it.label);
  else if (!G.player.vehicle && G.player.nearestVehicle(G)) G.hud.showPrompt('E — Steal car');
  else if (G.player.vehicle) G.hud.showPrompt('E — Exit car');
  else G.hud.showPrompt(null);

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
    inCar: !!G.player.vehicle, health: Math.round(G.player.health),
    cops: G.police.cops.length, enemies: G.combat.enemies.length,
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
