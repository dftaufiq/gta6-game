// SOLENA BAY — HUD: mission + police panels, minimap, speedometer, dialogue,
// banners, toasts, and the start/pause/wasted/busted screens.
import { CHARACTERS, RADIO, WEAPONS, rankFor } from './config.js';
import { districtAt } from './city.js';
import { portraitTexture } from './textures.js';

const $ = (id) => document.getElementById(id);
const TRACKS = ['Golden Hour Drive', 'Palms at Dusk', 'Neon Tide', 'Marina Lights', 'Heatwave Run', 'Coconut Radio'];

export class HUD {
  constructor(G) {
    this.G = G;
    this.el = {};
    for (const id of ['mission-panel', 'mission-title', 'mission-stage', 'mission-text', 'mission-timer',
      'mission-next', 'police-panel', 'police-units', 'police-count', 'clock', 'money', 'stars',
      'rank-name', 'rank-bar', 'rank-rp', 'weapon-slots', 'crew-cards', 'minimap', 'health-bar',
      'health-num', 'armour-bar', 'armour-num', 'location', 'speed-num', 'vehicle-name',
      'vehicle-cond', 'vehicle-cond-bar', 'radio-name', 'radio-track', 'dialogue', 'dialogue-portrait',
      'dialogue-name', 'dialogue-text', 'banner', 'banner-title', 'banner-sub', 'toast', 'prompt',
      'damage-flash', 'crosshair', 'start-screen', 'pause-menu', 'wasted-screen', 'busted-screen',
      'continue-btn', 'wanted-label']) this.el[id] = $(id);
    this.portraits = {};
    for (const [k, ch] of Object.entries(CHARACTERS)) this.portraits[k] = portraitTexture(ch).image.toDataURL();
    this.dialogueT = 0; this.bannerT = 0; this.toastT = 0; this.flashT = 0;
    this.buildWeaponSlots();
    this.buildCrewCards();
    this.buildMinimapBase(G);
    this.trackIdx = 0; this.trackT = 0;
  }

  buildWeaponSlots() {
    this.el['weapon-slots'].innerHTML = WEAPONS.map((w, i) =>
      `<div class="wslot" id="wslot-${i}"><span class="wkey">${i + 1}</span><span class="wname">${w.name}</span><span class="wammo" id="wammo-${i}"></span></div>`).join('');
  }

  buildCrewCards() {
    const crew = [
      { key: 'Z', name: 'SWAP PLATES', who: 'Tess · Driver', desc: 'Lose 1 wanted star' },
      { key: 'X', name: 'QUICK FIX', who: 'Bo · Mechanic', desc: 'Repair your car' },
      { key: 'C', name: 'EYES OUT', who: 'Ivy · Lookout', desc: 'Reveal all cops 20s' },
    ];
    this.el['crew-cards'].innerHTML = crew.map((c, i) =>
      `<div class="crew" id="crew-${i}"><span class="ckey">${c.key}</span><div><b>${c.name}</b><i>${c.who}</i><s>${c.desc}</s></div><div class="cd" id="crew-cd-${i}"></div></div>`).join('');
  }

  buildMinimapBase(G) {
    const c = document.createElement('canvas');
    c.width = c.height = 220;
    const g = c.getContext('2d');
    const S = 220 / 780, OX = 380, OZ = 340; // world -> map px
    const X = (x) => (x + OX) * S, Y = (z) => (z + OZ) * S;
    g.fillStyle = '#5d6b52'; g.fillRect(0, 0, 220, 220); // ground
    g.fillStyle = '#2a7f9e'; g.fillRect(X(285), 0, 220 - X(285), 220); // ocean
    g.fillStyle = '#e8d5a8'; g.fillRect(X(225), 0, X(285) - X(225), 220); // beach
    // blocks
    g.fillStyle = '#8a7a66';
    const half = G.city.half;
    for (let bi = 0; bi < 7; bi++) for (let bj = 0; bj < 7; bj++) {
      const cx = -half + bi * 62 + 31, cz = -half + bj * 62 + 31;
      g.fillRect(X(cx - 23), Y(cz - 23), 46 * S, 46 * S);
    }
    // roads
    g.strokeStyle = '#3a3d42'; g.lineWidth = 16 * S;
    for (const r of G.city.roadLines) {
      g.beginPath(); g.moveTo(X(-340), Y(r)); g.lineTo(X(340), Y(r)); g.stroke();
      g.beginPath(); g.moveTo(X(r), Y(-340)); g.lineTo(X(r), Y(340)); g.stroke();
    }
    this.mapBase = c; this.mapS = S; this.mapOX = OX; this.mapOZ = OZ;
  }

  mapX(x) { return (x + this.mapOX) * this.mapS; }
  mapY(z) { return (z + this.mapOZ) * this.mapS; }

  showDialogue(who, text, dur = 5) {
    const ch = CHARACTERS[who] ?? CHARACTERS.KAI;
    this.el['dialogue-portrait'].src = this.portraits[who] ?? this.portraits.KAI;
    this.el['dialogue-name'].textContent = `${ch.name} · ${ch.role}`;
    this.el['dialogue-text'].textContent = text;
    this.el.dialogue.classList.add('show');
    this.dialogueT = dur;
  }

  showBanner(title, sub, dur = 3) {
    this.el['banner-title'].textContent = title;
    this.el['banner-sub'].textContent = sub;
    this.el.banner.classList.add('show');
    this.bannerT = dur;
  }

  showToast(text, dur = 3) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this.toastT = dur;
  }

  showPrompt(text) {
    if (text) { this.el.prompt.textContent = text; this.el.prompt.classList.add('show'); }
    else this.el.prompt.classList.remove('show');
  }

  showDamageFlash() { this.flashT = 0.45; this.el['damage-flash'].style.opacity = 0.55; }

  flashWanted(n) {
    this.el.stars.classList.remove('flash');
    void this.el.stars.offsetWidth;
    this.el.stars.classList.add('flash');
    this.el['wanted-label'].textContent = n > 0 ? 'WANTED' : '';
  }

  setCrewCooldown(i, frac) {
    const cd = $('crew-cd-' + i);
    if (cd) cd.style.height = `${Math.round(frac * 100)}%`;
  }

  update(dt, G) {
    // timers
    if (this.dialogueT > 0) { this.dialogueT -= dt; if (this.dialogueT <= 0) this.el.dialogue.classList.remove('show'); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.el.banner.classList.remove('show'); }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el.toast.classList.remove('show'); }
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.el['damage-flash'].style.opacity = Math.max(0, this.flashT * 1.2);
    }
    // clock + money + stars
    const mins = Math.floor(G.timeMin) % (24 * 60);
    this.el.clock.textContent = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    this.el.money.textContent = '$' + G.player.money.toLocaleString('en-US');
    const w = G.police.wanted;
    this.el.stars.innerHTML = [1, 2, 3, 4, 5].map((i) =>
      `<span class="${i <= w ? 'on' : ''}">★</span>`).join('');
    this.el['wanted-label'].textContent = w > 0 ? (G.police.inSight ? 'WANTED · IN SIGHT' : 'WANTED · HIDDEN') : '';
    // rank
    const rank = rankFor(G.player.respect);
    const next = { NOBODY: 200, 'ERRAND BOY': 500, WHEELMAN: 1000, FIXER: 1800, 'SHOT CALLER': 3000, 'BAY LEGEND': 3000 }[rank.name];
    this.el['rank-name'].textContent = rank.name;
    this.el['rank-rp'].textContent = `${G.player.respect} / ${next} RP`;
    this.el['rank-bar'].style.width = `${Math.min(100, (G.player.respect / next) * 100)}%`;
    // mission panel
    const mp = G.missions.panel();
    this.el['mission-title'].textContent = mp.title;
    this.el['mission-stage'].textContent = mp.stage;
    this.el['mission-text'].textContent = mp.text;
    this.el['mission-timer'].textContent = mp.timer != null ? `⏱ ${Math.floor(mp.timer / 60)}:${String(mp.timer % 60).padStart(2, '0')}` : '';
    this.el['mission-next'].innerHTML = `<b>NEXT</b> ${mp.next}`;
    // police panel
    const rows = G.police.unitRows();
    this.el['police-panel'].style.display = w > 0 ? 'block' : 'none';
    if (w > 0) {
      this.el['police-count'].textContent = `${rows.length} UNIT${rows.length === 1 ? '' : 'S'} · CODE ${w}`;
      this.el['police-units'].innerHTML = rows.map((r) =>
        `<div><i>▲</i><b>${r.name}</b><s>${r.status}</s><span>${r.dist} m</span></div>`).join('');
    }
    // weapons
    for (let i = 0; i < 4; i++) {
      const slot = $('wslot-' + i), ammo = $('wammo-' + i);
      slot.classList.toggle('active', i === G.player.weaponIdx);
      const wp = WEAPONS[i];
      ammo.textContent = wp.id === 'fists' ? '∞' : `${G.player.ammo[wp.id].mag} / ${G.player.ammo[wp.id].reserve}`;
    }
    // health / armour
    this.el['health-bar'].style.width = `${G.player.health}%`;
    this.el['health-num'].textContent = Math.ceil(G.player.health);
    this.el['armour-bar'].style.width = `${G.player.armour}%`;
    this.el['armour-num'].textContent = Math.ceil(G.player.armour);
    // location + speedo
    this.el.location.textContent = districtAt(G.player.pos.x, G.player.pos.z);
    const v = G.player.vehicle;
    this.el['speed-num'].textContent = Math.round(G.player.speedKmh);
    this.el['vehicle-name'].textContent = v ? v.name.toUpperCase() : 'ON FOOT';
    this.el['vehicle-cond'].textContent = v ? `${Math.max(0, Math.round(v.health))}% CONDITION` : 'KAI REYES';
    this.el['vehicle-cond-bar'].style.width = v ? `${Math.max(0, v.health)}%` : '100%';
    this.el.crosshair.style.display = (!v && G.mode === 'play' && G.player.weaponIdx > 0) ? 'block' : 'none';
    // radio
    this.trackT -= dt;
    if (this.trackT <= 0) { this.trackT = 22; this.trackIdx = (this.trackIdx + 1) % TRACKS.length; }
    const st = RADIO[G.radioIdx];
    this.el['radio-name'].textContent = `♪ ${st.name} — ${st.genre}`;
    this.el['radio-track'].textContent = TRACKS[this.trackIdx];
    this.drawMinimap(G);
  }

  drawMinimap(G) {
    const cv = this.el.minimap, g = cv.getContext('2d');
    g.clearRect(0, 0, 220, 220);
    g.save();
    g.beginPath(); g.arc(110, 110, 108, 0, Math.PI * 2); g.clip();
    g.drawImage(this.mapBase, 0, 0);
    const now = performance.now() / 1000;
    // shops
    const L = G.city.landmarks;
    const shops = [
      { p: L.safehouse, c: '#ffd23d', t: 'M' }, { p: L.respray, c: '#2f9e4f', t: 'S' },
      { p: L.gunshop, c: '#ba68c8', t: 'G' }, { p: L.raceStart, c: '#ff7a1a', t: 'R' },
      { p: L.pier, c: '#4fc3f7', t: 'P' },
    ];
    g.font = 'bold 11px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const s of shops) {
      g.fillStyle = s.c;
      g.beginPath(); g.arc(this.mapX(s.p.x), this.mapY(s.p.z), 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#111'; g.fillText(s.t, this.mapX(s.p.x), this.mapY(s.p.z));
    }
    // mission marker (pulsing diamond)
    const mp = G.missions.markerPos;
    if (mp) {
      const x = this.mapX(mp.x), y = this.mapY(mp.z), r = 7 + Math.sin(now * 4) * 2;
      g.fillStyle = '#ffd23d';
      g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill();
      g.strokeStyle = '#111'; g.lineWidth = 1.5; g.stroke();
    }
    // cops (flashing)
    if (G.police.wanted > 0 || G.eyesOutT > 0) {
      const col = Math.sin(now * 8) > 0 ? '#ff2a2a' : '#2a6bff';
      g.fillStyle = col;
      for (const c of [...G.police.cops, ...G.police.roadblocks]) {
        if (c.dead) continue;
        g.beginPath(); g.arc(this.mapX(c.mesh.position.x), this.mapY(c.mesh.position.z), 4, 0, Math.PI * 2); g.fill();
      }
      if (G.police.heli) {
        g.fillStyle = '#ff2a2a';
        g.beginPath(); g.arc(this.mapX(G.police.heli.mesh.position.x), this.mapY(G.police.heli.mesh.position.z), 5, 0, Math.PI * 2); g.fill();
      }
    }
    // enemies
    g.fillStyle = '#ff2020';
    for (const e of G.combat.enemies) {
      if (e.health <= 0) continue;
      g.fillRect(this.mapX(e.mesh.position.x) - 2, this.mapY(e.mesh.position.z) - 2, 4, 4);
    }
    // player arrow
    const px = this.mapX(G.player.pos.x), py = this.mapY(G.player.pos.z);
    const yaw = G.player.vehicle ? G.player.vehicle.yaw : G.player.yaw;
    g.save();
    g.translate(px, py); g.rotate(Math.PI - yaw);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#111'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath();
    g.fill(); g.stroke();
    g.restore();
    g.restore();
    // north marker
    g.fillStyle = '#fff'; g.font = 'bold 12px Arial'; g.textAlign = 'center';
    g.fillText('N', 110, 14);
  }

  showScreen(name) {
    for (const s of ['start-screen', 'pause-menu', 'wasted-screen', 'busted-screen']) {
      this.el[s].classList.toggle('show', s === name);
    }
    document.getElementById('hud').style.display = (name === 'start-screen') ? 'none' : 'block';
  }
  hideScreens() {
    for (const s of ['start-screen', 'pause-menu', 'wasted-screen', 'busted-screen']) this.el[s].classList.remove('show');
    document.getElementById('hud').style.display = 'block';
  }
}
