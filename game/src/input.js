// SOLENA BAY — keyboard + mouse input. Pointer lock when available, drag-to-look
// as fallback (works in headless browsers too).
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, cleared each frame
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.mouseClicked = false;
    this.wheel = 0;
    this.locked = false;
    this.dragging = false;
    this.lastX = 0; this.lastY = 0;
    this.onKey = null; // (code) => void, for menu keys

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (this.onKey) this.onKey(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
      else if (this.dragging) {
        this.mouseDX += e.clientX - this.lastX; this.mouseDY += e.clientY - this.lastY;
        this.lastX = e.clientX; this.lastY = e.clientY;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true; this.mouseClicked = true;
      this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY;
      if (!this.locked && document.pointerLockElement == null) {
        canvas.requestPointerLock?.();
      }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; this.dragging = false; });
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  // WASD axis in camera space: x = strafe right, y = forward
  axis() {
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    return { x, y };
  }
  consumeMouse() { const r = { dx: this.mouseDX, dy: this.mouseDY }; this.mouseDX = 0; this.mouseDY = 0; return r; }
  endFrame() { this.pressed.clear(); this.mouseClicked = false; this.wheel = 0; }
}
