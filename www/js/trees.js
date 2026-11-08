// Jeunes arbres (épicéas et bouleaux d'environ 15 cm de diamètre) : les seuls
// qu'une hachette en silex peut abattre. 80 coups : l'entaille grandit à chaque
// coup (elle est gardée si on s'arrête), l'arbre craque puis tombe à l'opposé.
// Couché, on l'ébranche (10 coups, environ 6 bâtons) puis on le coupe en deux
// bûches de 2,5 m (15 coups chacune). La souche reste ; un jeune arbre repousse
// ailleurs au bout de 3 jours.
import * as THREE from '../vendor/three.module.min.js';
import { makeNoise } from './noise.js';
import { mergeColored } from './builder.js';
import { itemMaterial } from './models.js';
import { LOG } from './logs.js';

export const CHOP = { fell: 80, branches: 10, cut: 15 };
const DAY = 864e5, REGROW = 3 * DAY, STUMP_LIFE = 20 * DAY;
const N = 2000, ACTIVE = 1500;
const H = 7.0, R0 = 0.075, R1 = 0.03, CUT = 0.5, GAP = 0.05;
const radiusAt = (h) => R0 - (R0 - R1) * (h / H);
const spruceColors = [0x2c4a33, 0x31523a, 0x2a4631, 0x355a3d, 0x2f4e36, 0x36593e, 0x2e4c35];
const BARK = { e: 0x4e3828, b: 0xdedad0 };

// un bout de tronc entre deux hauteurs (repère de l'arbre, axe y)
function trunkParts(sp, y0, y1) {
  const parts = [[new THREE.CylinderGeometry(radiusAt(y1), radiusAt(y0), y1 - y0, 7).translate(0, (y0 + y1) / 2, 0), BARK[sp]]];
  if (sp === 'b') {
    // taches sombres du bouleau
    for (let y = Math.ceil(y0 * 2.2) / 2.2 + 0.2; y < y1 - 0.1; y += 0.45) {
      const r = radiusAt(y), a = y * 5.1;
      parts.push([new THREE.BoxGeometry(r * 0.9, 0.025, 0.012).translate(0, 0, r * 0.98).rotateY(a).translate(0, y, 0), 0x3a3530]);
    }
  }
  return parts;
}
function crownParts(sp, leaf) {
  const parts = [];
  if (sp === 'e') {
    for (let k = 0; k < 6; k++) {
      const r = 0.95 - k * 0.14, h = 1.35 - k * 0.06, y = 1.5 + k * 0.92;
      parts.push([new THREE.ConeGeometry(r, h, 7).translate(0, y + h / 2, 0), spruceColors[k % 7]]);
    }
  } else {
    for (const [x, y, z, s] of [[0, 5.4, 0, 0.85], [0.45, 4.7, 0.2, 0.62], [-0.42, 4.8, -0.15, 0.66], [0.05, 6.3, -0.1, 0.6], [-0.15, 4.2, 0.4, 0.5]]) {
      parts.push([new THREE.IcosahedronGeometry(s, 0).scale(1, 1.2, 1).translate(x, y, z), leaf]);
    }
  }
  return parts;
}

export function createTrees(scene, { forest, items, logs, hands, getAudio, hint, onChange, saved, others }) {
  const audio = () => getAudio?.();
  const P = forest.palette;
  const leafCol = P.leaves[0];

  // ------------------------------------------------------------------ emplacements (toujours les mêmes d'une partie à l'autre)
  const R = makeNoise(91).rnd;
  const sp0 = forest.spawn;
  const slots = [];
  const G = new Map(), gk = (x, z) => Math.floor(x / 6) * 10000 + Math.floor(z / 6);
  const nearSlot = (x, z, d) => {
    for (let i = Math.floor((x - d) / 6); i <= Math.floor((x + d) / 6); i++) for (let j = Math.floor((z - d) / 6); j <= Math.floor((z + d) / 6); j++) {
      for (const s of G.get(i * 10000 + j) || []) if (Math.hypot(s.x - x, s.z - z) < d) return true;
    }
    return false;
  };
  const tryAdd = (x, z) => {
    if (!forest.inWalk(x, z, -4) || forest.streamDist(x, z) < 3.2 || forest.nearSite(x, z, 4) || !forest.isFree(x, z, 0.9)) return false;
    if (Math.hypot(x - sp0.x, z - sp0.z) < 6 || nearSlot(x, z, 2.4)) return false;
    const s = { id: slots.length, x, z, y: forest.groundAt(x, z) - 0.05, sp: R() < 0.68 ? 'e' : 'b', s: 0.9 + R() * 0.25, rot: R() * 6.28, st: slots.length < ACTIVE ? 'tree' : 'empty', n: 0, f: 0, at: 0 };
    slots.push(s);
    const k = gk(x, z);
    if (!G.has(k)) G.set(k, []);
    G.get(k).push(s);
    return true;
  };
  // une quarantaine autour du départ, puis partout (surtout en lisière)
  let guard = 0;
  while (slots.length < 40 && guard++ < 4000) { const a = R() * 6.28, d = 8 + R() * 40; tryAdd(sp0.x + Math.sin(a) * d, sp0.z + Math.cos(a) * d); }
  guard = 0;
  while (slots.length < N && guard++ < N * 60) {
    const x = (R() * 2 - 1) * 395, z = (R() * 2 - 1) * 395;
    if (forest.clearingAt(x, z) > 0.6 && R() < 0.75) continue;
    tryAdd(x, z);
  }
  // l'état sauvegardé, et rien ne pousse sur une construction
  if (saved && saved.s) for (const [id, d] of Object.entries(saved.s)) { const s = slots[id]; if (s && d) Object.assign(s, { st: d.st || s.st, n: d.n || 0, f: d.f || 0, at: d.at || 0 }); }
  for (const o of others?.() || []) for (const s of slots) if (s.st === 'tree' && Math.hypot(s.x - o.x, s.z - o.z) < 2.6) { s.st = 'empty'; s.dirty = true; }

  // ------------------------------------------------------------------ modèles et instances
  const treeMat = forest.swayMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.012);
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const spruceGeo = mergeColored([...trunkParts('e', 0, H), ...crownParts('e')]);
  const birchTrunkGeo = mergeColored(trunkParts('b', 0, H));
  const birchCrownGeo = mergeColored(crownParts('b', 0xffffff));
  const stumpGeo = { e: mergeColored([...trunkParts('e', 0, CUT), [new THREE.CylinderGeometry(radiusAt(CUT) * 0.97, radiusAt(CUT) * 0.97, 0.01, 7).translate(0, CUT, 0), 0xd2b07c]]),
    b: mergeColored([...trunkParts('b', 0, CUT), [new THREE.CylinderGeometry(radiusAt(CUT) * 0.97, radiusAt(CUT) * 0.97, 0.01, 7).translate(0, CUT, 0), 0xd9bf8e]]) };
  const tint = new THREE.Color();
  const inst = (s) => ({ x: s.x, y: s.y, z: s.z, s: s.s, rot: s.rot });
  for (const s of slots) { s.iTree = inst(s); s.iCrown = s.sp === 'b' ? inst(s) : null; s.iStump = inst(s); }
  forest.chunked(spruceGeo, treeMat, slots.filter((s) => s.sp === 'e').map((s) => s.iTree), { cast: true, far: 150 });
  forest.chunked(birchTrunkGeo, treeMat, slots.filter((s) => s.sp === 'b').map((s) => s.iTree), { cast: true, far: 150 });
  forest.chunked(birchCrownGeo, forest.swayMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.0121), slots.filter((s) => s.sp === 'b').map((s) => s.iCrown), { cast: true, far: 150, color: () => tint.set(P.leaves[Math.floor(R() * P.leaves.length)]).multiplyScalar(0.85 + R() * 0.3) });
  forest.chunked(stumpGeo.e, itemMaterial, slots.filter((s) => s.sp === 'e').map((s) => s.iStump), { far: 70 });
  forest.chunked(stumpGeo.b, itemMaterial, slots.filter((s) => s.sp === 'b').map((s) => s.iStump), { far: 70 });
  const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  const setI = (i, on) => { i.mesh.setMatrixAt(i.idx, on ? m4.compose(v3.set(i.x, i.y, i.z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, i.rot), sc.setScalar(i.s)) : zero); i.mesh.instanceMatrix.needsUpdate = true; };
  function show(s) {
    const tree = s.st === 'tree' && !s.obj;
    setI(s.iTree, tree);
    if (s.iCrown) setI(s.iCrown, tree);
    setI(s.iStump, s.st === 'stump');
    s.col.off = s.st !== 'tree';
  }
  for (const s of slots) {
    const r = R0 * s.s + 0.03;
    s.col = { x0: s.x - r, x1: s.x + r, z0: s.z - r, z1: s.z + r, off: true };
    forest.addCollider(s.col);
    show(s);
  }

  // ------------------------------------------------------------------ un arbre entaillé, qui tombe, ou couché
  // repère : origine au pied, +z vers celui qui coupe (l'entaille), l'arbre tombe vers -z
  const coreGeo = new THREE.CylinderGeometry(1, 1, 1, 7);
  const discMat = new THREE.MeshStandardMaterial({ color: 0xd2b07c, roughness: 0.9, flatShading: true });
  const bark = (sp) => new THREE.MeshStandardMaterial({ color: BARK[sp], roughness: 1, flatShading: true });
  const barkMats = { e: bark('e'), b: bark('b') };
  const crownGeos = { e: mergeColored(crownParts('e')), b: mergeColored(crownParts('b', leafCol)) };
  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };
  // l'objet d'un arbre : le pied (avec l'entaille) et la partie haute, sur une charnière à l'arrière
  function makeObj(s) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = s.f;
    g.scale.setScalar(s.s);
    const rc = radiusAt(CUT);
    const lower = mesh(mergeColored(trunkParts(s.sp, 0, CUT - GAP)), itemMaterial);
    const discLo = mesh(new THREE.CylinderGeometry(rc, rc, 0.008, 7).translate(0, CUT - GAP, 0), discMat);
    const core = mesh(coreGeo, barkMats[s.sp]);
    const pivot = new THREE.Group();
    pivot.position.set(0, CUT, -rc);
    const top = new THREE.Group();
    top.position.set(0, -CUT, rc);
    pivot.add(top);
    g.add(lower, discLo, core, pivot);
    scene.add(g);
    const o = { s, g, lower, discLo, core, pivot, top, from: CUT + GAP, trunk: null, crown: null, discHi: null, band: null };
    setTrunk(o, CUT + GAP);
    o.crown = mesh(crownGeos[s.sp], leafMat);
    top.add(o.crown);
    s.obj = o;
    show(s);
    return o;
  }
  // la partie haute du tronc, à partir d'une hauteur (elle raccourcit à chaque bûche coupée)
  function setTrunk(o, from) {
    if (o.trunk) { o.top.remove(o.trunk); o.trunk.geometry.dispose(); }
    if (o.discHi) o.top.remove(o.discHi);
    o.from = from;
    o.trunk = mesh(mergeColored(trunkParts(o.s.sp, from, H)), itemMaterial);
    const r = radiusAt(from);
    o.discHi = mesh(new THREE.CylinderGeometry(r, r, 0.008, 7).translate(0, from, 0), discMat);
    o.top.add(o.trunk, o.discHi);
  }
  // l'entaille : le cœur du tronc qui reste, poussé vers l'arrière
  function setNotch(o) {
    const k = Math.min(1, o.s.n / CHOP.fell), rc = radiusAt(CUT);
    const r = rc * (1 - 0.86 * k);
    o.core.visible = o.s.st === 'tree';
    o.core.scale.set(r, GAP * 2, r);
    o.core.position.set(0, CUT, -(rc - r));
  }
  function dropObj(s) {
    const o = s.obj;
    if (!o) return;
    scene.remove(o.g);
    o.g.traverse((m) => { if (m.geometry && m.geometry !== coreGeo && m.geometry !== crownGeos.e && m.geometry !== crownGeos.b) m.geometry.dispose(); });
    s.obj = null;
    show(s);
  }
  // un arbre couché : la charnière tient au pied, le haut repose au sol
  const fallen = [];
  function lyingAngle(s) {
    const len = (H - CUT) * s.s, ca = Math.sin(s.f), cz = Math.cos(s.f);
    const hx = s.x - ca * radiusAt(CUT) * s.s, hz = s.z - cz * radiusAt(CUT) * s.s;
    const tx = hx - ca * len, tz = hz - cz * len;
    const drop = s.y + CUT * s.s - (forest.groundAt(tx, tz) + 0.06);
    return Math.max(1.25, Math.min(1.95, Math.PI / 2 + Math.atan2(drop, len)));
  }
  function addFallen(d) {
    const s = slots[d.id];
    if (!s) return null;
    const o = s.obj || makeObj(s);
    o.core.visible = false;
    o.lower.visible = o.discLo.visible = false; // la souche (instance) prend le relais
    const F = { s, o, stage: d.stage || 'branches', k: d.k || 0, theta: d.theta || lyingAngle(s), w: 0, falling: !!d.falling };
    o.pivot.rotation.x = -F.theta * (F.falling ? 0 : 1);
    if (F.stage !== 'branches') { o.crown.visible = false; }
    else o.crown.scale.set(1 - 0.95 * (F.k / CHOP.branches), 1, 1 - 0.95 * (F.k / CHOP.branches));
    if (F.stage === 'cut2') setTrunk(o, CUT + GAP + LOG.len / s.s);
    fallen.push(F);
    return F;
  }
  for (const d of (saved && saved.fallen) || []) addFallen(d);
  // point du tronc couché à une distance d (m) de la charnière
  const alongTrunk = (F, d) => { F.o.g.updateMatrixWorld(true); return F.o.top.localToWorld(new THREE.Vector3(0, CUT + GAP + d / F.s.s, 0)); };
  const fallDir = (s) => Math.atan2(Math.cos(s.f), -Math.sin(s.f)); // rotation d'une bûche couchée dans le sens de l'arbre

  // ------------------------------------------------------------------ copeaux qui volent à chaque coup
  const CN = 60, cpos = new Float32Array(CN * 3), cvel = new Float32Array(CN * 3), clife = new Float32Array(CN);
  const cgeo = new THREE.BufferGeometry();
  cgeo.setAttribute('position', new THREE.BufferAttribute(cpos, 3));
  const chips = new THREE.Points(cgeo, new THREE.PointsMaterial({ color: 0xd9b98a, size: 0.018, transparent: true, opacity: 0.9, depthWrite: false }));
  chips.frustumCulled = false;
  scene.add(chips);
  let cNext = 0;
  function emitChips(at, toward, n = 7) {
    for (let k = 0; k < n; k++) {
      const i = cNext++ % CN;
      cpos.set([at.x, at.y, at.z], i * 3);
      cvel.set([toward.x * 1.4 + (Math.random() - 0.5) * 1.6, 0.8 + Math.random() * 1.4, toward.z * 1.4 + (Math.random() - 0.5) * 1.6], i * 3);
      clife[i] = 0.5 + Math.random() * 0.4;
    }
  }

  // ------------------------------------------------------------------ couper
  let job = null;
  const notchPoint = (s) => new THREE.Vector3(0, CUT, radiusAt(CUT)).multiplyScalar(s.s).applyAxisAngle(THREE.Object3D.DEFAULT_UP, s.f).add(v3.set(s.x, s.y, s.z));
  function start(hit, player) {
    if (job || hands.busy) return;
    if (hit.kind === 'tree') {
      const s = hit.slot;
      if (!s.n) s.f = Math.atan2(player.x - s.x, player.z - s.z); // l'entaille face à soi, il tombera de l'autre côté
      if (!s.obj) makeObj(s);
      setNotch(s.obj);
      job = { kind: 'fell', s, running: true };
      const at = notchPoint(s);
      hands.chop(at, () => job && job.running, () => hitTree(s, at), { approach: 0.75 }).then(endJob);
    } else {
      const F = hit.fallen;
      const d = F.stage === 'branches' ? 3.6 : F.stage === 'cut1' ? LOG.len : LOG.len * 2;
      const at = alongTrunk(F, d);
      at.y = Math.min(at.y, forest.groundAt(at.x, at.z) + 0.55);
      job = { kind: F.stage, F, running: true };
      hands.chop(at, () => job && job.running, () => hitFallen(F, at), { approach: 0.85 }).then(endJob);
    }
    onChange?.();
  }
  function endJob() { job = null; onChange?.(); }
  function stop() { if (job) job.running = false; }
  function hitTree(s, at) {
    s.n++;
    emitChips(at, v3.set(Math.sin(s.f), 0, Math.cos(s.f)).clone());
    setNotch(s.obj);
    if (s.n === CHOP.fell - 6) audio()?.tick('creak');
    if (s.n >= CHOP.fell) {
      job.running = false;
      fell(s);
    }
    onChange?.();
  }
  // l'arbre bascule autour de sa charnière, de plus en plus vite, et s'abat
  function fell(s) {
    s.st = 'stump';
    s.at = Date.now();
    s.dirty = true;
    show(s);
    audio()?.tick('creak');
    const F = addFallen({ id: s.id, stage: 'branches', k: 0, falling: true });
    F.theta = 0.04; F.w = 0.12; F.target = lyingAngle(s); F.falling = true;
    // un autre jeune arbre repoussera ailleurs, loin d'ici, dans 3 jours
    const free = slots.filter((x) => x.st === 'empty' && Math.hypot(x.x - s.x, x.z - s.z) > 40);
    if (free.length) { const t = free[Math.floor(Math.random() * free.length)]; t.st = 'grow'; t.at = Date.now() + REGROW; t.dirty = true; }
    hint('L’arbre tombe !', 2500);
  }
  function hitFallen(F, at) {
    F.k++;
    emitChips(at, v3.set(Math.random() - 0.5, 0, Math.random() - 0.5).clone(), 5);
    const s = F.s;
    if (F.stage === 'branches') {
      const k = 1 - 0.95 * (F.k / CHOP.branches);
      F.o.crown.scale.set(k, 1, k);
      audio()?.tick('rustle');
      // les branches coupées tombent : ce sont des bâtons
      if ([2, 3, 5, 6, 8, 10].includes(F.k)) {
        const p = alongTrunk(F, 2.6 + Math.random() * 3), side = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.4), a = fallDir(s) + Math.PI / 2;
        items.drop('baton', p.x + Math.cos(a) * side, p.z - Math.sin(a) * side, Math.random() * 6.28);
      }
      if (F.k >= CHOP.branches) { F.o.crown.visible = false; F.stage = 'cut1'; F.k = 0; job.running = false; hint('Arbre ébranché. Coupe maintenant le tronc en bûches.', 3500); }
    } else if (F.stage === 'cut1' || F.stage === 'cut2') {
      if (F.k >= CHOP.cut) {
        job.running = false;
        const first = F.stage === 'cut1';
        const c = alongTrunk(F, first ? LOG.len / 2 : LOG.len * 1.5);
        logs.add(c.x, c.z, fallDir(s));
        audio()?.tick('thud');
        if (first) { F.stage = 'cut2'; F.k = 0; setTrunk(F.o, CUT + GAP + LOG.len / s.s); hint('Une bûche ! Touche-la pour la mettre sur l’épaule.', 3500); }
        else {
          // le bout de la cime fait un dernier bâton
          const t = alongTrunk(F, LOG.len * 2 + 0.5);
          items.drop('baton', t.x, t.z, fallDir(s));
          fallen.splice(fallen.indexOf(F), 1);
          dropObj(s);
          hint('Deuxième bûche. L’arbre est entièrement débité.', 3500);
        }
      }
    }
    onChange?.();
  }

  // ------------------------------------------------------------------ toucher
  const p3 = new THREE.Vector3();
  const screen = (x, y, z, camera) => { p3.set(x, y, z).project(camera); return p3.z > 1 ? null : [(p3.x * 0.5 + 0.5) * innerWidth, (-p3.y * 0.5 + 0.5) * innerHeight]; };
  function pickAt(camera, px, py, player, reach = 1.6) {
    let best = null, bd = Infinity;
    const r = 8;
    for (let i = Math.floor((player.x - r) / 6); i <= Math.floor((player.x + r) / 6); i++) for (let j = Math.floor((player.z - r) / 6); j <= Math.floor((player.z + r) / 6); j++) {
      for (const s of G.get(i * 10000 + j) || []) {
        if (s.st !== 'tree') continue;
        const dist = Math.hypot(s.x - player.x, s.z - player.z);
        if (dist > 7) continue;
        for (let h = 0.3; h < 3; h += 0.25) {
          const p = screen(s.x, s.y + h, s.z, camera);
          if (!p) continue;
          const rad = Math.max(60, Math.min(150, (innerHeight * 0.12) / Math.max(0.5, dist)));
          const d = Math.hypot(p[0] - px, p[1] - py);
          if (d < rad && d < bd) { bd = d; best = { kind: 'tree', slot: s, near: dist <= reach + 0.1 }; }
        }
      }
    }
    for (const F of fallen) {
      if (F.falling) continue;
      for (let dd = 0.3; dd < (H - CUT) * F.s.s; dd += 0.3) {
        if (F.stage === 'cut2' && dd < LOG.len) continue;
        const w = alongTrunk(F, dd);
        const dist = Math.hypot(w.x - player.x, w.z - player.z);
        if (dist > 7) continue;
        const p = screen(w.x, w.y, w.z, camera);
        if (!p) continue;
        const rad = Math.max(40, Math.min(150, (innerHeight * 0.13) / Math.max(0.5, dist)));
        const d = Math.hypot(p[0] - px, p[1] - py);
        if (d < rad && d < bd) { bd = d; best = { kind: 'fallen', fallen: F, near: dist <= reach + 0.3 }; }
      }
    }
    return best;
  }
  // les grands arbres de la forêt : trop gros pour une hachette en silex
  const BIG = new Map();
  for (const t of [...forest.spruces, ...forest.birches]) { if (!forest.inWalk(t.x, t.z, 2)) continue; const k = gk(t.x, t.z); if (!BIG.has(k)) BIG.set(k, []); BIG.get(k).push(t); }
  function pickBig(camera, px, py, player) {
    for (let i = Math.floor((player.x - 4) / 6); i <= Math.floor((player.x + 4) / 6); i++) for (let j = Math.floor((player.z - 4) / 6); j <= Math.floor((player.z + 4) / 6); j++) {
      for (const t of BIG.get(i * 10000 + j) || []) {
        const dist = Math.hypot(t.x - player.x, t.z - player.z);
        if (dist > 3.5) continue;
        const p = screen(t.x, t.y + 1.3, t.z, camera);
        if (p && Math.hypot(p[0] - px, p[1] - py) < Math.max(70, innerHeight * 0.18 / dist)) return t;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ chaque image
  let timer = 0;
  function update(dt, player) {
    // chutes
    for (const F of fallen) {
      if (!F.falling) continue;
      const len = (H - CUT) * F.s.s;
      F.w += (3 * 9.81 / (2 * len)) * Math.sin(F.theta) * dt;
      F.theta += F.w * dt;
      if (F.theta >= F.target) {
        if (!F.hit) { F.hit = true; audio()?.tick('fall'); onChange?.(); }
        F.theta = F.target;
        F.w = -F.w * 0.18;
        if (Math.abs(F.w) < 0.05) { F.falling = false; F.theta = F.target; }
      }
      F.o.pivot.rotation.x = -F.theta;
    }
    // copeaux
    for (let i = 0; i < CN; i++) {
      if (clife[i] <= 0) { cpos[i * 3 + 1] = -9999; continue; }
      clife[i] -= dt;
      cvel[i * 3 + 1] -= 7 * dt;
      for (let k = 0; k < 3; k++) cpos[i * 3 + k] += cvel[i * 3 + k] * dt;
    }
    cgeo.attributes.position.needsUpdate = true;
    // entailles commencées : visibles de près ; repousses
    timer -= dt;
    if (timer > 0) return;
    timer = 2;
    const now = Date.now();
    for (const s of slots) {
      if (s.st === 'tree' && s.n > 0 && !(job && job.s === s)) {
        const d = Math.hypot(s.x - player.x, s.z - player.z);
        if (d < 70 && !s.obj) setNotch(makeObj(s));
        else if (d > 90 && s.obj) dropObj(s);
      } else if (s.st === 'grow' && now >= s.at && Math.hypot(s.x - player.x, s.z - player.z) > 6) { s.st = 'tree'; s.n = 0; s.dirty = true; show(s); }
      else if (s.st === 'stump' && now - s.at > STUMP_LIFE && !fallen.some((F) => F.s === s)) { s.st = 'empty'; s.dirty = true; show(s); }
    }
  }
  // indice selon ce qu'on regarde, hachette en main
  function label(player) {
    let best = null, bd = 2.4;
    for (const s of slots) {
      if (Math.abs(s.x - player.x) > 3 || Math.abs(s.z - player.z) > 3 || s.st !== 'tree') continue;
      const d = Math.hypot(s.x - player.x, s.z - player.z);
      if (d < bd) { bd = d; best = s; }
    }
    if (best) return best.n ? `Jeune arbre entaillé : ${best.n}/${CHOP.fell} coups` : 'Touche le jeune arbre pour l’abattre (80 coups)';
    for (const F of fallen) {
      if (F.falling) continue;
      const w = alongTrunk(F, F.stage === 'branches' ? 3.6 : F.stage === 'cut1' ? LOG.len : LOG.len * 2);
      if (Math.hypot(w.x - player.x, w.z - player.z) < 3.5) return F.stage === 'branches' ? `Ébrancher l’arbre (${F.k}/${CHOP.branches})` : `Couper une bûche (${F.k}/${CHOP.cut})`;
    }
    return '';
  }
  function progress() {
    if (!job) return '';
    if (job.kind === 'fell') return `Abattage : ${job.s.n}/${CHOP.fell} coups`;
    if (job.kind === 'branches') return `Ébranchage : ${job.F.k}/${CHOP.branches} coups`;
    return `Bûche : ${job.F.k}/${CHOP.cut} coups`;
  }

  return {
    update, pickAt, pickBig, start, stop, label, progress, slots, fallen,
    get chopping() { return !!job; },
    data: () => ({
      s: Object.fromEntries(slots.filter((s) => s.dirty || s.n || s.st !== (s.id < ACTIVE ? 'tree' : 'empty')).map((s) => [s.id, { st: s.st, n: s.n, f: +s.f.toFixed(3), at: s.at }])),
      fallen: fallen.map((F) => ({ id: F.s.id, stage: F.stage, k: F.k, theta: +(F.falling ? F.target : F.theta).toFixed(3) })),
    }),
  };
}
