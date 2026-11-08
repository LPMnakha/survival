// Abri de fortune : un appentis. Deux poteaux, une poutre faîtière ligaturée,
// trois chevrons qui descendent jusqu'au sol, une couverture de feuilles, et des
// cailloux pour caler le pied des chevrons. On le monte pièce par pièce
// (6 bâtons, 4 cordes, 20 feuilles, 4 cailloux). C'est le seul endroit où l'on dort.
import * as THREE from '../vendor/three.module.min.js';
import { itemGeometry, itemMaterial, anItem } from './models.js';
import { mergeColored } from './builder.js';

export const RECIPE3 = { name: 'Abri de fortune', needs: { baton: 6, corde: 4, feuille: 20, caillou: 4 } };

const RIDGE = 1.05, BACK = -1.55, HALF = 1.05;
const X = new THREE.Vector3(1, 0, 0);
// un bâton (axe x, 0,72 m) étiré entre deux points : dans l'abri, ce sont de longues branches
const branch = (a, b, thick = 1.5) => {
  const d = b.clone().sub(a), len = d.length();
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(X, d.normalize()), new THREE.Vector3(len / 0.72, thick, thick));
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const slope = Math.atan2(RIDGE, -BACK);
const lashGeo = mergeColored([
  [new THREE.TorusGeometry(0.045, 0.012, 4, 10), 0xa48d62],
  [new THREE.TorusGeometry(0.045, 0.012, 4, 10).rotateY(Math.PI / 2), 0xb59e70],
  [new THREE.TorusGeometry(0.04, 0.01, 4, 10).rotateX(Math.PI / 2), 0xa48d62],
]);
const PIECES = [
  { type: 'baton', m: branch(V(-HALF, -0.12, 0), V(-HALF * 1.02, RIDGE + 0.1, 0.02)) },
  { type: 'baton', m: branch(V(HALF, -0.12, 0), V(HALF * 1.02, RIDGE + 0.1, 0.02)) },
  { type: 'baton', m: branch(V(-HALF - 0.25, RIDGE, 0), V(HALF + 0.25, RIDGE, 0), 1.7) },
  { type: 'corde', geo: lashGeo, m: new THREE.Matrix4().makeTranslation(-HALF, RIDGE, 0) },
  { type: 'corde', geo: lashGeo, m: new THREE.Matrix4().makeTranslation(HALF, RIDGE, 0) },
  ...[-0.8, 0, 0.8].map((x) => ({ type: 'baton', m: branch(V(x, RIDGE + 0.05, 0.12), V(x * 1.05, -0.05, BACK)) })),
  { type: 'corde', geo: lashGeo, m: new THREE.Matrix4().makeTranslation(-0.8, RIDGE + 0.03, 0.04) },
  { type: 'corde', geo: lashGeo, m: new THREE.Matrix4().makeTranslation(0.8, RIDGE + 0.03, 0.04) },
];
// 20 feuilles en 4 rangées qui se chevauchent, du bas vers le haut (comme des tuiles)
for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
  const t = 0.86 - row * 0.24, x = -0.88 + col * 0.44 + (row % 2) * 0.1;
  const p = V(x, RIDGE * (1 - t) + 0.07, BACK * t);
  // la fronde dans le sens de la pente (Y d'abord), puis couchée sur le toit (X)
  const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(-slope, Math.PI / 2 + (col - 2) * 0.06, 0, 'XYZ')), new THREE.Vector3(2.6, 1, 3.2));
  PIECES.push({ type: 'feuille', m });
}
for (const x of [-0.84, -0.28, 0.28, 0.84]) PIECES.push({ type: 'caillou', variant: Math.abs(Math.round(x * 3)) % 3, m: new THREE.Matrix4().compose(V(x, 0, BACK - 0.12), new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, x * 4), new THREE.Vector3(1.4, 1.4, 1.4)) });

// où l'on s'allonge : sous le toit, la tête vers le fond, les yeux vers l'ouverture
export const BED = { x: 0.1, y: 0.28, z: -0.75 };

export function createShelters(scene, { forest, inventory, hands, getAudio, hint, onChange, saved, others }) {
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0xf4e9da, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const nextMat = new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const badMat = new THREE.MeshBasicMaterial({ color: 0xe0705a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide });
  const audio = () => getAudio?.();
  const sites = [];
  const v3 = new THREE.Vector3();

  const meshOf = (p, mat) => {
    const real = mat === 'real';
    const m = new THREE.Mesh(p.geo || itemGeometry(p.type, p.variant || 0), real ? (p.type === 'feuille' ? leafMat : itemMaterial) : mat);
    m.matrixAutoUpdate = false;
    m.matrix.copy(p.m);
    m.castShadow = real;
    m.receiveShadow = true;
    return m;
  };
  const worldOf = (site, p) => new THREE.Vector3().setFromMatrixPosition(p.m).applyAxisAngle(THREE.Object3D.DEFAULT_UP, site.rot).add(v3.set(site.x, site.y, site.z));
  const toWorld = (site, x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, site.rot).add(v3.set(site.x, site.y, site.z));
  function rebuild(site) {
    const g = site.group;
    for (const c of [...g.children]) g.remove(c);
    PIECES.forEach((p, i) => g.add(meshOf(p, site.stage === 'built' || i < site.placed ? 'real' : i === site.placed ? nextMat : ghostMat)));
    // collision : le toit (on ne peut pas y entrer debout) ; rectangle englobant, l'abri est posé par quarts de tour
    if (!site.col && site.placed > 0) {
      const pts = [toWorld(site, -HALF - 0.3, 0, 0.15), toWorld(site, HALF + 0.3, 0, 0.15), toWorld(site, -HALF - 0.3, 0, BACK - 0.2), toWorld(site, HALF + 0.3, 0, BACK - 0.2)];
      site.col = { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), z0: Math.min(...pts.map((p) => p.z)), z1: Math.max(...pts.map((p) => p.z)) };
      forest.colliders.push(site.col);
    }
  }
  function addSite(d) {
    const site = { x: d.x, z: d.z, rot: d.rot || 0, y: forest.groundAt(d.x, d.z) + 0.03, placed: d.placed || 0, stage: d.stage || 'build' };
    site.group = new THREE.Group();
    site.group.position.set(site.x, site.y, site.z);
    site.group.rotation.y = site.rot;
    scene.add(site.group);
    sites.push(site);
    rebuild(site);
    return site;
  }
  for (const d of (saved && saved.sites) || []) if (Number.isFinite(d.x) && Number.isFinite(d.z)) addSite(d);

  // ------------------------------------------------------------------ preview à placer (orientée par quarts de tour, ouverture vers soi)
  let preview = null;
  const ghost = new THREE.Group();
  PIECES.forEach((p) => ghost.add(meshOf(p, ghostMat)));
  ghost.visible = false;
  scene.add(ghost);
  const quarter = (yaw) => Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
  function validSpot(x, z, rot) {
    if (!forest.inWalk(x, z, -3)) return false;
    const pts = [[0, -0.7], [-1.1, 0], [1.1, 0], [-1.1, -1.5], [1.1, -1.5], [0, 0]].map(([a, b]) => new THREE.Vector3(a, 0, b).applyAxisAngle(THREE.Object3D.DEFAULT_UP, rot).add(v3.set(x, 0, z)));
    if (pts.some((p) => forest.streamDist(p.x, p.z) < 2.4 || forest.blocked(p.x, p.z, 0.45))) return false;
    if ([...sites, ...(others?.() || [])].some((s) => Math.hypot(s.x - x, s.z - z) < 3.2)) return false;
    const h = forest.groundAt(x, z);
    return pts.every((p) => Math.abs(forest.groundAt(p.x, p.z) - h) < 0.35);
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
    // l'ouverture (+z local) face au joueur
    const rot = quarter(yaw + Math.PI);
    const x = player.x - Math.sin(yaw) * 2.6, z = player.z - Math.cos(yaw) * 2.6;
    Object.assign(preview, { x, z, rot, ok: validSpot(x, z, rot) });
    ghost.position.set(x, forest.groundAt(x, z) + 0.03, z);
    ghost.rotation.y = rot;
    for (const m of ghost.children) m.material = preview.ok ? ghostMat : badMat;
  }

  // ------------------------------------------------------------------ toucher
  const p3 = new THREE.Vector3();
  function pickAt(camera, px, py, player, reach = 3.2) {
    let best = null, bd = Infinity;
    for (const s of sites) {
      const c = toWorld(s, 0, 0.5, -0.6);
      const dist = Math.hypot(c.x - player.x, c.z - player.z);
      if (dist > 8) continue;
      p3.copy(c).project(camera);
      if (p3.z > 1) continue;
      const sx = (p3.x * 0.5 + 0.5) * innerWidth, sy = (-p3.y * 0.5 + 0.5) * innerHeight;
      const rad = Math.max(80, Math.min(300, (innerHeight * 0.9) / Math.max(0.5, dist)));
      const d = Math.hypot(sx - px, sy - py);
      if (d < rad && d < bd) { bd = d; best = s; }
    }
    return best ? { site: best, near: Math.hypot(toWorld(best, 0, 0, -0.6).x - player.x, toWorld(best, 0, 0, -0.6).z - player.z) <= reach } : null;
  }
  const nearest = (player, r) => {
    let best = null, bd = r;
    for (const s of sites) { const c = toWorld(s, 0, 0, -0.6); const d = Math.hypot(c.x - player.x, c.z - player.z); if (d < bd) { bd = d; best = s; } }
    return best;
  };
  let onSleep = null;
  function act(site) {
    if (hands.busy) return;
    if (site.stage === 'build') {
      const p = PIECES[site.placed];
      if (!inventory.count(p.type)) {
        const left = PIECES.slice(site.placed).filter((x) => x.type === p.type).length;
        return hint(left > 1 ? `Il te faut encore ${left} ${p.type === 'feuille' ? 'feuilles' : p.type === 'corde' ? 'cordes' : p.type === 'caillou' ? 'cailloux' : 'bâtons'}.` : `Il te faut ${anItem(p.type)}.`);
      }
      inventory.take(p.type);
      hands.place(worldOf(site, p), p.type, () => {
        audio()?.place(p.type);
        site.placed++;
        if (site.placed >= PIECES.length) { site.stage = 'built'; hint('L’abri est prêt. Touche-le pour t’y allonger quand tu as sommeil.'); }
        rebuild(site);
        onChange?.();
      });
      return;
    }
    onSleep?.(site);
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
  function label(site) {
    if (site.stage === 'build') return `Poser ${anItem(PIECES[site.placed].type)} (${site.placed}/${PIECES.length})`;
    return 'Abri de fortune · touche pour dormir';
  }
  // position couchée et regard (repère du monde) pour dormir dans cet abri, et où se relever
  function bed(site) {
    const p = toWorld(site, BED.x, BED.y, BED.z);
    const out = toWorld(site, 0, 0, 1.3);
    return { x: p.x, y: p.y, z: p.z, yaw: site.rot, out: { x: out.x, z: out.z } };
  }
  let t = 0;
  function update(dt, player, camera, yaw) {
    t += dt;
    if (preview) updatePreview(player, yaw);
    nextMat.opacity = 0.35 + 0.25 * Math.sin(t * 3.2);
  }
  return {
    update, act, dismantle, label, pickAt, nearest, startPlacement, cancelPlacement, confirmPlacement, bed,
    setSleepHandler(fn) { onSleep = fn; },
    get placing() { return !!preview; }, get placeOk() { return !!preview && preview.ok; },
    sites,
    data: () => ({ sites: sites.map(({ x, z, rot, placed, stage }) => ({ x, z, rot, placed, stage })) }),
  };
}
