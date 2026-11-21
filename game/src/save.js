// SOLENA BAY — save/load via localStorage.
import { CFG } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      v: 1,
      money: G.player.money,
      respect: G.player.respect,
      missionsDone: G.missions.done,
      weaponIdx: G.player.weaponIdx,
      ammo: G.player.ammo,
      health: G.player.health,
      armour: G.player.armour,
      x: G.player.pos.x, z: G.player.pos.z,
      timeMin: G.timeMin,
      radioIdx: G.radioIdx,
    };
    localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CFG.SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.v === 1 ? d : null;
  } catch { return null; }
}

export function applySave(G, d) {
  G.player.money = d.money;
  G.player.respect = d.respect;
  G.missions.done = d.missionsDone;
  G.player.weaponIdx = d.weaponIdx;
  G.player.ammo = d.ammo;
  G.player.health = d.health;
  G.player.armour = d.armour;
  G.player.pos.set(d.x, 0, d.z);
  G.timeMin = d.timeMin;
  G.radioIdx = d.radioIdx ?? 0;
}

export function clearSave() {
  try { localStorage.removeItem(CFG.SAVE_KEY); } catch { /* ignore */ }
}
