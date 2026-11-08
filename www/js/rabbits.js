// Lapins : ils broutent, sautillent, lèvent la tête. Quand on approche, ils se
// figent un instant puis détalent en zigzag, trois fois plus vite que nous.
// Un lapin tué reste au sol : on récupère la lance, on le dépèce au couteau.
// Laissé 2 jours, il pourrit et disparaît. Un nouveau lapin apparaît ailleurs
// un jour après chaque mort.
import * as THREE from '../vendor/three.module.min.js';
import { makeNoise } from './noise.js';
import { mergeColored } from './builder.js';

const N = 200, DAY = 864e5, ROT = 2 * DAY, RESPAWN = DAY;
const SEE = 12, FLEE_SPEED = 5.5, HOP_SPEED = 0.9, ACTIVE = 110;

function rabbitGeometry() {
  const fur = 0x8a7660, dark = 0x6e5c48, light = 0xd9cfbf;
  const ear = (s) => new THREE.ConeGeometry(0.022, 0.13, 4).scale(1, 1, 0.45).rotateX(-0.25).rotateZ(s * 0.18).translate(s * 0.03, 0.27, 0.11);
  return mergeColored([
    [new THREE.IcosahedronGeometry(0.12, 1).scale(0.85, 0.8, 1.25).translate(0, 0.12, -0.02), fur], // corps
    [new THREE.IcosahedronGeometry(0.09, 0).scale(1, 0.9, 1).translate(0, 0.1, -0.11), dark], // arrière-train
    [new THREE.IcosahedronGeometry(0.065, 1).scale(0.9, 0.9, 1.15).translate(0, 0.2, 0.12), fur], // tête
    [new THREE.IcosahedronGeometry(0.02, 0).translate(0, 0.19, 0.19), light], // museau
    [ear(-1), dark], [ear(1), dark],
    [new THREE.IcosahedronGeometry(0.035, 0).translate(0, 0.14, -0.17), 0xf1ece4], // queue blanche
    [new THREE.IcosahedronGeometry(0.03, 0).scale(1, 0.6, 1.8).translate(-0.06, 0.03, -0.06), dark], // pattes arrière
    [new THREE.IcosahedronGeometry(0.03, 0).scale(1, 0.6, 1.8).translate(0.06, 0.03, -0.06), dark],
    [new THREE.IcosahedronGeometry(0.016, 0).translate(-0.035, 0.22, 0.165), 0x1e1814], // yeux
    [new THREE.IcosahedronGeometry(0.016, 0).translate(0.035, 0.22, 0.165), 0x1e1814],
  ]);
}

export function createRabbits(scene, { forest, saved, onChange }) {
  const R = makeNoise(97).rnd;
  const sp = forest.spawn;
  const ok = (x, z) => forest.inWalk(x, z, -4) && forest.streamDist(x, z) > 2.2 && !forest.blocked(x, z, 0.25) && !forest.nearSite(x, z, 1);
  // où naissent les lapins : clairières et lisières surtout
  function place(far = null) {
    for (let g = 0; g < 400; g++) {
      const x = (R() * 2 - 1) * 390, z = (R() * 2 - 1) * 390;
      if (!ok(x, z)) continue;
      if (far && Math.hypot(x - far.x, z - far.z) < 60) continue;
      const cl = forest.clearingAt(x, z);
      if (R() > (cl > 0.1 ? 1 : 0.15)) continue;
      return { x, z };
    }
    return { x: sp.x + 20, z: sp.z + 20 };
  }
  const list = [];
  for (let i = 0; i < N; i++) {
    let p;
    if (i < 3) { // quelques-uns pas trop loin du départ
      for (let g = 0; g < 200; g++) { const a = R() * 6.28, r = 25 + R() * 25; const x = sp.x + Math.cos(a) * r, z = sp.z + Math.sin(a) * r; if (ok(x, z)) { p = { x, z }; break; } }
    }
    p = p || place();
    list.push({ id: i, x: p.x, z: p.z, ry: R() * 6.28, state: 'graze', t: 1 + R() * 4, phase: R() * 6.28, hop: 0, alive: true, dead: null, away: null });
  }
  // état sauvegardé : lapins morts, lapins à faire réapparaître
  const now0 = Date.now();
  for (const d of (saved && saved.dead) || []) {
    const r = list[d.id];
    if (!r || !Number.isFinite(d.x) || now0 - d.at > ROT) continue;
    Object.assign(r, { alive: false, x: d.x, z: d.z, ry: d.ry || 0, dead: { at: d.at } });
  }
  let pending = ((saved && saved.pending) || []).filter((p) => list[p.id]);
  for (const p of pending) if (list[p.id].alive) list[p.id].alive = false, (list[p.id].gone = true);

  // ------------------------------------------------------------------ dessin (une seule géométrie instanciée)
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const mesh = new THREE.InstancedMesh(rabbitGeometry(), mat, N);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function draw(r, player) {
    if (r.gone || Math.hypot(r.x - player.x, r.z - player.z) > 140) { mesh.setMatrixAt(r.id, zero); return; }
    const gy = forest.surfaceY(r.x, r.z);
    if (r.dead) {
      e.set(0, r.ry, Math.PI / 2 * 0.92);
      m4.compose(v3.set(r.x, gy + 0.11, r.z), q.setFromEuler(e), one);
    } else {
      const lift = Math.abs(Math.sin(r.hop)) * (r.state === 'flee' ? 0.22 : 0.08);
      const pitch = r.state === 'flee' || r.state === 'hop' ? -Math.cos(r.hop) * 0.25 : r.state === 'alert' ? -0.25 : Math.sin(r.phase) * 0.05 + 0.1;
      e.set(pitch, r.ry, 0);
      m4.compose(v3.set(r.x, gy + lift, r.z), q.setFromEuler(e), one);
    }
    mesh.setMatrixAt(r.id, m4);
  }

  // ------------------------------------------------------------------ comportement
  const free = (x, z) => forest.inWalk(x, z, -2) && forest.streamDist(x, z) > 1.9 && !forest.blocked(x, z, 0.15);
  function step(r, speed, dt) {
    for (let k = 0; k < 6; k++) {
      const nx = r.x + Math.sin(r.ry) * speed * dt, nz = r.z + Math.cos(r.ry) * speed * dt;
      if (free(nx, nz)) { r.x = nx; r.z = nz; return true; }
      r.ry += (k % 2 ? -1 : 1) * (0.8 + k * 0.4); // obstacle : on contourne
    }
    return false;
  }
  function think(r, dt, player) {
    const d = Math.hypot(player.x - r.x, player.z - r.z);
    r.phase += dt * 2;
    if (r.state !== 'flee' && r.state !== 'alert' && d < SEE) {
      r.state = 'alert'; r.t = 0.8 + R() * 0.8; r.hop = 0;
      r.ry = Math.atan2(player.x - r.x, player.z - r.z); // il regarde ce qui approche
      return;
    }
    r.t -= dt;
    if (r.state === 'alert') {
      if (r.t <= 0) { r.state = 'flee'; r.left = 30 + R() * 15; r.zig = 0; r.ry = Math.atan2(r.x - player.x, r.z - player.z); }
    } else if (r.state === 'flee') {
      r.zig -= dt;
      const away = Math.atan2(r.x - player.x, r.z - player.z);
      if (r.zig <= 0) { r.zig = 0.35 + R() * 0.4; r.ry = away + (R() - 0.5) * 1.3; }
      r.hop += dt * 13;
      if (step(r, FLEE_SPEED, dt)) r.left -= FLEE_SPEED * dt;
      if (r.left <= 0 && d > SEE * 2) { r.state = 'graze'; r.t = 2 + R() * 4; r.hop = 0; }
    } else if (r.state === 'hop') {
      r.hop += dt * 7;
      step(r, HOP_SPEED, dt);
      if (r.t <= 0) { r.state = 'graze'; r.t = 2 + R() * 5; r.hop = 0; }
    } else if (r.t <= 0) {
      r.state = 'hop'; r.t = 0.8 + R() * 2; r.ry += (R() - 0.5) * 2.2;
    }
  }

  // ------------------------------------------------------------------ tuer, dépecer, pourrir, réapparaître
  function kill(r) {
    if (!r.alive) return;
    r.alive = false;
    r.state = 'dead';
    r.dead = { at: Date.now() };
    pending.push({ id: r.id, at: Date.now() + RESPAWN });
    onChange?.();
  }
  let onRot = null;
  function remove(r) {
    r.dead = null;
    r.gone = true;
    if (!pending.some((p) => p.id === r.id)) pending.push({ id: r.id, at: Date.now() + RESPAWN });
    onChange?.();
  }
  // lapin vivant touché par un segment (la pointe de la lance entre deux images)
  const cen = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  function hitSegment(a, b, rad = 0.26) {
    let best = null, bd = rad;
    for (const r of list) {
      if (!r.alive || r.gone || Math.abs(r.x - a.x) > 40 || Math.abs(r.z - a.z) > 40) continue;
      cen.set(r.x, forest.surfaceY(r.x, r.z) + 0.13 + Math.abs(Math.sin(r.hop)) * 0.15, r.z);
      ab.subVectors(b, a); ac.subVectors(cen, a);
      const t = Math.max(0, Math.min(1, ac.dot(ab) / Math.max(1e-6, ab.lengthSq())));
      const d = ac.sub(ab.multiplyScalar(t)).length();
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
  // lapin vivant dans le cône devant soi (coup de lance)
  function inReach(player, yaw, reach = 2.3) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let best = null, bd = reach;
    for (const r of list) {
      if (!r.alive || r.gone) continue;
      const dx = r.x - player.x, dz = r.z - player.z, d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) / Math.max(d, 1e-6) > 0.82) { bd = d; best = r; }
    }
    return best;
  }
  // toucher un lapin mort
  const p3 = new THREE.Vector3();
  function pickDead(camera, px, py, player, reach = 2.2) {
    let best = null, bd = Infinity;
    for (const r of list) {
      if (!r.dead) continue;
      const dist = Math.hypot(r.x - player.x, r.z - player.z);
      if (dist > 7) continue;
      p3.set(r.x, forest.surfaceY(r.x, r.z) + 0.1, r.z).project(camera);
      if (p3.z > 1) continue;
      const sx = (p3.x * 0.5 + 0.5) * innerWidth, sy = (-p3.y * 0.5 + 0.5) * innerHeight;
      const rad = Math.max(55, Math.min(170, (innerHeight * 0.3) / Math.max(0.5, dist)));
      const d = Math.hypot(sx - px, sy - py);
      if (d < rad && d < bd) { bd = d; best = r; }
    }
    return best ? { rabbit: best, near: Math.hypot(best.x - player.x, best.z - player.z) <= reach } : null;
  }

  let slow = 0;
  function update(dt, player) {
    const now = Date.now();
    for (const r of list) {
      if (r.alive && !r.gone && Math.abs(r.x - player.x) < ACTIVE && Math.abs(r.z - player.z) < ACTIVE) think(r, dt, player);
    }
    slow -= dt;
    if (slow <= 0) {
      slow = 2;
      for (const r of list) if (r.dead && now - r.dead.at > ROT) { onRot?.(r); remove(r); }
      // réapparition, loin du joueur
      let changed = false;
      pending = pending.filter((p) => {
        if (p.at > now) return true;
        const r = list[p.id];
        if (r.dead) return true; // il faut d'abord qu'il ait disparu
        const pos = place(player);
        Object.assign(r, { x: pos.x, z: pos.z, alive: true, gone: false, dead: null, state: 'graze', t: 2 });
        changed = true;
        return false;
      });
      if (changed) onChange?.();
    }
    for (const r of list) draw(r, player);
    mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    update, kill, remove, hitSegment, inReach, pickDead, list,
    setRot(fn) { onRot = fn; },
    data: () => ({
      dead: list.filter((r) => r.dead).map((r) => ({ id: r.id, x: +r.x.toFixed(2), z: +r.z.toFixed(2), ry: +r.ry.toFixed(2), at: r.dead.at })),
      pending,
    }),
  };
}
