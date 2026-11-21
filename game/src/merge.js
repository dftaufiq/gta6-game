// SOLENA BAY — geometry merging. Combines many transformed boxes/cylinders
// into one BufferGeometry, so the city and the cars render in a few dozen
// draw calls instead of hundreds (matters a lot for software WebGL).
import * as THREE from 'three';

// parts: [{ geo, matrix, color }] — color is a hex number or null.
// When every part has a color, the result carries a 'color' attribute
// (use with a vertexColors material).
export function mergeGeoms(parts) {
  let vCount = 0, iCount = 0;
  for (const p of parts) {
    vCount += p.geo.attributes.position.count;
    iCount += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const norm = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const useColor = parts.every((p) => p.color != null);
  const col = useColor ? new Float32Array(vCount * 3) : null;
  const idx = new Uint32Array(iCount);
  let vOff = 0, iOff = 0;
  const c = new THREE.Color();
  for (const p of parts) {
    const g = p.geo.clone().applyMatrix4(p.matrix);
    pos.set(g.attributes.position.array, vOff * 3);
    norm.set(g.attributes.normal.array, vOff * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vOff * 2);
    if (useColor) {
      c.setHex(p.color);
      for (let i = 0; i < g.attributes.position.count; i++) {
        col[(vOff + i) * 3] = c.r; col[(vOff + i) * 3 + 1] = c.g; col[(vOff + i) * 3 + 2] = c.b;
      }
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[iOff + i] = g.index.array[i] + vOff;
      iOff += g.index.count;
    } else {
      for (let i = 0; i < g.attributes.position.count; i++) idx[iOff + i] = vOff + i;
      iOff += g.attributes.position.count;
    }
    vOff += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

export function partMatrix(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  return m;
}

// Shared unit geometries so merging never allocates per part.
export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
export const UNIT_CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
export const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

export function boxPart(x, y, z, w, h, d, color = null, ry = 0) {
  return { geo: UNIT_BOX, matrix: partMatrix(x, y, z, 0, ry, 0, w, h, d), color };
}
export function cylPart(x, y, z, r, h, color = null, rx = 0, rz = 0, seg = 10) {
  const geo = seg === 10 ? UNIT_CYL : new THREE.CylinderGeometry(0.5, 0.5, 1, seg);
  return { geo, matrix: partMatrix(x, y, z, rx, 0, rz, r * 2, h, r * 2), color };
}
export function planePart(x, y, z, w, h, color = null, rx = -Math.PI / 2, ry = 0) {
  return { geo: UNIT_PLANE, matrix: partMatrix(x, y, z, rx, ry, 0, w, h, 1), color };
}
