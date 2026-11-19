// input.js — keyboard state plus pointer-lock mouse look.
// Keys are tracked by code so the layout is the same on every keyboard; the
// game polls `down('KeyW')` style queries each frame and consumes one-shot
// presses through `pressed(...)` so menus and doors do not retrigger.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.consumed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.consumed.delete(e.code);
    });
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('click', () => {
      if (!this.locked) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  pressed(code) {
    if (this.keys.has(code) && !this.consumed.has(code)) {
      this.consumed.add(code);
      return true;
    }
    return false;
  }

  takeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }
}
