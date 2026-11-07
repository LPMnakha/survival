// Petit feu de camp : on place la preview au sol, puis on pose les éléments un
// par un (8 cailloux en cercle, 10 brindilles au centre, 4 bâtons en tipi).
// Une fois monté, on l'allume avec la pierre à feu (1 à 3 essais). Il brûle
// 10 min, chaque bâton ajoute 5 min (20 min de réserve au plus), en temps réel,
// même appli fermée. Éteint, il faut 3 brindilles pour le rallumer.
// Flammes, braises, halo et étincelles repris du feu de cheminée de Détente.
import * as THREE from '../vendor/three.module.min.js';
import { itemGeometry, itemMaterial, itemName } from './models.js';
import { glow } from './textures.js';

const MIN = 60e3;
export const FIRE = { first: 10 * MIN, add: 5 * MIN, max: 20 * MIN, tinder: 3, ember: 60e3, ignite: 8 };
const soft = (t, s) => 0.5 + 0.25 * Math.sin(t * 1.7 + s) + 0.15 * Math.sin(t * 3.1 + s * 2.3) + 0.1 * Math.sin(t * 5.3 + s * 0.7);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ la recette, pièce par pièce (repère du feu)
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0);
const piece = (type, variant, x, y, z, rx, ry, rz, s = 1) => ({ type, variant, m: new THREE.Matrix4().compose(v3.set(x, y, z), q.setFromEuler(e3.set(rx, ry, rz)), s3.setScalar(s)) });
const lean = (type, base, top, s = 1) => {
  const dir = top.clone().sub(base).normalize();
  const c = base.clone().addScaledVector(dir, 0.36 * s);
  return { type, variant: 0, m: new THREE.Matrix4().compose(c, new THREE.Quaternion().setFromUnitVectors(X, dir), s3.setScalar(s)) };
};
const PIECES = [];
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  PIECES.push(piece('caillou', i % 3, Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36, 0, -a + i * 0.7, 0, 1.25));
}
for (let k = 0; k < 10; k++) {
  const a = k * 2.39996, r = 0.03 + (k % 3) * 0.035;
  PIECES.push(piece('brindille', 0, Math.cos(a) * r, 0.004 + k * 0.011, Math.sin(a) * r, k % 2 ? 0.14 : -0.12, k * 1.13, ((k % 3) - 1) * 0.16, 0.85));
}
for (let k = 0; k < 4; k++) {
  const a = k * Math.PI / 2 + Math.PI / 4;
  PIECES.push(lean('baton', new THREE.Vector3(Math.cos(a) * 0.26, 0.02, Math.sin(a) * 0.26), new THREE.Vector3(-Math.cos(a) * 0.03, 0.5, -Math.sin(a) * 0.03), 0.95));
}
export const RECIPE = { name: 'Petit feu de camp', needs: { caillou: 8, brindille: 10, baton: 4 } };
const TINDER = PIECES.filter((p) => p.type === 'brindille').slice(0, FIRE.tinder);
const FUEL = [piece('baton', 0, 0, 0.07, 0, 0.1, 0.5, 0.06, 0.8), piece('baton', 0, 0, 0.1, 0, -0.08, 2.1, -0.05, 0.8)];
const ASH = [[0, 0.02, 0, 0.16], [0.08, 0.025, -0.05, 0.1], [-0.07, 0.022, 0.06, 0.11]];

export function createCampfires(scene, { forest, inventory, hands, getAudio, hint, onChange, saved, others }) {
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0xf4e9da, transparent: true, opacity: 0.2, depthWrite: false });
  const nextMat = new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.5, depthWrite: false });
  const badMat = new THREE.MeshBasicMaterial({ color: 0xe0705a, transparent: true, opacity: 0.3, depthWrite: false });
  const charMat = new THREE.MeshStandardMaterial({ color: 0x161210, roughness: 1, flatShading: true, emissive: 0xff5a1a, emissiveIntensity: 0 });
  const ashMat = new THREE.MeshStandardMaterial({ color: 0x5a5550, roughness: 1, flatShading: true, emissive: 0xff5a1a, emissiveIntensity: 0 });
  const emberMat = new THREE.MeshStandardMaterial({ color: 0x3a1a0c, emissive: 0xff6a20, emissiveIntensity: 1.2, flatShading: true });
  const haloTex = glow('rgba(255,170,90,0.9)', 'rgba(255,90,20,0)');
  const ashGeo = new THREE.IcosahedronGeometry(1, 0).scale(1, 0.25, 1);
  const audio = () => getAudio?.();

  const sites = [];
  const worldOf = (site, p, out = new THREE.Vector3()) => out.setFromMatrixPosition(p.m).applyAxisAngle(THREE.Object3D.DEFAULT_UP, site.rot).add(v3.set(site.x, site.y, site.z));
  const meshOf = (p, mat) => {
    const m = new THREE.Mesh(itemGeometry(p.type, p.variant), mat);
    m.matrixAutoUpdate = false;
    m.matrix.copy(p.m);
    m.castShadow = mat === itemMaterial || mat === charMat;
    m.receiveShadow = true;
    return m;
  };

  // ------------------------------------------------------------------ flammes (comme la cheminée de Détente, en plus petit)
  function makeFlames() {
    const g = new THREE.Group();
    const flames = [];
    const layers = [
      { n: 5, color: 0xff6a1f, r: 0.09, h: 0.45, spread: 0.26, op: 0.55 },
      { n: 4, color: 0xffa23a, r: 0.065, h: 0.34, spread: 0.2, op: 0.65 },
      { n: 3, color: 0xffe08a, r: 0.04, h: 0.22, spread: 0.12, op: 0.8 },
    ];
    layers.forEach((Ly, li) => {
      for (let i = 0; i < Ly.n; i++) {
        const geo = new THREE.ConeGeometry(Ly.r, Ly.h, 5, 1).translate(0, Ly.h / 2, 0);
        const mat = new THREE.MeshBasicMaterial({ color: Ly.color, transparent: true, opacity: Ly.op, blending: THREE.AdditiveBlending, depthWrite: false });
        const m = new THREE.Mesh(geo, mat);
        const a = (i / Ly.n) * Math.PI * 2 + li;
        m.position.set(Math.cos(a) * Ly.spread * 0.4, 0.03, Math.sin(a) * Ly.spread * 0.4);
        m.userData = { seed: Math.random() * 100, base: m.position.clone(), h: 0.75 + Math.random() * 0.4, speed: 0.9 + Math.random() * 0.6, op: Ly.op };
        g.add(m);
        flames.push(m);
      }
    });
    const embers = [];
    for (let i = 0; i < 10; i++) {
      const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025 + Math.random() * 0.02, 0), emberMat);
      e.position.set((Math.random() - 0.5) * 0.3, 0.015, (Math.random() - 0.5) * 0.3);
      g.add(e);
      embers.push(e);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
    halo.scale.set(1.2, 1.0, 1);
    halo.position.set(0, 0.28, 0);
    g.add(halo);
    const N = 20, pp = new Float32Array(N * 3), life = new Float32Array(N);
    const reset = (i, t = Math.random()) => { pp[i * 3] = (Math.random() - 0.5) * 0.3; pp[i * 3 + 1] = 0.1 + t * 0.7; pp[i * 3 + 2] = (Math.random() - 0.5) * 0.3; life[i] = t; };
    for (let i = 0; i < N; i++) reset(i);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    const sparks = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffb060, size: 0.022, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(sparks);
    function update(t, dt, k) {
      for (const f of flames) {
        const u = f.userData, kk = soft(t * u.speed, u.seed);
        f.scale.set((0.85 + kk * 0.3) * (0.5 + 0.5 * k), u.h * (0.6 + kk * 0.7) * k, (0.85 + kk * 0.3) * (0.5 + 0.5 * k));
        f.position.x = u.base.x + Math.sin(t * 1.3 + u.seed) * 0.02;
        f.rotation.y = t * 0.3 + u.seed;
        f.rotation.z = Math.sin(t * 0.9 + u.seed) * 0.08;
        f.material.opacity = u.op * Math.min(1, k * 1.5);
      }
      for (let i = 0; i < N; i++) {
        life[i] += dt * (0.25 + (i % 5) * 0.04);
        if (life[i] > 1) reset(i, 0);
        pp[i * 3 + 1] += dt * 0.35;
        pp[i * 3] += Math.sin(t * 2 + i) * dt * 0.05;
      }
      pg.attributes.position.needsUpdate = true;
      sparks.material.opacity = 0.8 * k;
      halo.material.opacity = (0.32 + soft(t * 1.4, 3.1) * 0.2) * k;
    }
    function dispose() {
      g.traverse((o) => { if (o.isSprite) { o.material.dispose(); return; } if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== emberMat) o.material.dispose(); });
    }
    return { g, update, dispose };
  }

  // étincelles de la pierre à feu
  const SN = 80, spos = new Float32Array(SN * 3), svel = new Float32Array(SN * 3), slife = new Float32Array(SN);
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const strikeSparks = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xffd08a, size: 0.026, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  strikeSparks.frustumCulled = false;
  scene.add(strikeSparks);
  let sNext = 0;
  function emitSparks(at, toward, n = 22) {
    const dir = toward.clone().sub(at).normalize();
    for (let k = 0; k < n; k++) {
      const i = sNext++ % SN;
      spos.set([at.x, at.y, at.z], i * 3);
      svel.set([dir.x * 1.4 + (Math.random() - 0.5) * 0.9, dir.y * 1.4 + Math.random() * 0.3, dir.z * 1.4 + (Math.random() - 0.5) * 0.9], i * 3);
      slife[i] = 0.25 + Math.random() * 0.35;
    }
  }

  // lumière : deux lampes partagées, données aux feux allumés les plus proches
  const lights = [0, 1].map(() => { const l = new THREE.PointLight(0xff9a50, 0, 11, 1.4); scene.add(l); return l; });

  // ------------------------------------------------------------------ chaque feu
  const kIgnite = (site, now) => Math.min(1, (now - site.litAt) / 1000 / FIRE.ignite);
  function strength(site, now) {
    if (site.stage !== 'lit') return 0;
    const rem = site.fuelEnd - now;
    return (0.12 + 0.88 * kIgnite(site, now)) * (0.3 + 0.7 * smooth(0, 3 * MIN, rem));
  }
  function sync(site, now = Date.now()) {
    if (site.stage === 'lit' && now >= site.fuelEnd) {
      site.stage = 'out'; site.outAt = site.fuelEnd; site.tinder = 0; site.adds = 0;
      rebuild(site);
      onChange?.();
    }
  }
  function addCollider(site) {
    if (site.col || site.placed < 1) return;
    site.col = { x0: site.x - 0.42, x1: site.x + 0.42, z0: site.z - 0.42, z1: site.z + 0.42 };
    forest.colliders.push(site.col);
  }
  function rebuild(site) {
    const g = site.group;
    for (const c of [...g.children]) if (c !== site.flames?.g) g.remove(c);
    const now = Date.now();
    site.burnt = site.stage === 'lit' && now - site.litAt > 2 * MIN;
    PIECES.forEach((p, i) => {
      let mat = null;
      if (site.stage === 'build') mat = i < site.placed ? itemMaterial : i === site.placed ? nextMat : ghostMat;
      else if (site.stage === 'built') mat = itemMaterial;
      else if (p.type === 'caillou') mat = itemMaterial;
      else if (site.stage === 'lit' && p.type === 'baton') mat = charMat;
      else if (site.stage === 'lit' && p.type === 'brindille' && !site.burnt) mat = charMat;
      if (mat) g.add(meshOf(p, mat));
    });
    if (site.stage === 'lit') for (let i = 0; i < Math.min(2, site.adds || 0); i++) g.add(meshOf(FUEL[i], charMat));
    if (site.stage === 'out') {
      for (const [x, y, z, s] of ASH) { const m = new THREE.Mesh(ashGeo, ashMat); m.position.set(x, y, z); m.scale.setScalar(s); g.add(m); }
      TINDER.forEach((p, i) => g.add(meshOf(p, i < site.tinder ? itemMaterial : i === site.tinder ? nextMat : ghostMat)));
    }
    if (site.stage === 'lit' && !site.flames) { site.flames = makeFlames(); g.add(site.flames.g); }
    if (site.stage !== 'lit' && site.flames) { g.remove(site.flames.g); site.flames.dispose(); site.flames = null; }
    addCollider(site);
  }
  function addSite(d) {
    const site = { x: d.x, z: d.z, rot: d.rot || 0, y: forest.groundAt(d.x, d.z) + 0.06, placed: d.placed || 0, stage: d.stage || 'build', fuelEnd: d.fuelEnd || 0, litAt: d.litAt || 0, outAt: d.outAt || 0, tinder: d.tinder || 0, adds: d.adds || 0 };
    site.group = new THREE.Group();
    site.group.position.set(site.x, site.y, site.z);
    site.group.rotation.y = site.rot;
    scene.add(site.group);
    sites.push(site);
    sync(site);
    rebuild(site);
    return site;
  }
  for (const d of (saved && saved.sites) || []) if (Number.isFinite(d.x) && Number.isFinite(d.z)) addSite(d);

  // ------------------------------------------------------------------ preview à placer
  let preview = null;
  const ghostGroup = new THREE.Group();
  PIECES.forEach((p) => ghostGroup.add(meshOf(p, ghostMat)));
  ghostGroup.visible = false;
  scene.add(ghostGroup);
  function validSpot(x, z) {
    if (!forest.inWalk(x, z, -1.5)) return false;
    if (forest.streamDist(x, z) < 2.6) return false;
    if (forest.blocked(x, z, 0.7)) return false;
    if (sites.some((s) => Math.hypot(s.x - x, s.z - z) < 2.4) || (others?.() || []).some((s) => Math.hypot(s.x - x, s.z - z) < 2.2)) return false;
    const h = forest.groundAt(x, z);
    return [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].every(([dx, dz]) => Math.abs(forest.groundAt(x + dx, z + dz) - h) < 0.22);
  }
  function startPlacement() { preview = { x: 0, z: 0, rot: 0, ok: false }; ghostGroup.visible = true; }
  function cancelPlacement() { preview = null; ghostGroup.visible = false; }
  function confirmPlacement() {
    if (!preview || !preview.ok) return false;
    addSite({ x: preview.x, z: preview.z, rot: preview.rot });
    cancelPlacement();
    onChange?.();
    return true;
  }
  function updatePreview(player, yaw) {
    const x = player.x - Math.sin(yaw) * 2.0, z = player.z - Math.cos(yaw) * 2.0;
    preview.x = x; preview.z = z; preview.rot = yaw;
    preview.ok = validSpot(x, z) && Math.hypot(x - player.x, z - player.z) > 1.2;
    ghostGroup.position.set(x, forest.groundAt(x, z) + 0.06, z);
    ghostGroup.rotation.y = yaw;
    for (const m of ghostGroup.children) m.material = preview.ok ? ghostMat : badMat;
  }

  // ------------------------------------------------------------------ toucher un feu
  const p3 = new THREE.Vector3();
  function pickAt(camera, px, py, player, reach = 3.0) {
    let best = null, bd = Infinity;
    for (const s of sites) {
      const dist = Math.hypot(s.x - player.x, s.z - player.z);
      if (dist > 7) continue;
      p3.set(s.x, s.y + 0.15, s.z).project(camera);
      if (p3.z > 1) continue;
      const sx = (p3.x * 0.5 + 0.5) * innerWidth, sy = (-p3.y * 0.5 + 0.5) * innerHeight;
      // le feu occupe environ 1 m à l'écran : on accepte un toucher dans ce rayon
      const rad = Math.max(60, Math.min(220, (innerHeight * 0.55) / Math.max(0.5, dist)));
      const d = Math.hypot(sx - px, sy - py);
      if (d < rad && d < bd) { bd = d; best = s; }
    }
    if (!best) return null;
    return { site: best, near: Math.hypot(best.x - player.x, best.z - player.z) <= reach };
  }
  const nearest = (player, r) => {
    let best = null, bd = r;
    for (const s of sites) { const d = Math.hypot(s.x - player.x, s.z - player.z); if (d < bd) { bd = d; best = s; } }
    return best;
  };

  const tinderPos = (site) => new THREE.Vector3(site.x, site.y + 0.06, site.z);
  function lack(type, left) { hint(`Il te faut encore ${left} ${itemName(type, left)}.`); }
  // poser un objet du feu : l'inventaire fournit l'objet, la main le pose
  function placePiece(site, p, after) {
    if (!inventory.take(p.type)) return false;
    hands.place(worldOf(site, p), p.type, () => { audio()?.place(p.type); after(); rebuild(site); onChange?.(); });
    return true;
  }
  function act(site) {
    if (hands.busy) return;
    const now = Date.now();
    sync(site, now);
    if (site.stage === 'build') {
      const p = PIECES[site.placed];
      if (!inventory.count(p.type)) return lack(p.type, PIECES.slice(site.placed).filter((x) => x.type === p.type).length);
      placePiece(site, p, () => {
        site.placed++;
        if (site.placed >= PIECES.length) { site.stage = 'built'; hint('Le feu de camp est prêt. Prends la pierre à feu en main pour l’allumer.'); }
      });
      return;
    }
    if (site.stage === 'out' && site.tinder < FIRE.tinder) {
      if (!inventory.count('brindille')) return lack('brindille', FIRE.tinder - site.tinder);
      placePiece(site, TINDER[site.tinder], () => {
        site.tinder++;
        if (site.tinder >= FIRE.tinder) hint('Tu peux le rallumer avec la pierre à feu.');
      });
      return;
    }
    if (site.stage === 'built' || site.stage === 'out') {
      if (inventory.heldType() !== 'pierre-a-feu') return hint('Prends la pierre à feu en main pour allumer le feu.');
      const attempts = 1 + Math.floor(Math.random() * 3);
      const target = tinderPos(site);
      hands.strike(target, attempts, (i, tip, last) => {
        emitSparks(tip, target);
        audio()?.strike();
        if (last) {
          site.stage = 'lit'; site.litAt = Date.now(); site.fuelEnd = site.litAt + FIRE.first; site.tinder = 0; site.adds = 0;
          audio()?.ignite();
          rebuild(site);
          onChange?.();
        }
      });
      return;
    }
    if (site.stage === 'lit') {
      const rem = site.fuelEnd - now;
      if (rem > FIRE.max - FIRE.add) return hint('Le feu a assez de bois pour le moment.');
      if (!inventory.count('baton')) return hint('Il te faut un bâton pour alimenter le feu.');
      const p = FUEL[Math.min(1, site.adds || 0)];
      placePiece(site, p, () => {
        const t = Date.now();
        sync(site, t);
        if (site.stage !== 'lit') { inventory.add('baton'); return; }
        site.fuelEnd = Math.min(t + FIRE.max, Math.max(t, site.fuelEnd) + FIRE.add);
        site.adds = (site.adds || 0) + 1;
      });
    }
  }
  // démonter un feu pas encore terminé : on récupère ce qui a été posé
  function dismantle(site) {
    if (site.stage !== 'build' || hands.busy) return;
    while (site.placed > 0 && inventory.add(PIECES[site.placed - 1].type)) site.placed--;
    if (site.placed > 0) { hint('Inventaire plein : le reste est resté au sol.'); rebuild(site); onChange?.(); return; }
    scene.remove(site.group);
    if (site.col) forest.colliders.splice(forest.colliders.indexOf(site.col), 1);
    sites.splice(sites.indexOf(site), 1);
    onChange?.();
  }
  // ce qu'on peut faire avec ce feu, pour l'indice affiché
  function label(site) {
    const now = Date.now();
    if (site.stage === 'build') { const p = PIECES[site.placed]; return `Poser ${p.type === 'caillou' ? 'un caillou' : p.type === 'brindille' ? 'une brindille' : 'un bâton'} (${site.placed}/${PIECES.length})`; }
    if (site.stage === 'built') return 'Allumer avec la pierre à feu';
    if (site.stage === 'out') return site.tinder < FIRE.tinder ? `Feu éteint : remettre des brindilles (${site.tinder}/${FIRE.tinder})` : 'Rallumer avec la pierre à feu';
    const m = Math.max(0, Math.ceil((site.fuelEnd - now) / MIN));
    return `Le feu brûle encore ${m} min · touche pour ajouter un bâton`;
  }

  // ------------------------------------------------------------------ chaque image
  let t = 0, lightTimer = 0, assigned = [];
  const out = { level: 0, hand: 0, dir: new THREE.Vector3() };
  function update(dt, player, camera, yaw) {
    t += dt;
    const now = Date.now();
    if (preview) updatePreview(player, yaw);
    nextMat.opacity = 0.35 + 0.25 * Math.sin(t * 3.2);
    out.level = 0; out.hand = 0;
    for (const s of sites) {
      sync(s, now);
      if (s.stage === 'lit' && !s.burnt && now - s.litAt > 2 * MIN) rebuild(s);
      const k = strength(s, now);
      const d = Math.hypot(s.x - player.x, s.z - player.z);
      if (s.flames && d < 80) s.flames.update(t, dt, k);
      if (k > 0) {
        out.level = Math.max(out.level, k / (1 + d * d * 0.09));
        const h = k / (1 + d * d * 0.15);
        if (h > out.hand) { out.hand = h; out.dir.set(s.x - player.x, 0.3, s.z - player.z).normalize(); }
      }
      // braises qui s'éteignent doucement après la dernière flamme
      if (s.stage === 'out') s.ember = Math.max(0, 1 - (now - s.outAt) / FIRE.ember);
    }
    charMat.emissiveIntensity = 0.06 + soft(t * 0.6, 8) * 0.1;
    emberMat.emissiveIntensity = 1.0 + soft(t * 0.6, 8) * 0.6;
    const glowOut = sites.reduce((a, s) => Math.max(a, s.stage === 'out' ? s.ember || 0 : 0), 0);
    ashMat.emissiveIntensity = glowOut * 0.8;
    // les deux feux allumés les plus proches éclairent
    lightTimer -= dt;
    if (lightTimer <= 0) {
      lightTimer = 0.5;
      assigned = sites.filter((s) => s.stage === 'lit').sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z)).slice(0, 2);
    }
    lights.forEach((l, i) => {
      const s = assigned[i];
      if (!s || s.stage !== 'lit') { l.intensity = 0; return; }
      l.position.set(s.x, s.y + 0.85, s.z);
      l.intensity = 6 * strength(s, now) * (0.82 + soft(t * 1.4, 3.1 + i) * 0.3);
    });
    // étincelles de la pierre à feu
    for (let i = 0; i < SN; i++) {
      if (slife[i] <= 0) { spos[i * 3 + 1] = -9999; continue; }
      slife[i] -= dt;
      svel[i * 3 + 1] -= 4.5 * dt;
      for (let k = 0; k < 3; k++) spos[i * 3 + k] += svel[i * 3 + k] * dt;
    }
    sgeo.attributes.position.needsUpdate = true;
    return out;
  }

  return {
    update, act, dismantle, label, pickAt, nearest,
    startPlacement, cancelPlacement, confirmPlacement,
    get placing() { return !!preview; }, get placeOk() { return !!preview && preview.ok; },
    sites,
    data: () => ({ sites: sites.map(({ x, z, rot, placed, stage, fuelEnd, litAt, outAt, tinder, adds }) => ({ x, z, rot, placed, stage, fuelEnd, litAt, outAt, tinder, adds })) }),
  };
}
