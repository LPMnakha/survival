// Plantes qu'on coupe au couteau artisanal : les fougères donnent des feuilles,
// les orties (lisières, clairières) et les joncs (bord du ruisseau) des fibres.
// Une plante coupée repousse au même endroit au bout de 3 jours (temps réel).
import * as THREE from '../vendor/three.module.min.js';
import { makeNoise } from './noise.js';
import { mergeColored } from './builder.js';

const REGROW = 3 * 864e5;
export const YIELD = { fougere: { type: 'feuille', n: 2 }, ortie: { type: 'fibre', n: 1 }, jonc: { type: 'fibre', n: 1 } };

export function createPlants(scene, { forest, season, saved, onChange }) {
  const R = makeNoise(61).rnd;
  const sp = forest.spawn;
  const winter = season.name === 'hiver';
  const plants = []; // { id, kind, x, y, z, s, rot, mesh, idx, cutAt }

  // ------------------------------------------------------------------ orties et joncs
  const ok = (x, z) => forest.inWalk(x, z, -2) && !forest.nearSite(x, z, 2) && !forest.blocked(x, z, 0.35);
  const orties = [], joncs = [];
  let g = 0;
  // deux touffes d'orties près du départ, pour la première corde
  for (const [dx, dz] of [[-6, -7], [9, 7]]) if (ok(sp.x + dx, sp.z + dz)) orties.push({ x: sp.x + dx, z: sp.z + dz });
  while (orties.length < 2600 && g++ < 90000) {
    const x = (R() * 2 - 1) * 395, z = (R() * 2 - 1) * 395;
    const cl = forest.clearingAt(x, z), d = forest.streamDist(x, z);
    if (d < 2.2) continue;
    const want = cl > 0.05 && cl < 0.85 ? 0.9 : d < 10 ? 0.5 : 0.05; // lisières et abords humides
    if (R() > want || !ok(x, z)) continue;
    orties.push({ x, z });
  }
  g = 0;
  while (joncs.length < 1400 && g++ < 40000) {
    const z = (R() * 2 - 1) * 395;
    const side = R() < 0.5 ? -1 : 1, off = 1.75 + R() * 1.6;
    const x = forest.streamX(z) + side * off;
    if (!ok(x, z)) continue;
    joncs.push({ x, z });
  }
  const add = (kind, list, scale) => list.forEach((p) => plants.push({ kind, x: p.x, z: p.z, y: forest.groundAt(p.x, p.z) - 0.04, s: scale(), rot: R() * 6.28 }));
  add('ortie', orties, () => 0.85 + R() * 0.4);
  add('jonc', joncs, () => 0.8 + R() * 0.45);
  // les fougères de la forêt (déjà dessinées) : on les rend coupables
  for (const f of forest.ferns) plants.push({ kind: 'fougere', fern: f, x: f.x, y: f.y, z: f.z, s: f.s, rot: f.rot });
  plants.forEach((p, i) => { p.id = i; });

  // ------------------------------------------------------------------ modèles
  const nettleGeo = (() => {
    const parts = [];
    const dark = winter ? 0x5a5a3c : 0x3f6a32, light = winter ? 0x6a6644 : 0x4f7d3a;
    for (let k = 0; k < 5; k++) {
      const a = k * 1.26, r = 0.05 + (k % 2) * 0.05, h = 0.55 + (k % 3) * 0.14;
      const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
      parts.push([new THREE.CylinderGeometry(0.006, 0.009, h, 4).translate(bx, h / 2, bz), 0x557a3a]);
      for (let j = 0; j < 4; j++) {
        const y = 0.18 + j * (h - 0.18) / 4, L = 0.07 - j * 0.01;
        for (const sd of [-1, 1]) {
          const leaf = new THREE.IcosahedronGeometry(1, 0).scale(L, 0.006, L * 0.55);
          leaf.translate(L * 0.8, 0, 0);
          leaf.rotateZ(-0.35);
          leaf.rotateY(a + sd * Math.PI / 2 + j * 0.8);
          leaf.translate(bx, y, bz);
          parts.push([leaf, (j + k) % 2 ? dark : light]);
        }
      }
      parts.push([new THREE.IcosahedronGeometry(0.02, 0).scale(1, 1.6, 1).translate(bx, h + 0.02, bz), light]);
    }
    return mergeColored(parts);
  })();
  const rushGeo = (() => {
    const parts = [];
    for (let k = 0; k < 14; k++) {
      const a = k * 2.4, r = 0.02 + (k % 4) * 0.025, h = 0.7 + (k % 5) * 0.09;
      const c = new THREE.ConeGeometry(0.008, h, 3).translate(0, h / 2, 0);
      c.rotateZ(Math.cos(a) * 0.12); c.rotateX(Math.sin(a) * 0.12);
      c.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
      parts.push([c, winter ? 0x8a8452 : k % 3 ? 0x5f7d3a : 0x6f8c44]);
      if (k % 4 === 0) parts.push([new THREE.CylinderGeometry(0.012, 0.012, 0.06, 4).translate(Math.cos(a) * r * 1.5, h * 0.82, Math.sin(a) * r * 1.5), 0x6b4a2e]); // épis bruns
    }
    return mergeColored(parts);
  })();
  const mat = forest.swayMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.06);
  const tint = new THREE.Color();
  forest.chunked(nettleGeo, mat, plants.filter((p) => p.kind === 'ortie'), { size: 27, far: 70, color: () => tint.setHSL(0, 0, 0.9 + R() * 0.2) });
  forest.chunked(rushGeo, mat, plants.filter((p) => p.kind === 'jonc'), { size: 27, far: 70, color: () => tint.setHSL(0, 0, 0.9 + R() * 0.2) });

  // ------------------------------------------------------------------ coupées / repousse
  const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  function show(p) {
    const inst = p.fern || p;
    const cut = p.cutAt && Date.now() - p.cutAt < REGROW;
    inst.mesh.setMatrixAt(inst.idx, cut ? zero : m4.compose(v3.set(inst.x, inst.y, inst.z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, inst.rot), s3.setScalar(inst.s)));
    inst.mesh.instanceMatrix.needsUpdate = true;
    p.shownCut = !!cut;
  }
  const cutList = new Set();
  for (const [id, t] of Object.entries((saved && saved.cut) || {})) {
    const p = plants[id];
    if (p && Number.isFinite(t) && Date.now() - t < REGROW) { p.cutAt = t; cutList.add(p); show(p); }
  }

  // ------------------------------------------------------------------ toucher une plante
  const GRID = new Map(), key = (x, z) => Math.floor(x / 8) * 1000 + Math.floor(z / 8);
  for (const p of plants) { const k = key(p.x, p.z); if (!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(p); }
  const p3 = new THREE.Vector3();
  function pickAt(camera, px, py, player, reach = 2.0) {
    let best = null, bd = Infinity;
    for (let i = Math.floor((player.x - 6) / 8); i <= Math.floor((player.x + 6) / 8); i++) for (let j = Math.floor((player.z - 6) / 8); j <= Math.floor((player.z + 6) / 8); j++) {
      for (const p of GRID.get(i * 1000 + j) || []) {
        if (p.shownCut || (p.fern && forest._hidden.has('ferns'))) continue;
        const dist = Math.hypot(p.x - player.x, p.z - player.z);
        if (dist > 6) continue;
        p3.set(p.x, p.y + 0.3 * p.s, p.z).project(camera);
        if (p3.z > 1) continue;
        const sx = (p3.x * 0.5 + 0.5) * innerWidth, sy = (-p3.y * 0.5 + 0.5) * innerHeight;
        const rad = Math.max(36, Math.min(130, (innerHeight * 0.3 * p.s) / Math.max(0.5, dist)));
        const d = Math.hypot(sx - px, sy - py);
        if (d < rad && d < bd) { bd = d; best = p; }
      }
    }
    return best ? { plant: best, near: Math.hypot(best.x - player.x, best.z - player.z) <= reach } : null;
  }
  function cut(p) {
    p.cutAt = Date.now();
    cutList.add(p);
    show(p);
    onChange?.();
    return YIELD[p.kind];
  }
  // repousse : on vérifie de temps en temps
  let timer = 0;
  function update(dt) {
    timer -= dt;
    if (timer > 0) return;
    timer = 30;
    for (const p of [...cutList]) if (Date.now() - p.cutAt >= REGROW) { p.cutAt = 0; cutList.delete(p); show(p); }
  }
  const NAMES = { fougere: 'cette fougère', ortie: 'ces orties', jonc: 'ces joncs' };
  return {
    pickAt, cut, update, plants, name: (p) => NAMES[p.kind],
    data: () => ({ cut: Object.fromEntries([...cutList].map((p) => [p.id, p.cutAt])) }),
  };
}
