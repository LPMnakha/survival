// Bûches (2,5 m, 15 cm de diamètre, tirées des jeunes arbres abattus) et
// planches (une bûche fendue à la hachette en donne 3). Elles ne vont pas dans
// l'inventaire : on porte une bûche, ou jusqu'à 3 planches, sur l'épaule (on
// avance moins vite, les mains sont prises), on les pose au sol et on les reprend.
import * as THREE from '../vendor/three.module.min.js';
import { mergeColored } from './builder.js';
import { itemMaterial } from './models.js';

export const LOG = { len: 2.5, r: 0.072 };
export const PLANK = { len: 2.5, w: 0.15, t: 0.035, perLog: 3, carry: 3, split: 20 };
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

// une planche (axe x, centrée) : bois clair fendu, bouts plus sombres
export function plankGeometry(len = PLANK.len, shade = 0) {
  const key = `p${len.toFixed(3)}|${shade}`;
  if (cache.has(key)) return cache.get(key);
  const wood = [0xc9a571, 0xbf9a66, 0xd1ad79][shade % 3];
  const g = mergeColored([
    [new THREE.BoxGeometry(len, PLANK.t, PLANK.w), wood],
    [new THREE.BoxGeometry(len * 0.9, 0.002, 0.01).translate(0, PLANK.t / 2 + 0.001, -0.03), 0xb08a58],
    [new THREE.BoxGeometry(len * 0.6, 0.002, 0.008).translate(len * 0.1, PLANK.t / 2 + 0.001, 0.035), 0xb08a58],
    [new THREE.BoxGeometry(0.006, PLANK.t * 1.02, PLANK.w * 1.02).translate(len / 2, 0, 0), 0x9c7a4c],
    [new THREE.BoxGeometry(0.006, PLANK.t * 1.02, PLANK.w * 1.02).translate(-len / 2, 0, 0), 0x9c7a4c],
  ]);
  cache.set(key, g);
  return g;
}
// des planches empilées sur l'épaule
const stackCache = new Map();
function plankStack(n) {
  if (stackCache.has(n)) return stackCache.get(n);
  const parts = [];
  for (let k = 0; k < n; k++) parts.push([plankGeometry(PLANK.len, k).clone().translate(k * 0.03, k * (PLANK.t + 0.002), (k % 2 ? 0.01 : -0.01)), 0xffffff]);
  // mergeColored garde les couleurs des sommets si la géométrie en a déjà
  const g = mergeGeos(parts.map(([g]) => g));
  stackCache.set(n, g);
  return g;
}
function mergeGeos(list) {
  const pos = [], col = [], nor = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); col.push(...g.attributes.color.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

export function createLogs(scene, { forest, hands, controls, getAudio, hint, onChange, saved }) {
  const audio = () => getAudio?.();
  const logGeo = logGeometry(LOG.len, LOG.r, 0);
  const KIND = {
    buche: { geo: logGeo, lift: LOG.r * 0.9, name: 'bûche' },
    planche: { geo: plankGeometry(), lift: PLANK.t / 2 + 0.005, name: 'planche' },
  };
  const MAX = 400;
  const meshes = {};
  for (const k of Object.keys(KIND)) {
    const m = new THREE.InstancedMesh(KIND[k].geo, itemMaterial, MAX);
    m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    scene.add(m);
    meshes[k] = m;
  }
  const list = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  // posée au sol, elle suit la pente
  function place(l) {
    const ca = Math.cos(l.rot), sa = Math.sin(l.rot), h = LOG.len / 2;
    const h0 = forest.surfaceY(l.x - ca * h, l.z + sa * h), h1 = forest.surfaceY(l.x + ca * h, l.z - sa * h);
    l.y = (h0 + h1) / 2 + KIND[l.kind].lift;
    l.m = new THREE.Matrix4().compose(new THREE.Vector3(l.x, l.y, l.z), q.setFromEuler(e.set(0, l.rot, Math.atan2(h1 - h0, LOG.len), 'YXZ')), one);
    return l;
  }
  function sync() {
    for (const k of Object.keys(KIND)) {
      const L = list.filter((l) => l.kind === k).slice(0, MAX);
      meshes[k].count = L.length;
      L.forEach((l, i) => meshes[k].setMatrixAt(i, l.m));
      meshes[k].instanceMatrix.needsUpdate = true;
    }
    syncCracks();
  }
  function add(x, z, rot, kind = 'buche') {
    const l = place({ x, z, rot, kind, split: 0 });
    list.push(l);
    sync();
    return l;
  }
  function remove(l) {
    const i = list.indexOf(l);
    if (i >= 0) list.splice(i, 1);
    sync();
  }
  // ce qu'on porte sur l'épaule : une bûche, ou 1 à 3 planches
  let carried = null;
  const setCarry = (c) => {
    carried = c;
    controls.state.carryMul = c ? 0.7 : 1;
    if (c) hands.setCarryGeometry(c.kind === 'buche' ? logGeo : plankStack(c.n));
  };

  // ------------------------------------------------------------------ fendre une bûche en 3 planches (hachette en main, 20 coups)
  // la fente grandit sur le dessus de la bûche à chaque coup
  const crackMat = new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 1 });
  const crackGeo = new THREE.BoxGeometry(1, 0.012, 0.016);
  const cracks = new Map();
  function syncCracks() {
    for (const [l, m] of cracks) if (!list.includes(l) || !l.split) { scene.remove(m); cracks.delete(l); }
    for (const l of list) {
      if (l.kind !== 'buche' || !l.split) continue;
      let m = cracks.get(l);
      if (!m) { m = new THREE.Mesh(crackGeo, crackMat); m.matrixAutoUpdate = false; scene.add(m); cracks.set(l, m); }
      const len = Math.max(0.05, (l.split / PLANK.split) * LOG.len * 0.96);
      m.matrix.copy(l.m).multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, LOG.r * 0.98, 0), new THREE.Quaternion(), new THREE.Vector3(len, 1, 1)));
    }
  }
  let job = null;
  function startSplit(l) {
    if (job || hands.busy || carried) return;
    job = { l, running: true };
    const at = new THREE.Vector3(0, LOG.r, 0).applyMatrix4(l.m);
    hands.chop(at, () => job && job.running, () => {
      l.split = (l.split || 0) + 1;
      syncCracks();
      if (l.split >= PLANK.split) {
        job.running = false;
        // la bûche s'ouvre : trois planches côte à côte
        const ca = Math.cos(l.rot), sa = Math.sin(l.rot);
        remove(l);
        for (const k of [-1, 0, 1]) list.push(place({ x: l.x + sa * k * 0.19, z: l.z + ca * k * 0.19, rot: l.rot, kind: 'planche', split: 0 }));
        sync();
        audio()?.tick('thud');
        hint('Trois planches ! Tu peux en porter jusqu’à 3 sur l’épaule.', 3500);
      }
      onChange?.();
    }, { approach: 0.85 }).then(() => { job = null; onChange?.(); });
    onChange?.();
  }
  const stopSplit = () => { if (job) job.running = false; };

  for (const d of (saved && saved.list) || []) if (Number.isFinite(d.x) && Number.isFinite(d.z)) list.push(place({ x: d.x, z: d.z, rot: d.rot || 0, kind: KIND[d.kind] ? d.kind : 'buche', split: d.split || 0 }));
  sync();
  if (saved && saved.carried) {
    const c = saved.carried === true ? { kind: 'buche', n: 1 } : { kind: KIND[saved.carried.kind] ? saved.carried.kind : 'buche', n: Math.max(1, Math.min(PLANK.carry, saved.carried.n || 1)) };
    setCarry(c);
    hands.setCarrying(true);
  }

  // ------------------------------------------------------------------ toucher une bûche ou une planche
  const p3 = new THREE.Vector3();
  function pickAt(camera, px, py, player, reach = 1.7) {
    let best = null, bd = Infinity;
    for (const l of list) {
      if (Math.abs(l.x - player.x) > 8 || Math.abs(l.z - player.z) > 8) continue;
      const ca = Math.cos(l.rot), sa = Math.sin(l.rot);
      for (let k = -4; k <= 4; k++) {
        const t = k * 0.28, x = l.x + ca * t, z = l.z - sa * t;
        const dist = Math.hypot(x - player.x, z - player.z);
        p3.set(x, l.y, z).project(camera);
        if (p3.z > 1) continue;
        const sx = (p3.x * 0.5 + 0.5) * innerWidth, sy = (-p3.y * 0.5 + 0.5) * innerHeight;
        const rad = Math.max(40, Math.min(150, (innerHeight * 0.13) / Math.max(0.5, dist)));
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
  // la prendre sur l'épaule ; une planche de plus sur la pile (3 au plus)
  function take(l) {
    if (hands.busy || job) return;
    if (carried) {
      if (carried.kind !== 'planche' || l.kind !== 'planche') return hint(carried.kind === 'buche' ? 'Tu portes déjà une bûche : pose-la d’abord.' : 'Pose d’abord les planches pour porter une bûche.');
      if (carried.n >= PLANK.carry) return hint('Tu portes déjà 3 planches : c’est le maximum.');
      hands.pickup(new THREE.Vector3(l.x, l.y, l.z), null, () => {
        remove(l);
        setCarry({ kind: 'planche', n: carried.n + 1 });
        audio()?.tick('lift');
        onChange?.();
      });
      return;
    }
    hands.setCarryGeometry(KIND[l.kind].geo);
    hands.liftLog(l.m, () => {
      remove(l);
      setCarry({ kind: l.kind, n: 1 });
      onChange?.();
    });
  }
  // tout poser au sol devant soi, en travers du regard (les planches côte à côte)
  function drop(player, yaw) {
    if (hands.busy || !carried) return;
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
    if (!spot) return hint(`Pas de place ici pour poser ${carried.kind === 'buche' ? 'la bûche' : 'les planches'}.`);
    const c = carried;
    const l = place({ ...spot, kind: c.kind, split: 0 });
    hands.dropLog(l.m, () => {
      const ca = Math.cos(spot.rot), sa = Math.sin(spot.rot);
      for (let k = 0; k < c.n; k++) {
        const off = (k - (c.n - 1) / 2) * 0.19;
        list.push(k === 0 && c.n === 1 ? l : place({ x: spot.x + sa * off, z: spot.z + ca * off, rot: spot.rot, kind: c.kind, split: 0 }));
      }
      sync();
      setCarry(null);
      onChange?.();
    }, { crouch: 0.7, approach: 1.1 });
  }
  // en poser une à un endroit précis (un mur de cabane, l'établi) : world = repère de la pièce à cet endroit
  function deliver(world, onDone, opts) {
    if (hands.busy || !carried) return null;
    const c = carried, left = c.kind === 'planche' ? c.n - 1 : 0;
    if (c.kind === 'planche') hands.setCarryGeometry(plankStack(1));
    return hands.dropLog(world, () => { setCarry(left > 0 ? { kind: c.kind, n: left } : null); onDone?.(); onChange?.(); }, opts).then(() => {
      // les planches qui restent sont toujours sur l'épaule
      if (left > 0) hands.setCarrying(true);
    });
  }

  return {
    add, remove, pickAt, take, drop, deliver, startSplit, stopSplit, list,
    get carrying() { return !!carried; },
    get carried() { return carried; },
    get carriedKind() { return carried ? carried.kind : null; },
    get splitting() { return !!job; },
    splitProgress: () => (job ? `Planches : ${job.l.split}/${PLANK.split} coups` : ''),
    carryLabel: () => (!carried ? '' : carried.kind === 'buche' ? 'Bûche sur l’épaule' : carried.n > 1 ? `${carried.n} planches sur l’épaule` : 'Une planche sur l’épaule'),
    dropLabel: () => (!carried ? '' : carried.kind === 'buche' ? 'Poser la bûche' : carried.n > 1 ? 'Poser les planches' : 'Poser la planche'),
    data: () => ({ list: list.map((l) => ({ x: +l.x.toFixed(2), z: +l.z.toFixed(2), rot: +l.rot.toFixed(3), kind: l.kind, split: l.split || 0 })), carried }),
  };
}
