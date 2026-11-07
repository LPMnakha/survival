// Objets à ramasser au sol : cailloux, brindilles, bâtons. Les emplacements
// possibles sont tirés une fois pour toutes (même forêt à chaque lancement) ;
// un objet ramassé repousse ailleurs au bout de 10 à 20 minutes.
import * as THREE from '../vendor/three.module.min.js';
import { makeNoise } from './noise.js';
import { itemGeometry, itemMaterial } from './models.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const KINDS = {
  brindille: { active: 1600, pool: 2600, start: 14, want: (d, cl) => 1 - cl * 0.7 },
  caillou: { active: 1000, pool: 1700, start: 10, want: (d, cl) => 0.3 + 0.7 * smooth(9, 2, d) },
  baton: { active: 800, pool: 1300, start: 7, want: (d, cl) => 1 - cl * 0.85 },
};
const RESPAWN = [10 * 60e3, 20 * 60e3];

export function createGroundItems(scene, { forest, saved, onChange }) {
  const R = makeNoise(41).rnd;
  const spots = []; // { id, type, x, y, z, rot, variant, def, on, mesh, idx }
  const byType = { brindille: [], caillou: [], baton: [] };
  const sp = forest.spawn;
  const ok = (x, z) => forest.inWalk(x, z, -2) && forest.streamDist(x, z) > 1.7 && !forest.blocked(x, z, 0.3);
  for (const [type, K] of Object.entries(KINDS)) {
    const list = byType[type];
    // quelques-uns près du point de départ, pour le premier feu
    let g = 0;
    while (list.length < K.start && g++ < 5000) {
      const a = R() * Math.PI * 2, r = 4 + R() * 12;
      const x = sp.x + Math.cos(a) * r, z = sp.z + Math.sin(a) * r;
      if (ok(x, z)) list.push({ x, z });
    }
    g = 0;
    while (list.length < K.pool && g++ < K.pool * 40) {
      const x = (R() * 2 - 1) * 196, z = (R() * 2 - 1) * 196;
      if (!ok(x, z) || R() > K.want(forest.streamDist(x, z), forest.clearingAt(x, z))) continue;
      list.push({ x, z });
    }
    list.forEach((s, i) => {
      Object.assign(s, { id: spots.length, type, y: forest.groundAt(s.x, s.z) + 0.05, rot: R() * Math.PI * 2, variant: type === 'caillou' ? Math.floor(R() * 3) : 0, s: 1, def: i < K.active, on: i < K.active });
      spots.push(s);
    });
  }
  // état sauvegardé : emplacements éteints / allumés par rapport au départ, repousses en attente
  let pending = [];
  if (saved && saved.v === 1) {
    for (const id of saved.off || []) if (spots[id]) spots[id].on = false;
    for (const id of saved.on || []) if (spots[id]) spots[id].on = true;
    pending = (saved.pending || []).filter((p) => KINDS[p.type]);
  }

  // instances par carrés, dessinées seulement près du joueur
  const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const groups = {};
  for (const s of spots) (groups[s.type + s.variant] ||= []).push(s);
  for (const list of Object.values(groups)) forest.chunked(itemGeometry(list[0].type, list[0].variant), itemMaterial, list, { size: 27, far: 42 });
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const show = (s) => {
    s.mesh.setMatrixAt(s.idx, s.on ? m4.compose(v3.set(s.x, s.y, s.z), q.setFromAxisAngle(up, s.rot), one) : zero);
    s.mesh.instanceMatrix.needsUpdate = true;
  };
  spots.forEach(show);

  // index par carrés de 8 m pour trouver vite les objets proches
  const GRID = new Map();
  const key = (x, z) => Math.floor(x / 8) * 1000 + Math.floor(z / 8);
  for (const s of spots) { const k = key(s.x, s.z); if (!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(s); }
  function near(x, z, r, fn) {
    for (let i = Math.floor((x - r) / 8); i <= Math.floor((x + r) / 8); i++) for (let j = Math.floor((z - r) / 8); j <= Math.floor((z + r) / 8); j++) {
      const L = GRID.get(i * 1000 + j);
      if (L) for (const s of L) if (s.on && Math.hypot(s.x - x, s.z - z) < r) fn(s);
    }
  }

  // l'objet visé par un toucher : le plus proche du doigt à l'écran, parmi ceux à portée
  const p3 = new THREE.Vector3();
  function pickAt(camera, px, py, player, reach = 1.9, far = 7) {
    let best = null, bd = 64, farHit = null, fd = 40;
    near(player.x, player.z, far, (s) => {
      p3.set(s.x, s.y + 0.03, s.z).project(camera);
      if (p3.z > 1) return;
      const sx = (p3.x * 0.5 + 0.5) * innerWidth, sy = (-p3.y * 0.5 + 0.5) * innerHeight;
      const d = Math.hypot(sx - px, sy - py);
      const dist = Math.hypot(s.x - player.x, s.z - player.z);
      if (dist <= reach) { if (d < bd) { bd = d; best = s; } }
      else if (d < fd) { fd = d; farHit = s; }
    });
    return { spot: best, far: best ? null : farHit };
  }

  function take(s) {
    s.on = false;
    show(s);
    pending.push({ type: s.type, at: Date.now() + RESPAWN[0] + R() * (RESPAWN[1] - RESPAWN[0]) });
    onChange?.();
  }

  // repousses : un emplacement libre au hasard, loin du joueur
  let timer = 0;
  function update(dt, player) {
    timer -= dt;
    if (timer > 0 || !pending.length) return;
    timer = 5;
    const now = Date.now();
    let changed = false;
    pending = pending.filter((p) => {
      if (p.at > now) return true;
      const free = byType[p.type].filter((s) => !s.on && Math.hypot(s.x - player.x, s.z - player.z) > 30);
      if (!free.length) return true;
      const s = free[Math.floor(R() * free.length)];
      s.on = true;
      show(s);
      changed = true;
      return false;
    });
    if (changed) onChange?.();
  }

  return {
    pickAt, take, update, near,
    data: () => ({ v: 1, off: spots.filter((s) => s.def && !s.on).map((s) => s.id), on: spots.filter((s) => !s.def && s.on).map((s) => s.id), pending }),
  };
}
