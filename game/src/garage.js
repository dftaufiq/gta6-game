// SOLENA BAY — the garage at the Respray shop. Spend cash on the car you
// are driving: engine tunes (faster), armour plating (tougher) and a fresh
// paint job that also swaps the plates and clears your wanted level.
// Open with E at the garage; buy with the buttons or keys 1–3, Esc closes.
import { CAR_COLORS } from './config.js';

export const UPGRADES = [
  { id: 'engine', key: '1', name: 'ENGINE TUNE', desc: '+12% top speed & accel per level', max: 3, cost: [400, 800, 1500] },
  { id: 'armour', key: '2', name: 'ARMOUR PLATING', desc: '+50 max health, −15% damage per level', max: 3, cost: [350, 700, 1200] },
  { id: 'paint', key: '3', name: 'RESPRAY + PLATES', desc: 'Fresh paint — clears wanted, repairs car', max: 1, cost: [200] },
];

const PAINT_NAMES = ['Crimson', 'Ocean', 'Taxi Gold', 'Forest', 'Pearl', 'Midnight', 'Steel', 'Violet', 'Sunset', 'Sky'];

export class Garage {
  constructor(G) {
    this.G = G;
    this.open = false;
    this.paintIdx = 0;
    this.el = document.getElementById('garage-panel');
    this.el.querySelector('#garage-close').addEventListener('click', () => this.close());
    this.el.querySelector('#garage-title').textContent = 'BO\u2019S GARAGE — RESPRAY & TUNING';
    this.buildRows();
    this.buildPaints();
  }

  get car() {
    return this.G.player.vehicle;
  }

  buildRows() {
    const wrap = this.el.querySelector('#garage-rows');
    wrap.innerHTML = UPGRADES.map((u) =>
      `<div class="grow"><div class="ginfo"><b>${u.name}</b><i>${u.desc}</i><s id="glevel-${u.id}"></s></div>` +
      `<button class="gbtn" id="gbuy-${u.id}">BUY</button></div>`).join('');
    for (const u of UPGRADES) {
      this.el.querySelector(`#gbuy-${u.id}`).addEventListener('click', () => this.buy(u.id));
    }
  }

  buildPaints() {
    const wrap = this.el.querySelector('#garage-paints');
    wrap.innerHTML = CAR_COLORS.map((c, i) =>
      `<button class="swatch" id="swatch-${i}" title="${PAINT_NAMES[i]}" style="background:#${c.toString(16).padStart(6, '0')}"></button>`).join('');
    CAR_COLORS.forEach((c, i) => {
      this.el.querySelector(`#swatch-${i}`).addEventListener('click', () => {
        this.paintIdx = i;
        this.refresh();
        this.G.audio?.blip();
      });
    });
  }

  level(id) {
    const v = this.car;
    if (!v) return 0;
    if (id === 'paint') return v.repainted ? 1 : 0;
    return v.upgrades?.[id] ?? 0;
  }

  buy(id) {
    const G = this.G, v = this.car;
    if (!v) return;
    const u = UPGRADES.find((x) => x.id === id);
    const lvl = this.level(id);
    if (lvl >= u.max) { G.hud?.showToast(`${u.name} is already maxed out`); return; }
    const price = u.cost[lvl];
    if (G.player.money < price) { G.hud?.showToast(`Not enough cash — ${u.name} costs $${price}`); return; }
    G.player.money -= price;
    if (id === 'engine') {
      v.upgrades.engine = lvl + 1;
      G.hud?.showToast(`Engine tune level ${lvl + 1} — she pulls harder now`);
    } else if (id === 'armour') {
      v.upgrades.armour = lvl + 1;
      v.maxHealth = 100 + 50 * (lvl + 1);
      v.health = v.maxHealth;
      G.hud?.showToast(`Armour plating level ${lvl + 1} — built like a tank`);
    } else if (id === 'paint') {
      v.repainted = true;
      G.vehicles.repaint(v, CAR_COLORS[this.paintIdx]);
      G.police.clearWanted();
      v.health = v.maxHealth ?? 100;
      v.smoking = false;
      if (v.smokeMesh) { v.mesh.remove(v.smokeMesh); v.smokeMesh = null; }
      G.hud?.showToast(`Fresh ${PAINT_NAMES[this.paintIdx]} paint, fresh plates — the SPD lost you`);
    }
    G.audio?.jingle();
    this.refresh();
  }

  refresh() {
    const v = this.car;
    const G = this.G;
    this.el.querySelector('#garage-car').textContent =
      v ? `${v.name.toUpperCase()} · ${Math.max(0, Math.round(v.health))}/${v.maxHealth ?? 100} HP` : 'NO CAR';
    this.el.querySelector('#garage-money').textContent = `$${G.player.money.toLocaleString('en-US')}`;
    for (const u of UPGRADES) {
      const lvl = this.level(u.id);
      const btn = this.el.querySelector(`#gbuy-${u.id}`);
      const lvlEl = this.el.querySelector(`#glevel-${u.id}`);
      lvlEl.textContent = u.id === 'paint'
        ? (lvl ? 'PAINTED' : `PAINT: ${PAINT_NAMES[this.paintIdx].toUpperCase()}`)
        : `LEVEL ${lvl}/${u.max}`;
      if (lvl >= u.max) { btn.textContent = 'MAXED'; btn.disabled = true; }
      else {
        btn.textContent = `$${u.cost[lvl]} · [${u.key}]`;
        btn.disabled = G.player.money < u.cost[lvl];
      }
    }
    CAR_COLORS.forEach((c, i) => {
      this.el.querySelector(`#swatch-${i}`).classList.toggle('sel', i === this.paintIdx);
    });
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    if (!this.car) { this.G.hud?.showToast('Drive a car into the garage first'); return; }
    this.open = true;
    this.refresh();
    this.el.classList.add('show');
    document.exitPointerLock?.();
  }

  close() {
    this.open = false;
    this.el.classList.remove('show');
  }

  // Keys 1–3 buy while the panel is open; Esc or E closes.
  handleKey(code) {
    if (code === 'Escape' || code === 'KeyE') { this.close(); return true; }
    const u = UPGRADES.find((x) => code === 'Digit' + x.key);
    if (u) { this.buy(u.id); return true; }
    return false;
  }
}
