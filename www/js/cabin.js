// Cabane en rondins de 5 × 2,5 m, posée au sol, montée « pièce sur pièce » :
// des poteaux verticaux posés sur des sablières, entre lesquels on empile des
// rondins de 2,5 m. Murs calfeutrés à la mousse, pignons, faîtage et pannes,
// chevrons en bûches fendues, lattes en bâtons, toit couvert de feuilles, une
// fenêtre à barreaux et une porte en bâtons qui s'ouvre (on y passe debout).
// 159 étapes : chaque bûche est apportée sur l'épaule, le reste vient de l'inventaire.
import * as THREE from '../vendor/three.module.min.js';
import { mergeColored, merge } from './builder.js';
import { itemGeometry, itemMaterial, itemName } from './models.js';
import { logGeometry } from './logs.js';

export const RECIPE6 = { name: 'Cabane en rondins', needs: { buche: 123, mousse: 40, baton: 69, corde: 35, feuille: 150 } };

const LX = 2.5, LZ = 1.25, RL = 0.075, RP = 0.085;
const Y0 = 2 * RL, ROW = 0.15, ROWS = 13, WALL_TOP = Y0 + ROWS * ROW, PLATE_Y = WALL_TOP + RL, ROOF = WALL_TOP + 0.15;
const RIDGE_TOP = ROOF + 0.75, SLOPE = 0.6, EAVE = 1.55;
const DOOR = { x0: 0.85, x1: 1.65 }, WIN = { x0: -1.55, x1: -0.95, r0: 7, r1: 9 };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = THREE.Object3D.DEFAULT_UP;
const qAlongZ = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2);
const qVertical = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
const ONE = V(1, 1, 1);
const mat4 = (p, q = new THREE.Quaternion(), s = ONE) => new THREE.Matrix4().compose(p, q, s);
// un rondin entre deux abscisses (axe x local du mur)
const seg = (len, shade) => logGeometry(Math.max(0.2, len), RL, shade);
// un bâton (0,72 m, axe x) étiré entre deux points
const stick = (a, b, thick = 1.2) => {
  const d = b.clone().sub(a), len = d.length();
  return itemGeometry('baton').clone().applyMatrix4(mat4(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), d.normalize()), V(len / 0.72, thick, thick)));
};
const lashGeo = () => mergeColored([
  [new THREE.TorusGeometry(0.06, 0.013, 4, 10), 0xa48d62],
  [new THREE.TorusGeometry(0.06, 0.013, 4, 10).rotateY(Math.PI / 2), 0xb59e70],
]);
const mossStrip = (len) => mergeColored([
  [new THREE.CylinderGeometry(0.022, 0.022, len, 5).rotateZ(Math.PI / 2), 0x4c6331],
  ...[0, 1, 2].map((k) => [new THREE.IcosahedronGeometry(0.028, 0).scale(1.6, 0.6, 0.8).translate((k / 2 - 0.5) * len * 0.8, 0.01, 0.006), 0x58703a]),
]);
// un rondin dans le mur : segments posés dans un repère (centre, orientation)
function wallPiece(segments, y, wall, shade) {
  const parts = [];
  for (const [a, b] of segments) {
    const g = seg(b - a, shade).clone();
    const c = (a + b) / 2;
    if (wall.axis === 'x') g.applyMatrix4(mat4(V(c, y, wall.at)));
    else g.applyMatrix4(mat4(V(wall.at, y, c), qAlongZ));
    parts.push(g);
  }
  return merge(parts);
}
const WALLS = {
  back: { axis: 'x', at: -LZ }, front: { axis: 'x', at: LZ },
  left: { axis: 'z', at: -LX }, right: { axis: 'z', at: LX },
};
// toutes les étapes, pour une cabane donnée (les plots suivent le terrain)
function buildPieces(ground) {
  const P = [];
  const add = (p) => { P.push(p); return p; };
  // repère de la bûche apportée : où elle se pose (centre, orientation)
  const logAt = (p, q) => mat4(p, q);
  // --- sablières : le cadre posé au sol (coupé au seuil de la porte, pour entrer sans enjamber)
  const frame = (y, phase, low) => {
    for (const [wall, a, b] of [['back', -LX - 0.08, 0], ['back', 0, LX + 0.08], ['front', -LX - 0.08, 0], ['front', 0, LX + 0.08], ['left', -LZ - 0.08, LZ + 0.08], ['right', -LZ - 0.08, LZ + 0.08]]) {
      const W = WALLS[wall], c = (a + b) / 2;
      const center = W.axis === 'x' ? V(c, y, W.at) : V(W.at, y, c);
      const segs = low && wall === 'front' && a === 0 ? [[a, DOOR.x0 + RP], [DOOR.x1 - RP, b]] : [[a, b]];
      add({ phase, log: true, geo: wallPiece(segs, y, W, P.length % 3), at: center, deliver: logAt(center, W.axis === 'x' ? undefined : qAlongZ) });
    }
  };
  frame(RL, 'sablières', true);
  // --- poteaux : 4 d'angle, 2 au milieu des grands murs, 2 montants de porte
  const postLen = WALL_TOP - Y0, postY = (WALL_TOP + Y0) / 2;
  for (const [x, z] of [[-LX, -LZ], [LX, -LZ], [LX, LZ], [-LX, LZ], [0, -LZ], [0, LZ], [DOOR.x0, LZ], [DOOR.x1, LZ]]) {
    const c = V(x, postY, z);
    add({ phase: 'poteaux', log: true, geo: logGeometry(postLen, RP, P.length % 3).clone().applyMatrix4(mat4(c, qVertical)), at: c, deliver: logAt(c, qVertical) });
  }
  // --- murs : 11 rangs, 6 travées par rang (porte et fenêtre découpées)
  const spans = [
    ['back', -LX, 0, 'win'], ['back', 0, LX], ['right', -LZ, LZ], ['front', 0, LX, 'door'], ['front', -LX, 0], ['left', -LZ, LZ],
  ];
  for (let r = 0; r < ROWS; r++) {
    const y = Y0 + RL + r * ROW;
    for (const [wall, a0, b0, hole] of spans) {
      const W = WALLS[wall], a = a0 + RP, b = b0 - RP;
      let segs = [[a, b]];
      if (hole === 'door') segs = [[a, DOOR.x0 - RP], [DOOR.x1 + RP, b]];
      if (hole === 'win' && r >= WIN.r0 && r <= WIN.r1) segs = [[a, WIN.x0], [WIN.x1, b]];
      const c = (a0 + b0) / 2;
      const center = W.axis === 'x' ? V(c, y, W.at) : V(W.at, y, c);
      add({ phase: 'murs', log: true, geo: wallPiece(segs, y, W, (r + P.length) % 3), at: center, deliver: logAt(center, W.axis === 'x' ? undefined : qAlongZ) });
    }
  }
  // --- sablières hautes
  frame(PLATE_Y, 'sablières hautes');
  // --- calfeutrage : de la mousse dans chaque joint, dedans et dehors (8 fois 5 poignées)
  const per = Math.ceil(((ROWS + 1) * 4) / 8);
  const strips = [];
  for (let j = 0; j <= ROWS; j++) {
    const y = Y0 + j * ROW;
    for (const wall of ['back', 'right', 'front', 'left']) {
      const W = WALLS[wall];
      let segs = W.axis === 'x' ? [[-LX + RP, -RP], [RP, LX - RP]] : [[-LZ + RP, LZ - RP]];
      if (wall === 'front' && j > 0) segs = [[-LX + RP, -RP], [RP, DOOR.x0 - RP], [DOOR.x1 + RP, LX - RP]];
      if (wall === 'front' && j === 0) segs = [[-LX + RP, -RP], [RP, DOOR.x0], [DOOR.x1, LX - RP]];
      if (wall === 'back' && j > WIN.r0 && j <= WIN.r1) segs = [[-LX + RP, WIN.x0], [WIN.x1, -RP], [RP, LX - RP]];
      const parts = [];
      for (const [a, b] of segs) for (const side of [-1, 1]) {
        const g = mossStrip(b - a);
        const c = (a + b) / 2, o = side * RL * 0.72;
        if (W.axis === 'x') g.applyMatrix4(mat4(V(c, y, W.at + o)));
        else g.applyMatrix4(mat4(V(W.at + o, y, c), qAlongZ));
        parts.push(g);
      }
      strips.push({ geo: merge(parts), at: W.axis === 'x' ? V(0, y, W.at) : V(W.at, y, 0) });
    }
  }
  for (let k = 0; k < 8; k++) {
    const group = strips.slice(k * per, k * per + per);
    add({ phase: 'calfeutrage', cost: { mousse: 5 }, hand: 'mousse', geo: merge(group.map((s) => s.geo)), at: group[Math.floor(group.length / 2)].at });
  }
  // --- pignons : 4 rangs de chaque côté, de plus en plus courts
  for (let i = 0; i < 4; i++) for (const x of [-LX, LX]) {
    const y = ROOF + RL + i * ROW, w = 2.5 * (1 - (i + 1) * 0.2) + 0.12;
    const c = V(x, y, 0);
    add({ phase: 'pignons', log: true, geo: wallPiece([[-w / 2, w / 2]], y, { axis: 'z', at: x }, i % 3), at: c, deliver: logAt(c, qAlongZ) });
  }
  // --- pannes puis faîtage : trois poutres de 5,5 m, chacune en deux bûches
  const beam = (z, yTop, phase) => {
    for (const [a, b] of [[-LX - 0.25, 0], [0, LX + 0.25]]) {
      const c = V((a + b) / 2, yTop - RL, z);
      add({ phase, log: true, geo: logGeometry(b - a, RL, P.length % 3).clone().applyMatrix4(mat4(c)), at: c, deliver: logAt(c) });
    }
  };
  beam(-0.625, RIDGE_TOP - SLOPE * 0.625, 'pannes');
  beam(0.625, RIDGE_TOP - SLOPE * 0.625, 'pannes');
  beam(0, RIDGE_TOP, 'faîtage');
  // --- chevrons : 11 paires de demi-bûches (une bûche fendue en deux), liées au faîtage
  const slopeLen = Math.hypot(EAVE, EAVE * SLOPE);
  const half = (len) => mergeColored([
    [new THREE.CylinderGeometry(RL, RL, len, 6, 1, false, -Math.PI / 2, Math.PI).rotateZ(-Math.PI / 2).rotateX(-Math.PI / 2), 0x6a5340],
    [new THREE.BoxGeometry(len, 0.004, RL * 2).translate(0, 0.001, 0), 0xc9a571],
  ]);
  const rafterGeo = half(slopeLen + 0.04);
  const basis = (sgn) => {
    const d = V(0, -SLOPE * EAVE, sgn * EAVE).normalize();
    const z = V(-sgn, 0, 0), y = new THREE.Vector3().crossVectors(z, d);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(d, y, z));
  };
  const qr = { [-1]: basis(-1), [1]: basis(1) };
  for (let i = 0; i <= 10; i++) {
    const x = -LX + i * 0.5, parts = [];
    for (const sgn of [-1, 1]) {
      const c = V(x, RIDGE_TOP - (SLOPE * EAVE) / 2 + 0.005, (sgn * EAVE) / 2);
      parts.push(rafterGeo.clone().applyMatrix4(mat4(c, qr[sgn])));
    }
    parts.push(lashGeo().applyMatrix4(mat4(V(x, RIDGE_TOP + 0.02, 0))));
    parts.push(lashGeo().applyMatrix4(mat4(V(x, RIDGE_TOP + 0.02, 0), new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2))));
    add({ phase: 'chevrons', log: true, split: true, cost: { corde: 2 }, geo: merge(parts), at: V(x, RIDGE_TOP, 0) });
  }
  // --- lattes : 5 rangées de bâtons de chaque côté, en travers des chevrons
  const onRoof = (sgn, s, lift) => {
    const d = V(0, -SLOPE, sgn).normalize(), n = V(0, 1, sgn * SLOPE).normalize();
    return V(0, RIDGE_TOP, 0).addScaledVector(d, s).addScaledVector(n, lift);
  };
  const rows = [0.22, 0.58, 0.94, 1.3, 1.66];
  for (let k = 0; k < 5; k++) for (const sgn of [1, -1]) {
    const p = onRoof(sgn, rows[k], RL + 0.03), parts = [];
    for (let j = 0; j < 5; j++) {
      const x0 = -LX - 0.3 + j * 1.12, x1 = x0 + 1.14;
      parts.push(stick(V(x0, p.y + (j % 2) * 0.004, p.z), V(x1, p.y, p.z + (j % 2 ? 0.01 : -0.01)), 1.1));
    }
    parts.push(lashGeo().applyMatrix4(mat4(V(-LX + 0.5 + k * 0.5, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2), V(0.6, 0.6, 0.6))));
    add({ phase: 'lattes', cost: { baton: 5, corde: 1 }, hand: 'baton', geo: merge(parts), at: p });
  }
  // --- couverture : 7 rangées de feuilles de chaque côté (du bas vers le haut, comme des tuiles), puis le faîte
  const slope = Math.atan(SLOPE);
  for (let j = 0; j < 7; j++) for (const sgn of [1, -1]) {
    const s = 1.62 - j * 0.235, parts = [];
    for (let i = 0; i < 10; i++) {
      const x = -LX - 0.15 + i * 0.58 + (j % 2) * 0.12;
      const p = onRoof(sgn, s, RL + 0.07);
      const m = mat4(V(x, p.y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(sgn < 0 ? -slope : slope, sgn < 0 ? Math.PI / 2 + (i % 3 - 1) * 0.06 : -Math.PI / 2 + (i % 3 - 1) * 0.06, 0, 'XYZ')), V(3.3, 1, 4.6));
      parts.push(itemGeometry('feuille').clone().applyMatrix4(m));
    }
    add({ phase: 'couverture', leaf: true, cost: { feuille: 10 }, hand: 'feuille', geo: merge(parts), at: onRoof(sgn, s, 0.1) });
  }
  {
    const parts = [];
    for (let i = 0; i < 10; i++) {
      const x = -LX - 0.1 + i * 0.58;
      for (const sgn of [1, -1]) parts.push(itemGeometry('feuille').clone().applyMatrix4(mat4(V(x, RIDGE_TOP + RL + 0.09, sgn * 0.12), new THREE.Quaternion().setFromEuler(new THREE.Euler(sgn < 0 ? -slope : slope, sgn < 0 ? Math.PI / 2 : -Math.PI / 2, 0, 'XYZ')), V(2.2, 1, 1.8))));
    }
    add({ phase: 'couverture', leaf: true, cost: { feuille: 10 }, hand: 'feuille', geo: merge(parts), at: V(0, RIDGE_TOP + 0.1, 0) });
  }
  // --- fenêtre : un cadre de 4 bâtons, puis 5 barreaux liés
  const wz = -LZ - RL * 0.6, wy0 = Y0 + WIN.r0 * ROW, wy1 = Y0 + (WIN.r1 + 1) * ROW;
  add({ phase: 'fenêtre', cost: { baton: 4 }, hand: 'baton', at: V((WIN.x0 + WIN.x1) / 2, (wy0 + wy1) / 2, wz),
    geo: merge([stick(V(WIN.x0, wy0 - 0.03, wz), V(WIN.x0, wy1 + 0.03, wz)), stick(V(WIN.x1, wy0 - 0.03, wz), V(WIN.x1, wy1 + 0.03, wz)), stick(V(WIN.x0 - 0.04, wy0, wz), V(WIN.x1 + 0.04, wy0, wz)), stick(V(WIN.x0 - 0.04, wy1, wz), V(WIN.x1 + 0.04, wy1, wz))]) });
  {
    const parts = [];
    for (let k = 1; k <= 5; k++) { const x = WIN.x0 + (k / 6) * (WIN.x1 - WIN.x0); parts.push(stick(V(x, wy0, wz - 0.012), V(x, wy1, wz - 0.012), 0.75)); }
    parts.push(lashGeo().applyMatrix4(mat4(V(WIN.x0, wy1, wz), undefined, V(0.5, 0.5, 0.5))));
    add({ phase: 'fenêtre', cost: { baton: 5, corde: 1 }, hand: 'baton', geo: merge(parts), at: V((WIN.x0 + WIN.x1) / 2, (wy0 + wy1) / 2, wz) });
  }
  // --- porte : 8 bâtons debout, 2 traverses, 2 ligatures ; elle tourne sur le montant gauche
  {
    const w = DOOR.x1 - DOOR.x0 - 2 * RP, h = WALL_TOP - Y0 - 0.04, parts = [];
    for (let k = 0; k < 8; k++) { const x = (k + 0.5) * (w / 8); parts.push(stick(V(x, 0.02, 0), V(x, h, 0), 1.25)); }
    for (const y of [0.3, h - 0.3]) parts.push(stick(V(0, y, 0.035), V(w, y, 0.035), 1.1));
    for (const y of [0.3, h - 0.3]) parts.push(lashGeo().applyMatrix4(mat4(V(w * 0.5, y, 0.03), undefined, V(0.55, 0.55, 0.55))));
    const geo = merge(parts);
    // geo : dans le repère de la porte (charnière) ; placed : à sa place dans la façade (aperçu, chantier)
    add({ phase: 'porte', door: true, cost: { baton: 10, corde: 2 }, hand: 'baton', geo, placed: geo.clone().applyMatrix4(mat4(V(DOOR.x0 + RP, Y0 + 0.02, LZ))), at: V((DOOR.x0 + DOOR.x1) / 2, (Y0 + WALL_TOP) / 2, LZ), w });
  }
  return P;
}
// ce que chaque étape réclame, pour l'indice
const PHASES = ['sablières', 'poteaux', 'murs', 'sablières hautes', 'calfeutrage', 'pignons', 'pannes', 'faîtage', 'chevrons', 'lattes', 'couverture', 'fenêtre', 'porte'];

export function createCabins(scene, { forest, inventory, hands, logs, getAudio, hint, onChange, saved, others }) {
  const audio = () => getAudio?.();
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0xf4e9da, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  const nextMat = new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const badMat = new THREE.MeshBasicMaterial({ color: 0xe0705a, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide });
  const sites = [];
  const v3 = new THREE.Vector3();
  const toWorld = (site, p) => p.clone().applyAxisAngle(UP, site.rot).add(v3.set(site.x, site.y, site.z));
  const siteMatrix = (site) => new THREE.Matrix4().compose(V(site.x, site.y, site.z), new THREE.Quaternion().setFromAxisAngle(UP, site.rot), ONE);
  const groundFn = (x, z, rot, y) => (lx, lz) => {
    const p = V(lx, 0, lz).applyAxisAngle(UP, rot);
    return forest.groundAt(x + p.x, z + p.z) - y;
  };
  // posée au sol : la sablière s'enfonce un peu du côté le plus haut si le terrain penche
  const CORNERS = [[-LX, -LZ], [0, -LZ], [LX, -LZ], [-LX, LZ], [0, LZ], [LX, LZ]];
  const baseY = (x, z, rot) => {
    const hs = CORNERS.map(([a, b]) => { const p = V(a, 0, b).applyAxisAngle(UP, rot); return forest.groundAt(x + p.x, z + p.z); });
    return Math.min(...hs) + 0.35 * (Math.max(...hs) - Math.min(...hs)) - 0.02;
  };

  const mergeOf = (list) => (list.length ? merge(list.map((p) => (p.placed || p.geo).clone())) : null);
  const setGeo = (m, g) => { if (m.geometry) m.geometry.dispose(); m.geometry = g || new THREE.BufferGeometry(); m.visible = !!g; };
  function rebuild(site, skip = -1) {
    const done = site.pieces.slice(0, site.placed).filter((p, i) => i !== skip && !p.door);
    setGeo(site.wood, mergeOf(done.filter((p) => !p.leaf)));
    setGeo(site.leaves, mergeOf(done.filter((p) => p.leaf)));
    const built = site.placed >= site.pieces.length;
    setGeo(site.ghost, built ? null : mergeOf(site.pieces.slice(site.placed + 1)));
    setGeo(site.next, built ? null : mergeOf([site.pieces[site.placed]]));
    site.doorG.visible = site.placed > site.pieces.indexOf(site.doorPiece) && skip !== site.pieces.indexOf(site.doorPiece);
    site.stage = site.placed === 0 ? 'build' : built ? 'built' : 'wip'; // « Démonter » tant que rien n'est posé
    updateCols(site);
  }
  // collisions : chaque mur dès son premier rang de rondins, et la porte fermée
  const rect = (site, x0, z0, x1, z1) => {
    const a = toWorld(site, V(x0, 0, z0)), b = toWorld(site, V(x1, 0, z1));
    return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z), off: true };
  };
  function makeCols(site) {
    const t = RL + 0.02;
    site.cols = {
      backA: rect(site, -LX, -LZ - t, 0, -LZ + t), backB: rect(site, 0, -LZ - t, LX, -LZ + t),
      right: rect(site, LX - t, -LZ, LX + t, LZ), frontD1: rect(site, 0, LZ - t, DOOR.x0, LZ + t), frontD2: rect(site, DOOR.x1, LZ - t, LX, LZ + t),
      frontC: rect(site, -LX, LZ - t, 0, LZ + t), left: rect(site, -LX - t, -LZ, -LX + t, LZ),
      door: rect(site, DOOR.x0, LZ - t, DOOR.x1, LZ + t),
    };
    for (const c of Object.values(site.cols)) forest.addCollider(c);
  }
  function updateCols(site) {
    const firstRow = 6 + 8; // sablières, poteaux
    const on = (k) => site.placed > firstRow + k;
    const C = site.cols;
    C.backA.off = !on(0); C.backB.off = !on(1); C.right.off = !on(2);
    C.frontD1.off = C.frontD2.off = !on(3); C.frontC.off = !on(4); C.left.off = !on(5);
    C.door.off = !(site.doorG.visible && !site.open);
  }
  function addSite(d) {
    const rot = d.rot || 0;
    const y = baseY(d.x, d.z, rot);
    const site = { x: d.x, z: d.z, rot, y, placed: d.placed || 0, open: d.open !== false, angle: 0 };
    site.pieces = buildPieces(groundFn(d.x, d.z, rot, y));
    site.doorPiece = site.pieces.find((p) => p.door);
    site.group = new THREE.Group();
    site.group.position.set(site.x, site.y, site.z);
    site.group.rotation.y = rot;
    const mk = (mat, cast) => { const m = new THREE.Mesh(new THREE.BufferGeometry(), mat); m.castShadow = cast; m.receiveShadow = true; site.group.add(m); return m; };
    site.wood = mk(itemMaterial, true);
    site.leaves = mk(leafMat, true);
    site.ghost = mk(ghostMat, false);
    site.next = mk(nextMat, false);
    // la porte : elle tourne sur le montant de gauche, vers l'intérieur
    site.doorG = new THREE.Group();
    site.doorG.position.set(DOOR.x0 + RP, Y0 + 0.02, LZ);
    const dm = new THREE.Mesh(site.doorPiece.geo, itemMaterial);
    dm.castShadow = true;
    site.doorG.add(dm);
    site.group.add(site.doorG);
    site.angle = site.open ? 1.45 : 0;
    site.doorG.rotation.y = site.angle;
    scene.add(site.group);
    sites.push(site);
    makeCols(site);
    rebuild(site);
    return site;
  }
  for (const d of (saved && saved.sites) || []) if (Number.isFinite(d.x) && Number.isFinite(d.z)) addSite(d);

  // ------------------------------------------------------------------ placer : la porte face à soi, par quarts de tour
  let preview = null;
  const fullGeo = merge(buildPieces(() => 0).map((p) => (p.placed || p.geo).clone()));
  const ghost = new THREE.Mesh(fullGeo, ghostMat);
  ghost.visible = false;
  scene.add(ghost);
  const quarter = (yaw) => Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
  function validSpot(x, z, rot) {
    if (!forest.inWalk(x, z, -5)) return false;
    const pts = [];
    for (let a = -LX - 0.3; a <= LX + 0.31; a += 0.7) for (const b of [-LZ - 0.3, 0, LZ + 0.3]) pts.push(V(a, 0, b));
    const w = pts.map((p) => p.applyAxisAngle(UP, rot).add(v3.set(x, 0, z)).clone());
    if (w.some((p) => forest.streamDist(p.x, p.z) < 2.6 || forest.blocked(p.x, p.z, 0.25) || forest.nearSite(p.x, p.z, 1))) return false;
    if ([...sites, ...(others?.() || [])].some((s) => Math.hypot(s.x - x, s.z - z) < 5.5)) return false;
    const hs = w.map((p) => forest.groundAt(p.x, p.z));
    return Math.max(...hs) - Math.min(...hs) < 0.55;
  }
  function startPlacement() { preview = { x: 0, z: 0, rot: 0, ok: false }; ghost.visible = true; }
  function cancelPlacement() { preview = null; ghost.visible = false; }
  function confirmPlacement() {
    if (!preview || !preview.ok) return false;
    addSite({ x: preview.x, z: preview.z, rot: preview.rot });
    cancelPlacement();
    hint('Commence par les sablières : apporte une bûche sur l’épaule et touche le chantier.', 4500);
    onChange?.();
    return true;
  }
  function updatePreview(player, yaw) {
    // la porte (+z local) tournée vers soi
    const rot = ((quarter(yaw) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const dist = LZ + 2.6;
    const x = player.x - Math.sin(yaw) * dist, z = player.z - Math.cos(yaw) * dist;
    Object.assign(preview, { x, z, rot, ok: validSpot(x, z, rot) });
    ghost.position.set(x, baseY(x, z, rot), z);
    ghost.rotation.y = rot;
    ghost.material = preview.ok ? ghostMat : badMat;
  }

  // ------------------------------------------------------------------ toucher
  const p3 = new THREE.Vector3();
  const local = (site, p) => p.clone().sub(v3.set(site.x, 0, site.z)).applyAxisAngle(UP, -site.rot);
  const distTo = (site, p) => { const l = local(site, V(p.x, 0, p.z)); return Math.hypot(Math.max(0, Math.abs(l.x) - LX), Math.max(0, Math.abs(l.z) - LZ)); };
  function pickAt(camera, px, py, player, reach = 2.6) {
    let best = null, bd = Infinity;
    for (const s of sites) {
      const dist = distTo(s, player);
      if (dist > 9) continue;
      const pts = [V(0, 1, 0), V(-LX, 1, 0), V(LX, 1, 0), V(0, 1, LZ), V(0, 1, -LZ)];
      if (s.placed < s.pieces.length) pts.push(s.pieces[s.placed].at);
      if (s.doorG.visible) pts.push(V((DOOR.x0 + DOOR.x1) / 2, 1, LZ));
      for (const lp of pts) {
        p3.copy(toWorld(s, lp)).project(camera);
        if (p3.z > 1) continue;
        const sx = (p3.x * 0.5 + 0.5) * innerWidth, sy = (-p3.y * 0.5 + 0.5) * innerHeight;
        const d = Math.hypot(sx - px, sy - py);
        const rad = Math.max(90, Math.min(320, (innerHeight * 0.7) / Math.max(0.7, dist + 1)));
        if (d < rad && d < bd) { bd = d; best = s; }
      }
    }
    return best ? { site: best, near: distTo(best, player) <= reach } : null;
  }
  const nearest = (player, r) => { let b = null, bd = r; for (const s of sites) { const d = distTo(s, player); if (d < bd) { bd = d; b = s; } } return b; };
  // ce qui manque pour l'étape en cours
  const missing = (p) => Object.entries(p.cost || {}).filter(([t, n]) => inventory.count(t) < n);
  const left = (site, pred) => site.pieces.slice(site.placed).filter(pred).length;
  // la pièce vient se poser (petite descente) puis rejoint le reste
  let anim = null;
  function placed(site) {
    const i = site.placed;
    site.placed++;
    rebuild(site, i);
    const p = site.pieces[i];
    if (!p.door) {
      const m = new THREE.Mesh(p.geo, p.leaf ? leafMat : itemMaterial);
      m.castShadow = true;
      site.group.add(m);
      anim = { site, m, t: 0, i };
    } else { site.open = true; site.angle = 1.45; site.doorG.rotation.y = 1.45; rebuild(site); }
    if (site.placed >= site.pieces.length) hint('La cabane est terminée ! Touche la porte pour l’ouvrir ou la fermer.', 5000);
    else if (site.pieces[site.placed].phase !== p.phase) hint(`Étape suivante : ${site.pieces[site.placed].phase}.`, 3000);
    onChange?.();
  }
  function act(site, player) {
    if (hands.busy) return;
    if (site.placed >= site.pieces.length) return toggleDoor(site);
    const p = site.pieces[site.placed];
    const world = toWorld(site, p.at);
    if (p.log) {
      if (!logs.carrying) {
        const n = left(site, (x) => x.log && x.phase === p.phase);
        return hint(`Apporte une bûche sur l’épaule (${p.phase} : encore ${n}, ${left(site, (x) => x.log)} en tout).`, 3500);
      }
      const miss = missing(p);
      if (miss.length) return hint(`Il te faut aussi ${miss.map(([t, n]) => `${n} ${itemName(t, n)}`).join(' et ')}.`);
      if (p.split) {
        if (!inventory.count('hachette')) return hint('Il faut la hachette pour fendre la bûche en deux chevrons.');
        return splitRafter(site, p);
      }
      const crouch = p.at.y < 0.7 ? 0.55 : p.at.y < 1.4 ? 0.25 : 0.05;
      logs.deliver(siteMatrix(site).multiply(p.deliver), () => placed(site), { crouch, approach: 1.3 });
      return;
    }
    if (logs.carrying) return hint('Pose d’abord la bûche : cette étape se fait avec l’inventaire.');
    const miss = missing(p);
    if (miss.length) return hint(`Il te faut ${miss.map(([t, n]) => `${n} ${itemName(t, n)}`).join(' et ')} (${p.phase}).`);
    for (const [t, n] of Object.entries(p.cost)) for (let k = 0; k < n; k++) inventory.take(t);
    hands.place(world, p.hand, () => { audio()?.place(p.hand); placed(site); });
  }
  // fendre une bûche en deux chevrons : on la pose au sol, trois coups de hachette, et la paire monte au toit
  const splitMesh = new THREE.Mesh(logGeometry(2.5, RL, 1), itemMaterial);
  splitMesh.visible = false;
  splitMesh.castShadow = true;
  scene.add(splitMesh);
  function splitRafter(site, p) {
    const front = toWorld(site, V(0, 0, LZ + 1.6));
    const rot = site.rot;
    const gy = forest.surfaceY(front.x, front.z) + RL * 0.9;
    const m = mat4(V(front.x, gy, front.z), new THREE.Quaternion().setFromAxisAngle(UP, rot));
    // la bûche posée au sol (geste fini), puis trois coups de hachette dans sa longueur
    logs.deliver(m, () => {
      splitMesh.matrixAutoUpdate = false;
      splitMesh.matrix.copy(m);
      splitMesh.visible = true;
    }, { crouch: 0.7, approach: 1.1 })?.then(() => {
      let n = 0;
      hands.chop(V(front.x, gy + 0.05, front.z), () => n < 3, () => { n++; }, { approach: 0.7 }).then(() => {
        splitMesh.visible = false;
        for (const [t, k] of Object.entries(p.cost)) for (let i = 0; i < k; i++) inventory.take(t);
        placed(site);
      });
    });
  }
  function toggleDoor(site) {
    site.open = !site.open;
    audio()?.tick(site.open ? 'lift' : 'thud');
    site.doorAnim = { from: site.angle, to: site.open ? 1.45 : 0, t: 0 };
    onChange?.();
  }
  function dismantle(site) {
    if (hands.busy) return;
    if (site.placed > 0) return hint('Les rondins sont posés : une cabane ne se démonte pas.');
    scene.remove(site.group);
    for (const c of Object.values(site.cols)) c.off = true;
    sites.splice(sites.indexOf(site), 1);
    onChange?.();
  }
  function label(site) {
    if (site.placed >= site.pieces.length) return `Cabane · porte ${site.open ? 'ouverte' : 'fermée'} (touche pour ${site.open ? 'fermer' : 'ouvrir'})`;
    const p = site.pieces[site.placed];
    const n = site.pieces.filter((x) => x.phase === p.phase).length, i = site.pieces.slice(0, site.placed).filter((x) => x.phase === p.phase).length;
    const what = p.log ? (p.split ? 'une bûche à fendre + 2 cordes' : 'une bûche sur l’épaule') : Object.entries(p.cost).map(([t, k]) => `${k} ${itemName(t, k)}`).join(' + ');
    return `Cabane · ${p.phase} (${i}/${n}) : ${what} · ${site.placed}/${site.pieces.length}`;
  }
  let t = 0;
  function update(dt, player, camera, yaw) {
    t += dt;
    if (preview) updatePreview(player, yaw);
    nextMat.opacity = 0.35 + 0.25 * Math.sin(t * 3.2);
    if (anim) {
      anim.t += dt;
      const k = Math.min(1, anim.t / 0.3);
      anim.m.position.y = (1 - k * k) * 0.25;
      if (k >= 1) { anim.site.group.remove(anim.m); const s = anim.site; anim = null; rebuild(s); }
    }
    for (const s of sites) if (s.doorAnim) {
      const a = s.doorAnim;
      a.t += dt;
      const k = Math.min(1, a.t / 0.6), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      s.angle = a.from + (a.to - a.from) * e;
      s.doorG.rotation.y = s.angle;
      if (k >= 1) { s.doorAnim = null; updateCols(s); }
    }
  }
  return {
    update, act, dismantle, label, pickAt, nearest, startPlacement, cancelPlacement, confirmPlacement, toggleDoor, distTo,
    get placing() { return !!preview; }, get placeOk() { return !!preview && preview.ok; },
    sites, PHASES,
    data: () => ({ sites: sites.map(({ x, z, rot, placed, open }) => ({ x, z, rot, placed, open })) }),
  };
}
