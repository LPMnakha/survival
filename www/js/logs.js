// Bûches : 2,5 m, 15 cm de diamètre, tirées des jeunes arbres abattus.
// Elles ne vont pas dans l'inventaire : on en porte une sur l'épaule (on avance
// moins vite, les mains sont prises), on la pose au sol et on la reprend.
import * as THREE from '../vendor/three.module.min.js';
import { mergeColored } from './builder.js';
import { itemMaterial } from './models.js';

export const LOG = { len: 2.5, r: 0.072 };
const cache = new Map();
// un rondin (axe x, centré) : écorce, bouts sciés clairs, quelques nœuds de branches coupées
export function logGeometry(len, r = LOG.r, shade = 0) {
  const key = `${len.toFixed(3)}|${r.toFixed(3)}|${shade}`;
  if (cache.has(key)) return cache.get(key);
  const bark = [0x6a5340, 0x5f4a38, 0x735b45][shade % 3];
  const parts = [[new THREE.CylinderGeometry(r, r * 1.03, len, 7).rotateZ(-Math.PI / 2), bark]];
  for (const sgn of [-1, 1]) {
    parts.push([new THREE.CylinderGeometry(r * 0.84, r * 0.84, 0.012, 7).rotateZ(-Math.PI / 2).translate(sgn * (len / 2 + 0.003), 0, 0), 0xc9a571]);
    parts.push([new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.014, 6).rotateZ(-Math.PI / 2).translate(sgn * (len / 2 + 0.004), 0, 0), 0xa8844f]);
  }
  const knots = Math.max(1, Math.round(len / 1.1));
  for (let k = 0; k < knots; k++) {
    const x = ((k + 0.5) / knots - 0.5) * len * 0.85, a = k * 2.3 + shade * 1.1;
    parts.push([new THREE.CylinderGeometry(0.012, 0.017, 0.03, 5).translate(0, r, 0).rotateX(a).translate(x, 0, 0), 0x8a6a48]);
  }
  const g = mergeColored(parts);
  cache.set(key, g);
  return g;
}

export function createLogs(scene, { forest, hands, controls, getAudio, hint, onChange, saved }) {
  const geo = logGeometry(LOG.len, LOG.r, 0);
  hands.setCarryGeometry(geo);
  const MAX = 400;
  const mesh = new THREE.InstancedMesh(geo, itemMaterial, MAX);
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const list = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  // posée au sol, elle suit la pente
  function place(l) {
    const ca = Math.cos(l.rot), sa = Math.sin(l.rot), h = LOG.len / 2;
    const h0 = forest.surfaceY(l.x - ca * h, l.z + sa * h), h1 = forest.surfaceY(l.x + ca * h, l.z - sa * h);
    l.y = (h0 + h1) / 2 + LOG.r * 0.9;
    l.m = new THREE.Matrix4().compose(new THREE.Vector3(l.x, l.y, l.z), q.setFromEuler(e.set(0, l.rot, Math.atan2(h1 - h0, LOG.len), 'YXZ')), one);
    return l;
  }
  function sync() {
    mesh.count = Math.min(MAX, list.length);
    list.slice(0, MAX).forEach((l, i) => mesh.setMatrixAt(i, l.m));
    mesh.instanceMatrix.needsUpdate = true;
  }
  function add(x, z, rot) {
    const l = place({ x, z, rot });
    list.push(l);
    sync();
    return l;
  }
  function remove(l) {
    const i = list.indexOf(l);
    if (i >= 0) list.splice(i, 1);
    sync();
  }
  for (const d of (saved && saved.list) || []) if (Number.isFinite(d.x) && Number.isFinite(d.z)) list.push(place({ x: d.x, z: d.z, rot: d.rot || 0 }));
  sync();
  const setCarry = (on) => { controls.state.carryMul = on ? 0.7 : 1; };
  if (saved && saved.carried) { hands.setCarrying(true); setCarry(true); }

  // ------------------------------------------------------------------ toucher une bûche
  const p3 = new THREE.Vector3();
  function pickAt(camera, px, py, player, reach = 1.7) {
    let best = null, bd = Infinity;
    for (const l of list) {
      if (Math.abs(l.x - player.x) > 8 || Math.abs(l.z - player.z) > 8) continue;
      const ca = Math.cos(l.rot), sa = Math.sin(l.rot);
      for (let k = -2; k <= 2; k++) {
        const t = k * 0.55, x = l.x + ca * t, z = l.z - sa * t;
        const dist = Math.hypot(x - player.x, z - player.z);
        p3.set(x, l.y, z).project(camera);
        if (p3.z > 1) continue;
        const sx = (p3.x * 0.5 + 0.5) * innerWidth, sy = (-p3.y * 0.5 + 0.5) * innerHeight;
        const rad = Math.max(45, Math.min(160, (innerHeight * 0.16) / Math.max(0.5, dist)));
        const d = Math.hypot(sx - px, sy - py);
        if (d < rad && d < bd) { bd = d; best = { log: l, dist }; }
      }
    }
    return best && { log: best.log, near: segDist(best.log, player) <= reach };
  }
  const segDist = (l, p) => {
    const ca = Math.cos(l.rot), sa = Math.sin(l.rot);
    const t = Math.max(-LOG.len / 2, Math.min(LOG.len / 2, (p.x - l.x) * ca - (p.z - l.z) * sa));
    return Math.hypot(p.x - (l.x + ca * t), p.z - (l.z - sa * t));
  };
  // la prendre sur l'épaule
  function take(l) {
    if (hands.busy || hands.carrying) return;
    hands.liftLog(l.m, () => {
      remove(l);
      setCarry(true);
      onChange?.();
    });
  }
  // la poser au sol devant soi, en travers du regard
  function drop(player, yaw) {
    if (hands.busy || !hands.carrying) return;
    let spot = null;
    for (const [dist, da, turn] of [[1.2, 0, 0], [1.2, 0.4, 0], [1.2, -0.4, 0], [1.6, 0, Math.PI / 2], [1.0, 0.9, 0], [1.0, -0.9, 0]]) {
      const a = yaw + da, x = player.x - Math.sin(a) * dist, z = player.z - Math.cos(a) * dist, rot = yaw + da + turn;
      const ca = Math.cos(rot), sa = Math.sin(rot);
      let ok = forest.inWalk(x, z, -1);
      for (let t = -1.25; ok && t <= 1.26; t += 0.42) {
        const px = x + ca * t, pz = z - sa * t;
        if (forest.streamDist(px, pz) < 1.5 || forest.blocked(px, pz, 0.08)) ok = false;
      }
      if (ok) { spot = { x, z, rot }; break; }
    }
    if (!spot) return hint('Pas de place ici pour poser la bûche.');
    const l = place({ ...spot });
    hands.dropLog(l.m, () => {
      list.push(l);
      sync();
      setCarry(false);
      onChange?.();
    }, { crouch: 0.7, approach: 1.1 });
  }
  // la poser à un endroit précis (un mur de cabane) : world = repère de la bûche à cet endroit
  function deliver(world, onDone, opts) {
    if (hands.busy || !hands.carrying) return null;
    return hands.dropLog(world, () => { setCarry(false); onDone?.(); onChange?.(); }, opts);
  }

  return {
    add, remove, pickAt, take, drop, deliver, list,
    get carrying() { return hands.carrying; },
    data: () => ({ list: list.map((l) => ({ x: +l.x.toFixed(2), z: +l.z.toFixed(2), rot: +l.rot.toFixed(3) })), carried: hands.carrying }),
  };
}
