// Buissons de baies : 5 poignées par buisson, chaque poignée cueillie repousse
// au bout d'une semaine (temps réel). En hiver, peu de buissons sont garnis.
import * as THREE from '../vendor/three.module.min.js';
import { makeNoise } from './noise.js';
import { mergeColored } from './builder.js';

const WEEK = 7 * 864e5, PER = 5;

export function createBerries(scene, { forest, season, saved, onChange }) {
  const R = makeNoise(53).rnd;
  const bushes = [];
  const sp = forest.spawn;
  // les buissons aiment la lumière : bords de clairières et du ruisseau
  let guard = 0;
  const N = 1100;
  const near = [[sp.x + 7, sp.z - 6], [sp.x - 9, sp.z + 4]]; // deux buissons près du départ
  const tryAdd = (x, z) => {
    if (!forest.inWalk(x, z, -3) || forest.nearSite(x, z, 3) || forest.streamDist(x, z) < 2.4 || forest.blocked(x, z, 0.8)) return false;
    if (Math.hypot(x - sp.x, z - sp.z) < 4) return false;
    if (bushes.some((b) => Math.abs(b.x - x) < 2 && Math.abs(b.z - z) < 2)) return false;
    const id = bushes.length;
    const s = 0.8 + R() * 0.5;
    // en hiver, seul un buisson sur trois porte encore des baies
    const bare = season.name === 'hiver' ? R() > 0.33 : season.name === 'printemps' ? R() > 0.7 : false;
    bushes.push({ id, x, z, y: forest.groundAt(x, z), s, rot: R() * 6.28, bare, picks: [] });
    forest.addCollider({ x0: x - 0.32 * s, x1: x + 0.32 * s, z0: z - 0.32 * s, z1: z + 0.32 * s });
    return true;
  };
  for (const [x, z] of near) tryAdd(x, z);
  while (bushes.length < N && guard++ < N * 30) {
    const x = (R() * 2 - 1) * 395, z = (R() * 2 - 1) * 395;
    const cl = forest.clearingAt(x, z), d = forest.streamDist(x, z);
    const edge = cl > 0.05 && cl < 0.8 ? 1 : d < 12 ? 0.6 : 0.12;
    if (R() > edge) continue;
    tryAdd(x, z);
  }
  // cueillettes en cours (sauvegardées)
  if (saved && saved.picks) for (const [id, list] of Object.entries(saved.picks)) if (bushes[id]) bushes[id].picks = list.filter(Number.isFinite);

  // ------------------------------------------------------------------ modèles
  const leaf = season.name === 'automne' ? [0x7a7a36, 0x8a6a30, 0x6f7a3a] : season.name === 'hiver' ? [0x5f6448, 0x575c42] : [0x4f7a37, 0x5a873e, 0x47702f];
  const bushGeo = mergeColored([
    [new THREE.IcosahedronGeometry(0.42, 0).scale(1.1, 0.8, 1).translate(0, 0.36, 0), leaf[0]],
    [new THREE.IcosahedronGeometry(0.32, 0).translate(0.26, 0.3, 0.12), leaf[1 % leaf.length]],
    [new THREE.IcosahedronGeometry(0.3, 0).translate(-0.24, 0.28, -0.1), leaf[2 % leaf.length]],
    [new THREE.IcosahedronGeometry(0.28, 0).translate(0.02, 0.55, -0.18), leaf[1 % leaf.length]],
  ]);
  const clusterGeo = mergeColored([0, 1, 2, 3, 4].map((k) => [new THREE.IcosahedronGeometry(0.03, 0).translate(Math.cos(k * 1.3) * 0.035, (k % 2) * 0.03, Math.sin(k * 1.3) * 0.035), k % 3 ? 0xb3263a : 0x8e1c34]));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const berryMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, flatShading: true });
  forest.chunked(bushGeo, mat, bushes.map((b) => ({ x: b.x, y: b.y - 0.05, z: b.z, s: b.s, rot: b.rot })), { cast: true, far: 140 });
  // 5 grappes par buisson, réparties sur le feuillage
  const SPOTS = [[0.3, 0.5, 0.25], [-0.32, 0.42, 0.18], [0.05, 0.66, 0.3], [0.38, 0.3, -0.2], [-0.2, 0.55, -0.32]];
  const clusters = [];
  for (const b of bushes) {
    b.clusters = SPOTS.map(([x, y, z], k) => {
      const p = new THREE.Vector3(x * b.s, y * b.s, z * b.s).applyAxisAngle(THREE.Object3D.DEFAULT_UP, b.rot);
      const c = { x: b.x + p.x, y: b.y - 0.05 + p.y, z: b.z + p.z, s: 1, rot: k };
      clusters.push(c);
      return c;
    });
  }
  forest.chunked(clusterGeo, berryMat, clusters, { far: 45 });
  const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const avail = (b, now = Date.now()) => (b.bare ? 0 : PER - b.picks.filter((t) => now - t < WEEK).length);
  function show(b) {
    const n = avail(b);
    b.clusters.forEach((c, k) => {
      c.mesh.setMatrixAt(c.idx, k < n ? m4.compose(v3.set(c.x, c.y, c.z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, c.rot), one) : zero);
      c.mesh.instanceMatrix.needsUpdate = true;
    });
    b.shown = n;
  }
  bushes.forEach(show);

  // ------------------------------------------------------------------ toucher un buisson
  const GRID = new Map(), key = (x, z) => Math.floor(x / 8) * 1000 + Math.floor(z / 8);
  for (const b of bushes) { const k = key(b.x, b.z); if (!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(b); }
  const p3 = new THREE.Vector3();
  function pickAt(camera, px, py, player, reach = 2.0) {
    let best = null, bd = Infinity, far = null;
    for (let i = Math.floor((player.x - 7) / 8); i <= Math.floor((player.x + 7) / 8); i++) for (let j = Math.floor((player.z - 7) / 8); j <= Math.floor((player.z + 7) / 8); j++) {
      for (const b of GRID.get(i * 1000 + j) || []) {
        const dist = Math.hypot(b.x - player.x, b.z - player.z);
        if (dist > 7) continue;
        p3.set(b.x, b.y + 0.4 * b.s, b.z).project(camera);
        if (p3.z > 1) continue;
        const sx = (p3.x * 0.5 + 0.5) * innerWidth, sy = (-p3.y * 0.5 + 0.5) * innerHeight;
        const rad = Math.max(50, Math.min(200, (innerHeight * 0.45 * b.s) / Math.max(0.5, dist)));
        const d = Math.hypot(sx - px, sy - py);
        if (d < rad && d < bd) { bd = d; best = b; }
      }
    }
    if (!best) return null;
    return { bush: best, near: Math.hypot(best.x - player.x, best.z - player.z) <= reach, avail: avail(best) };
  }
  // cueillir : la prochaine grappe visible
  function pick(b) {
    const n = avail(b);
    if (n <= 0) return null;
    const c = b.clusters[n - 1];
    b.picks.push(Date.now());
    show(b);
    onChange?.();
    return c;
  }
  const nextCluster = (b) => { const n = avail(b); return n > 0 ? b.clusters[n - 1] : null; };

  // repousse : on vérifie de temps en temps les buissons cueillis
  let timer = 0;
  function update(dt) {
    timer -= dt;
    if (timer > 0) return;
    timer = 30;
    const now = Date.now();
    for (const b of bushes) {
      if (!b.picks.length) continue;
      b.picks = b.picks.filter((t) => now - t < WEEK);
      if (avail(b, now) !== b.shown) show(b);
    }
  }

  return {
    pickAt, pick, nextCluster, update, bushes,
    data: () => ({ picks: Object.fromEntries(bushes.filter((b) => b.picks.length).map((b) => [b.id, b.picks])) }),
  };
}
