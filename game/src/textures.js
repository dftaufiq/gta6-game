// SOLENA BAY — procedural canvas textures. No external images: every texture
// is painted in code (facades, asphalt, sand, signs, sky, portraits).
import * as THREE from 'three';
import { mulberry32, range } from './config.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}

// Building facade: warm stucco + lit window grid, golden-hour glow.
export function facadeTexture(seed, base, floors, cols) {
  const rng = mulberry32(seed);
  const [c, g] = canvas(128, 256);
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  // subtle vertical grime
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(0,0,0,${0.03 + rng() * 0.05})`;
    g.fillRect(rng() * 128, 0, 2 + rng() * 6, 256);
  }
  const fh = 256 / floors, fw = 128 / cols;
  for (let f = 0; f < floors; f++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng() < 0.45;
      const x = col * fw + fw * 0.2, y = f * fh + fh * 0.25;
      g.fillStyle = lit ? (rng() < 0.5 ? '#ffd98a' : '#ffeec2') : '#2c3a4a';
      g.fillRect(x, y, fw * 0.6, fh * 0.5);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, fw * 0.6, 2);
    }
  }
  // roofline + ground floor awning
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 128, 6);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 240, 128, 16);
  return toTexture(c);
}

export function asphaltTexture() {
  const rng = mulberry32(77);
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#33363b'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    g.fillRect(rng() * 128, rng() * 128, 2, 2);
  }
  return toTexture(c, [24, 24]);
}

export function sidewalkTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#9a938a'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke();
  }
  return toTexture(c, [8, 8]);
}

export function sandTexture() {
  const rng = mulberry32(9);
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#e8d5a8'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = rng() < 0.5 ? 'rgba(180,150,90,0.35)' : 'rgba(255,245,220,0.4)';
    g.fillRect(rng() * 128, rng() * 128, 2, 2);
  }
  return toTexture(c, [12, 12]);
}

export function waterTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#1f7ea6'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 10 + Math.random() * 22, 2);
  }
  return toTexture(c, [10, 10]);
}

// Vertical sunset gradient used as the scene background.
export function skyTexture() {
  const [c, g] = canvas(4, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2e4a7a');
  grad.addColorStop(0.45, '#7a5a9a');
  grad.addColorStop(0.68, '#e8785a');
  grad.addColorStop(0.85, '#ffb36b');
  grad.addColorStop(1, '#ffd98a');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// A shop sign painted on canvas: bold text on a coloured board.
export function signTexture(text, bg, fg, sub) {
  const [c, g] = canvas(512, 128);
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg;
  g.font = 'bold 54px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, sub ? 52 : 64);
  if (sub) { g.font = 'bold 28px Arial, sans-serif'; g.fillText(sub, 256, 100); }
  return toTexture(c);
}

// Tiny pixel portrait for the dialogue box.
export function portraitTexture(ch) {
  const [c, g] = canvas(64, 64);
  g.fillStyle = ch.color; g.fillRect(0, 0, 64, 64);
  g.fillStyle = ch.skin;
  g.fillRect(20, 18, 24, 28); // face
  g.fillStyle = ch.hair;
  g.fillRect(18, 10, 28, 12); // hair
  g.fillStyle = '#111';
  g.fillRect(25, 28, 5, 5); g.fillRect(35, 28, 5, 5); // eyes
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(27, 40, 10, 3); // mouth
  g.fillStyle = 'rgba(255,255,255,0.2)';
  g.fillRect(0, 0, 64, 4);
  return toTexture(c);
}

// Soft radial glow sprite (muzzle flash, sun glare, marker glow).
export function glowTexture() {
  const [c, g] = canvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,220,120,0.6)');
  grad.addColorStop(1, 'rgba(255,200,80,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return toTexture(c);
}

export function palmFrondTexture() {
  const [c, g] = canvas(64, 64);
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = '#2f9e4f'; g.lineWidth = 5; g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.beginPath(); g.moveTo(32, 32);
    g.quadraticCurveTo(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18 - 6, 32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30 + 6);
    g.stroke();
  }
  const t = toTexture(c);
  return t;
}

export { range };
