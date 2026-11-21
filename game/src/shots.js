// SOLENA BAY — ?shot= staging. Each shot plays the REAL game with a fixed
// seed, placing the player, cars, cops and missions for a genuine render.
import { CFG } from './config.js';

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  return { shot: q.get('shot'), seed: parseInt(q.get('seed') || '1', 10) || 1 };
}

export function stageShot(G, shot) {
  const L = G.city.landmarks;
  if (shot === 'start') {
    // title screen over the city: nothing to stage, main.js orbits the camera
    G.mode = 'title';
    G.hud.showScreen('start-screen');
    return;
  }
  // gameplay shots: skip the title, go straight into play
  G.mode = 'play';
  G.shotMode = true; // disables the busted screen (staged player stands still)
  G.hud.hideScreens();

  if (shot === 'foot') {
    // On foot downtown: peds + traffic + mission marker + dialogue
    G.player.pos.set(28, 0, 60);
    G.player.yaw = Math.PI;
    G.missions.startMission(0);
    G.hud.showDialogue('LUZ', 'Kai, baby. A pretty Comet is parked on Strand Row. Bring it to me — and try not to scratch it.', 30);
    G.camRig.yaw = Math.PI * 0.98; G.camRig.pitch = 0.34;
    // a few pedestrians right around the player + traffic up the street
    for (const [x, z] of [[24, 52], [36, 68], [20, 72], [40, 50], [30, 80]]) G.peds.spawn(x, z);
    const t1 = G.vehicles.spawn('sedan', 31, 20, Math.PI, { traffic: true }); t1.speed = 10;
    const t2 = G.vehicles.spawn('taxi', 31, -45, 0, { traffic: true }); t2.speed = 10;
    const t3 = G.vehicles.spawn('suv', 31, 130, Math.PI, { traffic: true }); t3.speed = 9;
  }

  if (shot === 'chase') {
    // COVER: 4-star chase in the Pelo GT, helicopter + 3 cop cars, mission 6 live
    // clear the route: no parked/traffic cars in the x = 31 corridor
    for (const o of [...G.vehicles.list]) {
      if (!o.isCop && Math.abs(o.mesh.position.x - 31) < 12) G.vehicles.remove(o);
    }
    const car = G.vehicles.spawn('sports', 31, 100, Math.PI, { owned: true });
    car.speed = 30;
    car.health = 100000; // staged car must survive the whole shot
    car.topOverride = 34; // cops (top 37) stay on its tail instead of falling behind
    G.player.enterVehicle(car, G);
    G.player.money = 86450;
    G.player.respect = 2310;
    G.missions.done = 5;
    G.missions.startMission(5);
    // wanted 4 (mission sets it), then place 3 cops close behind + heli
    for (const [x, z] of [[31, 118], [27, 128], [35, 140]]) {
      const c = G.vehicles.spawn('police', x, z, Math.PI, { cop: true });
      c.unitName = ['SPD-12', 'RAM-03', 'TAC-45'][G.police.cops.length % 3];
      c.state = 'chase'; c.speed = 30;
      G.police.cops.push(c);
    }
    G.police.spawnHeli();
    G.police.wanted = 4;
    G.hud.showDialogue('LUZ', 'The boat leaves in minutes, Kai! The whole SPD is coming — drive like your life depends on it.', 30);
    G.shotAuto = true; // main loop keeps the car flying straight up the road
    G.camRig.distLock = 16; // wider chase framing (camera rides ahead, see main.js)
    G.timeMin = 18 * 60 + 48;
  }

  if (shot === 'mission') {
    // Mission 5 shootout at the docks: SMG out, enemies ahead, Tess pinned down.
    // Player stands on the x = 155 road south of the container yard, facing
    // north up the clear road — camera behind has an open lane to the fight.
    for (const o of [...G.vehicles.list]) {
      if (o.isTraffic && Math.hypot(o.mesh.position.x - 155, o.mesh.position.z - 190) < 60) G.vehicles.remove(o);
    }
    G.player.pos.set(155, 0, 208);
    G.player.yaw = Math.PI;
    G.player.weaponIdx = 2; // SMG
    G.player.armour = 100; // staged player must survive the whole shot
    G.missions.done = 4;
    G.missions.startMission(4);
    // jump straight to the kill stage
    G.missions.active.stage = 1;
    G.missions.enterStage();
    G.police.addWanted(2, 'mission heat');
    G.hud.showDialogue('TESS', 'Kai! About time — they are everywhere. Watch the containers!', 30);
    G.camRig.yaw = 0.05; G.camRig.pitch = 0.3;
    G.timeMin = 17 * 60 + 5;
  }

  if (shot === 'race') {
    const car = G.vehicles.spawn('coupe', -186, -186, Math.PI / 2, { owned: true });
    G.player.enterVehicle(car, G);
    G.missions.startRace();
    G.camRig.snapBehind(car.yaw);
  }
}
