// Récupérateur d'eau de pluie : 4 bâtons plantés en carré, calés par 4 cailloux,
// et la bâche tendue entre eux qui forme une poche. On pose les éléments un par
// un comme pour le feu de camp. Il recueille la pluie réelle d'Annecy (1 mm =
// 1 L), même appli fermée, jusqu'à 10 L. On y remplit la bouteille.
import * as THREE from '../vendor/three.module.min.js';
import { itemGeometry, itemMaterial, fmtWater, anItem } from './models.js';

export const COLLECTOR = { cap: 10000, bottle: 1000 };
export const RECIPE2 = { name: 'Récupérateur d’eau de pluie', needs: { bache: 1, baton: 4, caillou: 4 } };

const v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);
const POST = 0.42, TOP = 0.66, SAG = 0.3;
const post = (x, z) => {
  const base = new THREE.Vector3(x, -0.06, z), top = new THREE.Vector3(x * 1.08, TOP, z * 1.08);
  const dir = top.clone().sub(base).normalize();
  return { type: 'baton', m: new THREE.Matrix4().compose(base.clone().addScaledVector(dir, 0.36), new THREE.Quaternion().setFromUnitVectors(X, dir), s3.setScalar(1)) };
};
const stone = (x, z, k) => ({ type: 'caillou', variant: k % 3, m: new THREE.Matrix4().compose(v3.set(x, 0, z), new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, k * 1.7), s3.setScalar(1.3)) });
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const PIECES = [
  ...CORNERS.map(([a, b]) => post(a * POST, b * POST)),
  ...CORNERS.map(([a, b], k) => stone(a * POST * 1.25, b * POST * 1.25, k)),
  { type: 'bache', m: new THREE.Matrix4() },
];
// la bâche tendue : coins attachés en haut des bâtons, creux au milieu
const tarpGeo = (() => {
  const N = 8, pos = [], idx = [], S = POST * 1.08 + 0.02;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const u = i / N * 2 - 1, w = j / N * 2 - 1;
    const sag = (1 - u * u) * (1 - w * w);
    const edge = Math.max(Math.abs(u), Math.abs(w));
    pos.push(u * S * (1 + 0.04 * (1 - edge)), TOP + 0.02 - SAG * sag - 0.03 * (1 - Math.abs(u * w)) * edge, w * S);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = pos.length / 3, col = new Float32Array(n * 3), c = new THREE.Color(0x3f7fb8);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
})();
const tarpMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, flatShading: true, side: THREE.DoubleSide });

export function createCollectors(scene, { forest, inventory, hands, rain, getAudio, hint, onChange, saved, others }) {
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0xf4e9da, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const nextMat = new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const badMat = new THREE.MeshBasicMaterial({ color: 0xe0705a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x4f8fb0, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.82 });
  const audio = () => getAudio?.();
  const sites = [];

  const meshOf = (p, mat) => {
    const geo = p.type === 'bache' ? tarpGeo : itemGeometry(p.type, p.variant || 0);
    const m = new THREE.Mesh(geo, mat === 'real' ? (p.type === 'bache' ? tarpMat : itemMaterial) : mat);
    m.matrixAutoUpdate = false;
    m.matrix.copy(p.m);
    m.castShadow = mat === 'real';
    m.receiveShadow = true;
    return m;
  };
  const worldOf = (site, p) => {
    const w = p.type === 'bache' ? new THREE.Vector3(0, TOP - SAG * 0.5, 0) : new THREE.Vector3().setFromMatrixPosition(p.m);
    return w.applyAxisAngle(THREE.Object3D.DEFAULT_UP, site.rot).add(v3.set(site.x, site.y, site.z));
  };
  function rebuild(site) {
    const g = site.group;
    for (const c of [...g.children]) if (c !== site.water) g.remove(c);
    PIECES.forEach((p, i) => {
      const mat = site.stage === 'built' || i < site.placed ? 'real' : i === site.placed ? nextMat : ghostMat;
      g.add(meshOf(p, mat));
    });
    if (site.stage === 'built' && !site.water) {
      site.water = new THREE.Mesh(new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2), waterMat);
      g.add(site.water);
    }
    showWater(site);
    if (!site.col && site.placed > 0) {
      site.col = { x0: site.x - 0.55, x1: site.x + 0.55, z0: site.z - 0.55, z1: site.z + 0.55 };
      forest.colliders.push(site.col);
    }
  }
  // l'eau dans le creux de la bâche : son niveau et sa largeur suivent la quantité
  function showWater(site) {
    if (!site.water) return;
    const k = Math.min(1, site.ml / COLLECTOR.cap);
    site.water.visible = site.ml > 30;
    const depth = SAG * (0.12 + 0.62 * Math.sqrt(k));
    site.water.position.y = TOP + 0.02 - SAG + depth;
    const r = POST * 1.05 * Math.sqrt(depth / SAG);
    site.water.scale.set(r, 1, r);
  }
  function addSite(d) {
    const site = { x: d.x, z: d.z, rot: d.rot || 0, y: forest.groundAt(d.x, d.z) + 0.04, placed: d.placed || 0, stage: d.stage || 'build', ml: d.ml || 0, rainAt: d.rainAt || Date.now() };
    site.group = new THREE.Group();
    site.group.position.set(site.x, site.y, site.z);
    site.group.rotation.y = site.rot;
    scene.add(site.group);
    sites.push(site);
    rebuild(site);
    if (site.stage === 'built') rain.need(site.rainAt);
    return site;
  }
  for (const d of (saved && saved.sites) || []) if (Number.isFinite(d.x) && Number.isFinite(d.z)) addSite(d);

  // ------------------------------------------------------------------ preview à placer
  let preview = null;
  const ghost = new THREE.Group();
  PIECES.forEach((p) => ghost.add(meshOf(p, ghostMat)));
  ghost.visible = false;
  scene.add(ghost);
  function validSpot(x, z) {
    if (!forest.inWalk(x, z, -1.5) || forest.streamDist(x, z) < 2.6 || forest.blocked(x, z, 0.75)) return false;
    if ([...sites, ...(others?.() || [])].some((s) => Math.hypot(s.x - x, s.z - z) < 2.2)) return false;
    const h = forest.groundAt(x, z);
    return [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].every(([dx, dz]) => Math.abs(forest.groundAt(x + dx, z + dz) - h) < 0.25);
  }
  function startPlacement() { preview = { x: 0, z: 0, rot: 0, ok: false }; ghost.visible = true; }
  function cancelPlacement() { preview = null; ghost.visible = false; }
  function confirmPlacement() {
    if (!preview || !preview.ok) return false;
    addSite({ x: preview.x, z: preview.z, rot: preview.rot });
    cancelPlacement();
    onChange?.();
    return true;
  }
  function updatePreview(player, yaw) {
    const x = player.x - Math.sin(yaw) * 2.0, z = player.z - Math.cos(yaw) * 2.0;
    Object.assign(preview, { x, z, rot: yaw, ok: validSpot(x, z) });
    ghost.position.set(x, forest.groundAt(x, z) + 0.04, z);
    ghost.rotation.y = yaw;
    for (const m of ghost.children) m.material = preview.ok ? ghostMat : badMat;
  }

  // ------------------------------------------------------------------ toucher
  const p3 = new THREE.Vector3();
  function pickAt(camera, px, py, player, reach = 3.0) {
    let best = null, bd = Infinity;
    for (const s of sites) {
      const dist = Math.hypot(s.x - player.x, s.z - player.z);
      if (dist > 7) continue;
      p3.set(s.x, s.y + 0.4, s.z).project(camera);
      if (p3.z > 1) continue;
      const sx = (p3.x * 0.5 + 0.5) * innerWidth, sy = (-p3.y * 0.5 + 0.5) * innerHeight;
      const rad = Math.max(60, Math.min(240, (innerHeight * 0.6) / Math.max(0.5, dist)));
      const d = Math.hypot(sx - px, sy - py);
      if (d < rad && d < bd) { bd = d; best = s; }
    }
    return best ? { site: best, near: Math.hypot(best.x - player.x, best.z - player.z) <= reach } : null;
  }
  const nearest = (player, r) => {
    let best = null, bd = r;
    for (const s of sites) { const d = Math.hypot(s.x - player.x, s.z - player.z); if (d < bd) { bd = d; best = s; } }
    return best;
  };
  function act(site) {
    if (hands.busy) return;
    if (site.stage === 'build') {
      const p = PIECES[site.placed];
      if (!inventory.count(p.type)) {
        const left = PIECES.slice(site.placed).filter((x) => x.type === p.type).length;
        return hint(left > 1 ? `Il te faut encore ${left} ${p.type === 'caillou' ? 'cailloux' : 'bâtons'}.` : `Il te faut ${anItem(p.type)}.`);
      }
      inventory.take(p.type);
      hands.place(worldOf(site, p), p.type, () => {
        audio()?.place(p.type);
        site.placed++;
        if (site.placed >= PIECES.length) { site.stage = 'built'; site.rainAt = Date.now(); hint('Le récupérateur est prêt : il se remplira quand il pleuvra.'); }
        rebuild(site);
        onChange?.();
      });
      return;
    }
    const b = inventory.heldSlot();
    if (!b || b.type !== 'bouteille') return hint(`${fmtWater(site.ml) === 'vide' ? 'Le récupérateur est vide' : `Il y a ${fmtL(site.ml)} d’eau`}. Prends la bouteille en main pour la remplir.`);
    if (b.w >= COLLECTOR.bottle) return hint('La bouteille est déjà pleine.');
    if (site.ml < 50) return hint('Le récupérateur est vide. Il se remplit quand il pleut.');
    const target = new THREE.Vector3(site.x, site.y + TOP - SAG * 0.6, site.z);
    hands.fill(target, () => {
      const give = Math.min(COLLECTOR.bottle - b.w, site.ml);
      b.w = Math.round(b.w + give);
      site.ml -= give;
      showWater(site);
      inventory.changed();
      onChange?.();
    }, () => audio()?.pour());
  }
  function dismantle(site) {
    if (site.stage !== 'build' || hands.busy) return;
    while (site.placed > 0 && inventory.canAdd(PIECES[site.placed - 1].type)) { inventory.add(PIECES[site.placed - 1].type); site.placed--; }
    if (site.placed > 0) { hint('Inventaire plein : le reste est resté au sol.'); rebuild(site); onChange?.(); return; }
    scene.remove(site.group);
    if (site.col) forest.colliders.splice(forest.colliders.indexOf(site.col), 1);
    sites.splice(sites.indexOf(site), 1);
    onChange?.();
  }
  const fmtL = (ml) => (ml >= 995 ? `${(ml / 1000).toFixed(1).replace('.', ',').replace(',0', '')} L` : `${Math.round(ml / 10)} cl`);
  function label(site) {
    if (site.stage === 'build') {
      const p = PIECES[site.placed];
      return `Poser ${anItem(p.type)} (${site.placed}/${PIECES.length})`;
    }
    const b = inventory.heldSlot();
    const lvl = site.ml < 50 ? 'Récupérateur vide' : `Récupérateur : ${fmtL(site.ml)} d’eau`;
    if (b && b.type === 'bouteille' && site.ml >= 50 && b.w < COLLECTOR.bottle) return `${lvl} · touche pour remplir la bouteille`;
    return lvl + (rain.rateNow() > 0.05 ? ' · il pleut, il se remplit' : '');
  }

  // ------------------------------------------------------------------ chaque image : la pluie remplit (rattrape aussi le temps passé appli fermée)
  let t = 0, timer = 0;
  function update(dt, player, camera, yaw) {
    t += dt;
    if (preview) updatePreview(player, yaw);
    nextMat.opacity = 0.35 + 0.25 * Math.sin(t * 3.2);
    timer -= dt;
    if (timer > 0) return;
    timer = 1;
    const until = rain.coveredUntil();
    if (until == null) return;
    let changed = false;
    for (const s of sites) {
      if (s.stage !== 'built' || until <= s.rainAt) continue;
      const mm = rain.mmBetween(s.rainAt, until);
      if (mm == null) continue;
      s.rainAt = until;
      if (mm > 0 && s.ml < COLLECTOR.cap) { s.ml = Math.min(COLLECTOR.cap, s.ml + mm * 1000); showWater(s); changed = true; }
    }
    if (changed) onChange?.();
  }

  return {
    update, act, dismantle, label, pickAt, nearest, startPlacement, cancelPlacement, confirmPlacement,
    get placing() { return !!preview; }, get placeOk() { return !!preview && preview.ok; },
    sites,
    data: () => ({ sites: sites.map(({ x, z, rot, placed, stage, ml, rainAt }) => ({ x, z, rot, placed, stage, ml: Math.round(ml), rainAt })) }),
  };
}
