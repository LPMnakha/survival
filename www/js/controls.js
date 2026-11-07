// Déplacement à la première personne : clavier/souris sur ordinateur,
// joystick (gauche) + glisser pour regarder (droite) sur écran tactile.
import * as THREE from '../vendor/three.module.min.js';

export function createControls(camera, dom, colliders, { eye = 1.6, radius = 0.28, start = { x: 0, z: 0, yaw: 0, pitch: -0.1 } } = {}) {
  const st = {
    pos: new THREE.Vector3(start.x, eye, start.z),
    yaw: start.yaw, // 0 = regarde vers -z (nord)
    pitch: start.pitch,
    vel: new THREE.Vector3(),
    keys: new Set(),
    joy: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
    look: { id: null, lx: 0, ly: 0 },
    enabled: false,
  };
  const SPEED = 1.7, LOOK = 0.0042;

  // ---------- clavier ----------
  const KEYMAP = { KeyW: 'f', KeyZ: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', KeyQ: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  addEventListener('keydown', (e) => { if (KEYMAP[e.code]) { st.keys.add(KEYMAP[e.code]); e.preventDefault(); } });
  addEventListener('keyup', (e) => { if (KEYMAP[e.code]) st.keys.delete(KEYMAP[e.code]); });
  addEventListener('blur', () => st.keys.clear());

  // ---------- pointeurs (souris + tactile) ----------
  const joyBase = document.getElementById('joy');
  const joyKnob = document.getElementById('joy-knob');
  const JR = 52; // rayon du joystick en px

  dom.addEventListener('pointerdown', (e) => {
    if (!st.enabled) return;
    const touch = e.pointerType !== 'mouse';
    if (touch && e.clientX < innerWidth * 0.45 && st.joy.id === null) {
      st.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
      joyBase.style.left = e.clientX + 'px';
      joyBase.style.top = e.clientY + 'px';
      joyBase.classList.add('on');
      joyKnob.style.transform = 'translate(-50%,-50%)';
    } else if (st.look.id === null) {
      st.look = { id: e.pointerId, lx: e.clientX, ly: e.clientY };
    }
    dom.setPointerCapture?.(e.pointerId);
  });
  dom.addEventListener('pointermove', (e) => {
    if (e.pointerId === st.joy.id) {
      let dx = e.clientX - st.joy.ox, dy = e.clientY - st.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > JR) { dx *= JR / d; dy *= JR / d; }
      st.joy.x = dx / JR;
      st.joy.y = dy / JR;
      joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else if (e.pointerId === st.look.id) {
      const k = e.pointerType === 'mouse' ? LOOK : LOOK * 1.25;
      st.yaw -= (e.clientX - st.look.lx) * k;
      st.pitch -= (e.clientY - st.look.ly) * k;
      st.pitch = Math.max(-1.25, Math.min(1.25, st.pitch));
      st.look.lx = e.clientX;
      st.look.ly = e.clientY;
    }
  });
  const end = (e) => {
    if (e.pointerId === st.joy.id) {
      st.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
      joyBase.classList.remove('on');
    }
    if (e.pointerId === st.look.id) st.look.id = null;
  };
  dom.addEventListener('pointerup', end);
  dom.addEventListener('pointercancel', end);
  dom.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- collisions ----------
  function collide(p) {
    for (let pass = 0; pass < 3; pass++) {
      for (const c of colliders) {
        const x0 = c.x0 - radius, x1 = c.x1 + radius, z0 = c.z0 - radius, z1 = c.z1 + radius;
        if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) {
          const dl = p.x - x0, dr = x1 - p.x, dt = p.z - z0, db = z1 - p.z;
          const m = Math.min(dl, dr, dt, db);
          if (m === dl) p.x = x0; else if (m === dr) p.x = x1; else if (m === dt) p.z = z0; else p.z = z1;
        }
      }
    }
  }

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), want = new THREE.Vector3();
  function update(dt) {
    let f = 0, s = 0;
    if (st.enabled) {
      if (st.keys.has('f')) f += 1;
      if (st.keys.has('b')) f -= 1;
      if (st.keys.has('r')) s += 1;
      if (st.keys.has('l')) s -= 1;
      if (st.joy.id !== null) { f -= st.joy.y; s += st.joy.x; }
    }
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    fwd.set(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
    right.set(Math.cos(st.yaw), 0, -Math.sin(st.yaw));
    want.copy(fwd).multiplyScalar(f * SPEED).addScaledVector(right, s * SPEED);
    // accélération douce, pas d'à-coups
    st.vel.lerp(want, 1 - Math.exp(-dt * 7));
    st.pos.addScaledVector(st.vel, dt);
    collide(st.pos);
    // on reste dans la zone de promenade, et on suit le terrain
    if (world.clamp) world.clamp(st.pos);
    const gy = world.ground ? world.ground(st.pos.x, st.pos.z) : 0;
    st.groundY = st.groundY === undefined ? gy : st.groundY + (gy - st.groundY) * (1 - Math.exp(-dt * 9));
    st.pos.y = eye + st.groundY;
    camera.position.copy(st.pos);
    camera.rotation.set(st.pitch, st.yaw, 0, 'YXZ');
  }

  const world = {};
  return { update, state: st, setWorld(w) { Object.assign(world, w); }, groundAt: (x, z) => (world.ground ? world.ground(x, z) : 0) };
}
