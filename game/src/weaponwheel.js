// SOLENA BAY — the weapon wheel. Hold Q to open the radial picker, point
// the mouse at a weapon (or press 1–5), release Q to draw it. Clicking a
// segment picks it at once.
import { WEAPONS } from './config.js';

export class WeaponWheel {
  constructor(G) {
    this.G = G;
    this.open = false;
    this.sel = 0;
    this.mx = 0; this.my = 0;
    this.el = document.getElementById('weapon-wheel');
    this.centerName = this.el.querySelector('#wheel-name');
    this.centerAmmo = this.el.querySelector('#wheel-ammo');
    const n = WEAPONS.length;
    this.el.querySelector('#wheel-segs').innerHTML = WEAPONS.map((w, i) => {
      const a = -90 + (i * 360) / n;
      return `<div class="wseg" id="wseg-${i}" style="transform:rotate(${a}deg) translateY(-118px) rotate(${-a}deg)">` +
        `<b>${w.icon}</b><span>${w.name}</span><s id="wseg-ammo-${i}"></s></div>`;
    }).join('');
    WEAPONS.forEach((w, i) => {
      this.el.querySelector(`#wseg-${i}`).addEventListener('click', () => {
        this.sel = i;
        this.confirm();
      });
    });
    window.addEventListener('mousemove', (e) => { this.mx = e.clientX; this.my = e.clientY; });
  }

  ammoText(w) {
    if (w.id === 'fists') return '∞';
    const a = this.G.player.ammo[w.id];
    return `${a.mag} / ${a.reserve}`;
  }

  show() {
    this.open = true;
    this.sel = this.G.player.weaponIdx;
    this.el.classList.add('show');
    document.exitPointerLock?.();
    this.render();
  }

  confirm() {
    this.open = false;
    this.G.player.weaponIdx = this.sel;
    this.el.classList.remove('show');
    this.G.audio?.blip();
  }

  render() {
    WEAPONS.forEach((w, i) => {
      this.el.querySelector(`#wseg-${i}`).classList.toggle('sel', i === this.sel);
      this.el.querySelector(`#wseg-ammo-${i}`).textContent = this.ammoText(w);
    });
    const w = WEAPONS[this.sel];
    this.centerName.textContent = w.name;
    this.centerAmmo.textContent = this.ammoText(w);
  }

  update() {
    const G = this.G;
    const q = G.input.down('KeyQ');
    if (q && !this.open && G.mode === 'play' && !G.garage?.open) this.show();
    else if (!q && this.open) this.confirm();
    if (!this.open) return;
    // number keys switch directly while the wheel is open
    if (G.player.weaponIdx !== this.sel) { this.sel = G.player.weaponIdx; this.render(); return; }
    // mouse angle picks a segment (dead zone near the centre keeps the pick)
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const dx = this.mx - cx, dy = this.my - cy;
    if (Math.hypot(dx, dy) < 45) return;
    const n = WEAPONS.length;
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (ang < 0) ang += 360;
    const i = Math.round(ang / (360 / n)) % n;
    if (i !== this.sel) { this.sel = i; this.render(); }
  }
}
