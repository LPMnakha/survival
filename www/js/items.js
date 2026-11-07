// Objets à ramasser au sol : cailloux, brindilles, bâtons. Les emplacements
// possibles sont tirés une fois pour toutes (même forêt à chaque lancement) ;
// un objet ramassé repousse ailleurs au bout de 10 à 20 minutes.
import * as THREE from '../vendor/three.module.min.js';
import { makeNoise } from './noise.js';
import { itemGeometry, itemMaterial, matFor } from './models.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// carte de 800 m : environ 4 fois plus d'objets qu'avant ; brindilles deux fois plus denses
const KINDS = {
  brindille: { active: 12800, pool: 18000, start: 28, want: (d, cl) => 1 - cl * 0.6 },
  caillou: { active: 4000, pool: 6800, start: 10, want: (d, cl) => 0.3 + 0.7 * smooth(9, 2, d) },
  baton: { active: 3200, pool: 5200, start: 7, want: (d, cl) => 1 - cl * 0.85 },
};
const RESPAWN = [10 * 60e3, 20 * 60e3];

export function createGroundItems(scene, { forest, saved, onChange }) {
  const R = makeNoise(41).rnd;
  const spots = []; // { id, type, x, y, z, rot, variant, def, on, mesh, idx }
  const byType = { brindille: [], caillou: [], baton: [] };
  const sp = forest.spawn;
  const ok = (x, z) => forest.inWalk(x, z, -2) && forest.streamDist(x, z) > 1.7 && !forest.nearSite(x, z, 1) && !forest.blocked(x, z, 0.3);
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
      const x = (R() * 2 - 1) * 396, z = (R() * 2 - 1) * 396;
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

  // butin des lieux abandonnés : un objet posé à la main, ramassable une seule fois par partie
  const lootTaken = new Set((saved && saved.loot) || []);
  function addLoot(L) {
    if (lootTaken.has(L.id)) return;
    const mesh = new THREE.Mesh(itemGeometry(L.type, 0), matFor(L.type));
    mesh.position.copy(L.p);
    mesh.rotation.y = L.rot || 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const s = { loot: L.id, type: L.type, x: L.p.x, y: L.p.y, z: L.p.z, rot: L.rot || 0, on: true, lootMesh: mesh, extra: L.extra };
    gridAdd(s);
  }

  // objets jetés par le joueur : restent où ils sont tombés, sans repousse
  const DROP_MAX = 200;
  const droppedMesh = {}, dropped = {};
  for (const type of ['brindille', 'caillou', 'baton', 'bache', 'bouteille', 'sacoche', 'baies']) {
    dropped[type] = [];
    const m = new THREE.InstancedMesh(itemGeometry(type, 0), matFor(type), DROP_MAX);
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    droppedMesh[type] = m;
  }
  const refreshDropped = (type) => {
    const m = droppedMesh[type], L = dropped[type];
    L.forEach((s, i) => { s.mesh = m; s.idx = i; m.setMatrixAt(i, m4.compose(v3.set(s.x, s.y, s.z), q.setFromAxisAngle(up, s.rot), one)); });
    m.count = L.length;
    m.instanceMatrix.needsUpdate = true;
  };
  const gridAdd = (s) => { const k = key(s.x, s.z); if (!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(s); };
  const gridRemove = (s) => { const L = GRID.get(key(s.x, s.z)); if (L) L.splice(L.indexOf(s), 1); };
  function addDropped(type, x, z, rot, save = true, extra) {
    if (dropped[type].length >= DROP_MAX) { const o = dropped[type].shift(); o.on = false; gridRemove(o); } // le plus ancien disparaît
    const s = { dropped: true, type, x, z, y: forest.groundAt(x, z) + 0.05, rot, variant: 0, on: true, extra };
    dropped[type].push(s);
    gridAdd(s);
    refreshDropped(type);
    if (save) onChange?.();
    return s;
  }
  for (const d of (saved && saved.dropped) || []) if (dropped[d.t] && Number.isFinite(d.x) && Number.isFinite(d.z)) addDropped(d.t, d.x, d.z, d.r || 0, false, d.e);
  // où un objet jeté tombe : devant soi, sur un sol libre (ni ruisseau, ni tronc, ni rocher)
  function dropSpot(player, yaw) {
    for (const [dist, da] of [[0.75, 0], [0.75, 0.5], [0.75, -0.5], [0.55, 0.9], [0.55, -0.9], [1.0, 0.25], [1.0, -0.25], [0.45, 0]]) {
      const j = () => (R() - 0.5) * 0.3; // un peu au hasard : les objets ne tombent pas pile au même endroit
      const a = yaw + da, x = player.x - Math.sin(a) * dist + j(), z = player.z - Math.cos(a) * dist + j();
      if (forest.streamDist(x, z) > 1.65 && !forest.blocked(x, z, 0.12) && forest.inWalk(x, z, -0.5)) return { x, z };
    }
    return null;
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
    if (s.loot) {
      s.on = false;
      gridRemove(s);
      scene.remove(s.lootMesh);
      lootTaken.add(s.loot);
      onChange?.();
      return;
    }
    if (s.dropped) {
      s.on = false;
      gridRemove(s);
      dropped[s.type].splice(dropped[s.type].indexOf(s), 1);
      refreshDropped(s.type);
      onChange?.();
      return;
    }
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
    pickAt, take, update, near, dropSpot, addLoot,
    drop: (type, x, z, rot, extra) => addDropped(type, x, z, rot, true, extra),
    data: () => ({
      v: 1, off: spots.filter((s) => s.def && !s.on).map((s) => s.id), on: spots.filter((s) => !s.def && s.on).map((s) => s.id), pending, loot: [...lootTaken],
      dropped: Object.values(dropped).flat().map((s) => ({ t: s.type, x: +s.x.toFixed(2), z: +s.z.toFixed(2), r: +s.rot.toFixed(2), e: s.extra })),
    }),
  };
}
