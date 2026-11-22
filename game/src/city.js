// SOLENA BAY — the city. buildCity lays out the road grid, blocks, buildings,
// palms, beach umbrellas, ocean, pier and docks, and returns collision +
// landmark data.
import * as THREE from 'three';
import { CFG, DISTRICTS, mulberry32, pick, range } from './config.js';
import { asphaltTexture, facadeTexture, sandTexture, sidewalkTexture, signTexture, skyTexture, waterTexture } from './textures.js';
import { boxPart, cylPart, mergeGeoms, planePart } from './merge.js';

const FACADE_BASES = ['#d9a066', '#c98a7a', '#a8b8c4', '#e0c48f', '#b08aa0', '#8fb8a0', '#d4b06a', '#9a8fc4'];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  return 'Solena Bay';
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const colliders = []; // {x0,z0,x1,z1}
  const roadLines = []; // road centre coords along each axis
  const half = (CFG.GRID * CFG.PITCH) / 2; // 217
  for (let i = 0; i <= CFG.GRID; i++) roadLines.push(-half + i * CFG.PITCH);

  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xf2a06b, 130, 430);

  // --- ground, beach, ocean ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.WORLD * 2 + 120, CFG.WORLD * 2 + 120),
    new THREE.MeshStandardMaterial({ color: 0x7d8a6a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.x = 60; ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.OCEAN_X - CFG.BEACH_X + 30, CFG.WORLD * 2 + 120),
    new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set((CFG.BEACH_X + CFG.OCEAN_X) / 2 + 8, 0.02, 0);
  sand.receiveShadow = true; scene.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(400, CFG.WORLD * 2 + 400),
    new THREE.MeshStandardMaterial({ map: waterTexture(), transparent: true, opacity: 0.92, roughness: 0.25, metalness: 0.1 }),
  );
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(CFG.OCEAN_X + 190, 0.05, 0);
  scene.add(ocean);

  // foam line where waves meet sand
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(4, CFG.WORLD * 2 + 120),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
  );
  foam.rotation.x = -Math.PI / 2; foam.position.set(CFG.OCEAN_X - 2, 0.08, 0);
  scene.add(foam);

  // --- roads (merged into one mesh) ---
  const asphalt = new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.95 });
  const roadParts = [];
  for (const r of roadLines) {
    roadParts.push(planePart(0, 0.03, r, CFG.WORLD * 2, CFG.ROAD));
    roadParts.push(planePart(r, 0.03, 0, CFG.ROAD, CFG.WORLD * 2));
  }
  const roads = new THREE.Mesh(mergeGeoms(roadParts), asphalt);
  roads.receiveShadow = true;
  scene.add(roads);
  // centre dashes, one instanced mesh
  const dashGeo = new THREE.PlaneGeometry(4, 0.6);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf2c230 });
  const dashSpots = [];
  for (const r of roadLines) {
    for (let d = -half; d < half; d += 10) {
      dashSpots.push([d, r, 0]); dashSpots.push([r, d, 1]);
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashSpots.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(-Math.PI / 2, 0, 0);
    const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2));
    dashSpots.forEach(([x, z, rot], i) => {
      m.compose(new THREE.Vector3(x, 0.06, z), rot ? q2 : q.setFromEuler(e), new THREE.Vector3(1, 1, 1));
      dashes.setMatrixAt(i, m);
    });
  }
  scene.add(dashes);

  // --- facades (shared materials) ---
  const facadeMats = FACADE_BASES.map((b, i) =>
    new THREE.MeshStandardMaterial({ map: facadeTexture(1000 + i * 37, b, 4 + (i % 4), 4), roughness: 0.9 }));
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b5a4a, roughness: 1 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: sidewalkTexture(), roughness: 1 });
  const buildingMeshes = [];

  const buildings = [];
  const facadeParts = facadeMats.map(() => []);
  const roofParts = [];
  const walkParts = [];
  // blocks sit between road lines
  for (let bi = 0; bi < CFG.GRID; bi++) {
    for (let bj = 0; bj < CFG.GRID; bj++) {
      const cx = -half + bi * CFG.PITCH + CFG.PITCH / 2;
      const cz = -half + bj * CFG.PITCH + CFG.PITCH / 2;
      const downtown = Math.abs(cx) < 100 && Math.abs(cz) < 100;
      walkParts.push(planePart(cx, 0.04, cz, CFG.BLOCK + 6, CFG.BLOCK + 6));
      const n = downtown ? 2 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 12, 20), d = range(rng, 12, 20);
        const h = downtown ? range(rng, 18, 46) : range(rng, 8, 20);
        const ox = (k % 2 === 0 ? -1 : 1) * range(rng, 4, 10);
        const oz = (k < 2 ? -1 : 1) * range(rng, 4, 10);
        const bx = cx + ox, bz = cz + oz;
        const mi = Math.floor(rng() * facadeMats.length);
        facadeParts[mi].push(boxPart(bx, h / 2, bz, w, h, d));
        roofParts.push(boxPart(bx, h + 0.4, bz, w + 0.6, 0.8, d + 0.6));
        colliders.push({ x0: bx - w / 2, z0: bz - d / 2, x1: bx + w / 2, z1: bz + d / 2 });
        buildings.push({ x: bx, z: bz, w, d, h });
      }
    }
  }
  // one merged mesh per facade material (+ roofs + sidewalks as single meshes)
  for (let i = 0; i < facadeMats.length; i++) {
    if (!facadeParts[i].length) continue;
    const mesh = new THREE.Mesh(mergeGeoms(facadeParts[i]), facadeMats[i]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.kind = 'building';
    buildingMeshes.push(mesh);
    scene.add(mesh);
  }
  const roofs = new THREE.Mesh(mergeGeoms(roofParts), roofMat);
  roofs.castShadow = true;
  scene.add(roofs);
  const walks = new THREE.Mesh(mergeGeoms(walkParts), sidewalkMat);
  walks.receiveShadow = true;
  scene.add(walks);

  // --- palms (instanced trunks + frond cones) — denser than before ---
  const palmSpots = [];
  for (const r of roadLines) {
    for (let d = -half + 20; d < half; d += 30) {
      if (rng() < 0.9) palmSpots.push([r + CFG.ROAD / 2 + 3.5, d + range(rng, -6, 6)]);
      if (rng() < 0.65) palmSpots.push([d + range(rng, -6, 6), r + CFG.ROAD / 2 + 3.5]);
    }
  }
  for (let i = 0; i < 60; i++) palmSpots.push([range(rng, CFG.BEACH_X + 4, CFG.BEACH_X + 26), range(rng, -half, half)]);
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const frondGeo = new THREE.ConeGeometry(4.2, 3.4, 7);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2f9e4f, roughness: 1 });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    const e = new THREE.Euler();
    palmSpots.forEach(([x, z], i) => {
      const lean = range(rng, -0.14, 0.14);
      m.compose(new THREE.Vector3(x, 3.5, z), q.setFromEuler(e.set(lean, rng() * Math.PI, lean)), s);
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x + lean * 8, 8.2, z), q.setFromEuler(e.set(Math.PI, 0, 0)), s);
      fronds.setMatrixAt(i, m);
      colliders.push({ x0: x - 0.6, z0: z - 0.6, x1: x + 0.6, z1: z + 0.6 });
    });
  }
  trunks.castShadow = true; fronds.castShadow = true;
  scene.add(trunks); scene.add(fronds);

  // --- beach umbrellas (instanced poles + coloured canopies) ---
  const umbrellaSpots = [];
  for (let i = 0; i < 16; i++) umbrellaSpots.push([range(rng, CFG.BEACH_X + 6, CFG.BEACH_X + 30), range(rng, -200, 200)]);
  const uPoleGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.4, 5);
  const uPoleMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.8 });
  const uPoles = new THREE.InstancedMesh(uPoleGeo, uPoleMat, umbrellaSpots.length);
  const uTopGeo = new THREE.ConeGeometry(2.4, 1.1, 8);
  const uTopMats = [0xff5a7a, 0x4fc3f7, 0xf2c230, 0x8bc34a].map((c) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  const uTops = uTopMats.map((mat) => new THREE.InstancedMesh(uTopGeo, mat, umbrellaSpots.length));
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    const counts = [0, 0, 0, 0];
    umbrellaSpots.forEach(([x, z], i) => {
      m.compose(new THREE.Vector3(x, 1.2, z), q, s);
      uPoles.setMatrixAt(i, m);
      const mi = i % 4;
      m.compose(new THREE.Vector3(x, 2.8, z), q, s);
      uTops[mi].setMatrixAt(counts[mi]++, m);
    });
    uTops.forEach((t, i) => { t.count = counts[i]; });
  }
  scene.add(uPoles);
  uTops.forEach((t) => scene.add(t));

  // --- streetlights (instanced poles + emissive heads) ---
  const lightSpots = [];
  for (const r of roadLines) for (let d = -half; d <= half; d += CFG.PITCH) lightSpots.push([r + CFG.ROAD / 2 + 1, d + CFG.ROAD / 2 + 1]);
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 7, 5);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6, metalness: 0.5 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lightSpots.length);
  const headGeo = new THREE.SphereGeometry(0.55, 8, 6);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 1.6 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lightSpots.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    lightSpots.forEach(([x, z], i) => {
      m.compose(new THREE.Vector3(x, 3.5, z), q, s); poles.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, 7.2, z), q, s); heads.setMatrixAt(i, m);
    });
  }
  scene.add(poles); scene.add(heads);

  // --- pier (boardwalk into the ocean, south-east) ---
  const pierZ = 150;
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x9a7a55, roughness: 1 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 12), pierMat);
  pier.position.set(CFG.OCEAN_X + 20, 1.4, pierZ); pier.castShadow = true; scene.add(pier);
  const postParts = [];
  for (let x = CFG.OCEAN_X - 8; x < CFG.OCEAN_X + 55; x += 10) {
    for (const dz of [-5, 5]) postParts.push(cylPart(x, 0.4, pierZ + dz, 0.5, 3));
  }
  scene.add(new THREE.Mesh(mergeGeoms(postParts), pierMat));
  // ferris wheel silhouette on the pier (torus + spokes, slowly turns in main loop)
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(11, 0.5, 6, 24), new THREE.MeshStandardMaterial({ color: 0xff5a7a, emissive: 0x881133, emissiveIntensity: 0.8 }));
  wheel.add(rim);
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 22, 5), rim.material);
    spoke.rotation.z = (i * Math.PI) / 4; wheel.add(spoke);
  }
  wheel.position.set(CFG.OCEAN_X + 30, 15, pierZ);
  scene.add(wheel);

  // --- docks (south-east): containers + crates, mission 5/9 site ---
  const containerColors = [0xd94f3d, 0x3d7dd9, 0x5a7d5a, 0xf2c230];
  const dockX0 = 150, dockZ0 = 170;
  const containerParts = [];
  for (let i = 0; i < 14; i++) {
    const w = 12, h = 4 + (i % 3) * 2.6, d = 5;
    const x = dockX0 + (i % 5) * 14, z = dockZ0 + Math.floor(i / 5) * 9;
    containerParts.push(boxPart(x, h / 2, z, w, h, d, containerColors[i % 4]));
    colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
  }
  const containers = new THREE.Mesh(mergeGeoms(containerParts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  containers.castShadow = true; containers.receiveShadow = true;
  scene.add(containers);

  // --- landmark signs (canvas textures on building faces, neon at dusk) ---
  function addSign(text, sub, bg, fg, x, y, z, ry, w = 14, h = 3.5) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: signTexture(text, bg, fg, sub), emissive: 0xffffff, emissiveMap: signTexture(text, bg, fg, sub), emissiveIntensity: 0.35 }));
    mesh.position.set(x, y, z); mesh.rotation.y = ry; scene.add(mesh);
  }
  addSign('MAMA LUZ', 'FIXER · SAFEHOUSE', '#e05a8a', '#ffffff', -62, 7, -122, 0);
  addSign('SOLENA PD', 'PRECINCT 4', '#24407a', '#ffffff', 62, 9, -62, Math.PI);
  addSign('RESPRAY', 'NEW PLATES · $200', '#2f9e4f', '#ffffff', -124, 6, 62, Math.PI / 2);
  addSign('GUNSMITH', 'AMMO · $100', '#5a3a8a', '#ffffff', 124, 6, -124, -Math.PI / 2);
  addSign('PIER 9', 'FERRIS WHEEL', '#ff7a1a', '#ffffff', CFG.OCEAN_X + 8, 8, pierZ - 10, -Math.PI / 2, 18, 4.5);
  addSign('BANK OF SOLENA', 'VAULT · DOWNTOWN', '#b08a2a', '#ffffff', 31, 9, -25, 0, 16, 4);
  addSign('NEON PALMS', 'BAR · LIVE MUSIC', '#ff2a7a', '#ffffff', -93, 8, 93, Math.PI / 2, 16, 4);
  addSign('TACO SOL', 'OPEN LATE', '#ff7a1a', '#ffffff', 93, 7, 93, -Math.PI / 2, 12, 3.5);
  addSign('MARINA RACE', 'SPRINT START', '#2a7fd9', '#ffffff', 186, 6, -180, Math.PI, 14, 3.5);
  addSign('HARBOR DASH', 'RACE START', '#2a7fd9', '#ffffff', -186, 6, 180, 0, 14, 3.5);

  // Landmark positions the missions + HUD use
  const landmarks = {
    safehouse: { x: -62, z: -124, label: 'Mama Luz — Safehouse' },
    policeStation: { x: 62, z: -62, label: 'Solena PD' },
    respray: { x: -124, z: 62, label: 'Respray Shop' },
    garage: { x: -124, z: 62, label: 'Bo\u2019s Garage' },
    gunshop: { x: 124, z: -124, label: 'Gunsmith' },
    bank: { x: 31, z: -31, label: 'Bank of Solena' },
    docks: { x: dockX0 + 20, z: dockZ0 + 8, label: 'Harbor Docks' },
    pier: { x: CFG.OCEAN_X + 20, z: pierZ, label: 'Pier 9' },
    raceStart: { x: -186, z: -186, label: 'Sunset Strip Race' },
    race2: { x: 186, z: -186, label: 'Marina Sprint' },
    race3: { x: -186, z: 186, label: 'Harbor Dash' },
    beach: { x: CFG.BEACH_X + 12, z: 0, label: 'Solena Beach' },
    downtown: { x: 0, z: 0, label: 'Downtown' },
  };

  return { colliders, roadLines, half, buildings, buildingMeshes, landmarks, wheel, palmSpots };
}

// Circle vs AABB collision resolve: pushes pos out, returns true if hit.
export function collideCircle(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2), push = radius - d;
        pos.x += (dx / d) * push; pos.z += (dz / d) * push;
      } else {
        // centre inside box: push out along smallest penetration
        const pl = pos.x - c.x0, pr = c.x1 - pos.x, pt = pos.z - c.z0, pb = c.z1 - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.x0 - radius; else if (m === pr) pos.x = c.x1 + radius;
        else if (m === pt) pos.z = c.z0 - radius; else pos.z = c.z1 + radius;
      }
    }
  }
  return hit;
}

export function clampWorld(pos, margin = 4) {
  const W = CFG.WORLD;
  pos.x = Math.max(-W, Math.min(W + 60, pos.x));
  pos.z = Math.max(-W, Math.min(W, pos.z));
}
