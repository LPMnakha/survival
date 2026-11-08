// Métier à tisser : un cadre carré (70 cm) tenu par deux pieds en A, ligaturé
// aux angles ; encoches en haut et en bas pour tendre la chaîne. Monté pièce
// par pièce (8 bâtons, 4 cordes). On y fabrique le tissu en fibres naturelles :
// 4 cordes tendues une par une (la chaîne), 2 tissées en travers (la trame),
// 30 minutes de tissage actif, assis devant le métier ; on peut s'arrêter et reprendre.
import * as THREE from '../vendor/three.module.min.js';
import { itemGeometry, itemMaterial, anItem } from './models.js';
import { mergeColored } from './builder.js';

export const RECIPE5 = { name: 'Métier à tisser', needs: { baton: 8, corde: 4 } };
export const WEAVES = [{ id: 'tissu', name: 'Tissu en fibres naturelles', warp: 4, weft: 2, ms: 30 * 60e3, out: 'tissu', note: '4 cordes tendues sur le cadre, 2 tissées en travers · 30 min de tissage' }];

const Y0 = 0.3, Y1 = 1.0, HW = 0.36; // bas et haut du cadre, demi-largeur
const X = new THREE.Vector3(1, 0, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const branch = (a, b, thick = 1.25) => {
  const d = b.clone().sub(a), len = d.length();
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(X, d.normalize()), new THREE.Vector3(len / 0.72, thick, thick));
};
const lashGeo = mergeColored([
  [new THREE.TorusGeometry(0.04, 0.011, 4, 10), 0xa48d62],
  [new THREE.TorusGeometry(0.04, 0.011, 4, 10).rotateY(Math.PI / 2), 0xb59e70],
]);
const PIECES = [
  // pieds en A (de chaque côté : un pied avant, un pied arrière)
  ...[-1, 1].flatMap((s) => [
    { type: 'baton', m: branch(V(s * 0.42, -0.04, 0.26), V(s * (HW + 0.03), 0.8, 0)) },
    { type: 'baton', m: branch(V(s * 0.42, -0.04, -0.26), V(s * (HW + 0.03), 0.8, 0)) },
  ]),
  // le cadre : montants, traverse du bas, traverse du haut
  { type: 'baton', m: branch(V(-HW, Y0 - 0.07, 0), V(-HW, Y1 + 0.07, 0)) },
  { type: 'baton', m: branch(V(HW, Y0 - 0.07, 0), V(HW, Y1 + 0.07, 0)) },
  { type: 'baton', m: branch(V(-HW - 0.07, Y0, 0.012), V(HW + 0.07, Y0, 0.012)) },
  { type: 'baton', m: branch(V(-HW - 0.07, Y1, 0.012), V(HW + 0.07, Y1, 0.012)) },
  // ligatures : aux pieds, puis aux angles du haut
  { type: 'corde', geo: lashGeo, m: new THREE.Matrix4().makeTranslation(-HW - 0.02, 0.78, 0) },
  { type: 'corde', geo: lashGeo, m: new THREE.Matrix4().makeTranslation(HW + 0.02, 0.78, 0) },
  { type: 'corde', geo: lashGeo, m: new THREE.Matrix4().makeTranslation(-HW, Y1, 0.012) },
  { type: 'corde', geo: lashGeo, m: new THREE.Matrix4().makeTranslation(HW, Y1, 0.012) },
];
// encoches sculptées sur les traverses (décor, une fois le métier terminé)
const notchGeo = mergeColored([...Array(13)].flatMap((_, k) => {
  const x = -0.3 + k * 0.05;
  return [[new THREE.BoxGeometry(0.012, 0.03, 0.05).translate(x, Y1 + 0.012, 0.012), 0x4d3a2a], [new THREE.BoxGeometry(0.012, 0.03, 0.05).translate(x, Y0 - 0.012, 0.012), 0x4d3a2a]];
}));
// fils de chaîne : chaque corde tendue fait 3 allers-retours sur le cadre
const WARP_X = [...Array(12)].map((_, k) => -0.275 + k * 0.05);
const warpGeo = new THREE.CylinderGeometry(0.0045, 0.0045, Y1 - Y0, 4).translate(0, (Y0 + Y1) / 2, 0.016);
// la toile tissée : texture de trame grossière, générée
function weaveTexture() {
  const S = 128, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#9c905f'; g.fillRect(0, 0, S, S);
  const n = 8, c = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const over = (i + j) % 2;
    g.fillStyle = over ? '#c3b78a' : '#a99d6c';
    g.fillRect(i * c + 1, j * c + 1, c - 2, c - 2);
    g.fillStyle = 'rgba(80,70,40,0.25)';
    if (over) g.fillRect(i * c + 1, j * c + c / 2 - 1, c - 2, 2); else g.fillRect(i * c + c / 2 - 1, j * c + 1, 2, c - 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function createLooms(scene, { forest, inventory, hands, controls, getAudio, hint, onChange, saved, others }) {
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0xf4e9da, transparent: true, opacity: 0.2, depthWrite: false });
  const nextMat = new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.5, depthWrite: false });
  const badMat = new THREE.MeshBasicMaterial({ color: 0xe0705a, transparent: true, opacity: 0.3, depthWrite: false });
  const warpMat = new THREE.MeshStandardMaterial({ color: 0xb8a674, roughness: 1, flatShading: true });
  const baseTex = weaveTexture();
  const audio = () => getAudio?.();
  const st = controls.state;
  const sites = [];
  const v3 = new THREE.Vector3();
  const toWorld = (site, x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, site.rot).add(v3.set(site.x, site.y, site.z));
  const meshOf = (p, mat) => {
    const real = mat === 'real';
    const m = new THREE.Mesh(p.geo || itemGeometry(p.type), real ? itemMaterial : mat);
    m.matrixAutoUpdate = false;
    m.matrix.copy(p.m);
    m.castShadow = real;
    m.receiveShadow = true;
    return m;
  };
  function rebuild(site) {
    const g = site.group;
    for (const c of [...g.children]) g.remove(c);
    PIECES.forEach((p, i) => g.add(meshOf(p, site.stage === 'built' || i < site.placed ? 'real' : i === site.placed ? nextMat : ghostMat)));
    if (site.stage === 'built') {
      g.add(new THREE.Mesh(notchGeo, itemMaterial));
      const job = site.job;
      if (job) {
        // la chaîne déjà tendue (3 fils par corde)
        for (let k = 0; k < job.warp * 3; k++) { const w = new THREE.Mesh(warpGeo, warpMat); w.position.x = WARP_X[k]; g.add(w); }
        // la toile, qui monte depuis le bas au fil du tissage
        if (!site.cloth) {
          const tex = baseTex.clone(); tex.needsUpdate = true;
          site.cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, side: THREE.DoubleSide }));
          site.cloth.position.set(0, Y0 + 0.02, 0.018);
          site.cloth.receiveShadow = true;
        }
        g.add(site.cloth);
        showCloth(site);
      }
    }
    if (!site.col && site.placed > 0) {
      const pts = [toWorld(site, -0.5, 0, 0.32), toWorld(site, 0.5, 0, 0.32), toWorld(site, -0.5, 0, -0.32), toWorld(site, 0.5, 0, -0.32)];
      site.col = { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), z0: Math.min(...pts.map((p) => p.z)), z1: Math.max(...pts.map((p) => p.z)) };
      forest.colliders.push(site.col);
    }
  }
  const W = (site) => WEAVES.find((w) => w.id === site.job?.id) || WEAVES[0];
  function showCloth(site) {
    if (!site.cloth) return;
    const k = site.job ? Math.min(1, site.job.ms / W(site).ms) : 0;
    const h = Math.max(0.001, k * (Y1 - Y0 - 0.04));
    site.cloth.visible = k > 0.002;
    site.cloth.scale.y = h;
    site.cloth.material.map.repeat.set(5, h / 0.12);
  }
  function addSite(d) {
    const site = { x: d.x, z: d.z, rot: d.rot || 0, y: forest.groundAt(d.x, d.z) + 0.03, placed: d.placed || 0, stage: d.stage || 'build', job: d.job && WEAVES.some((w) => w.id === d.job.id) ? { id: d.job.id, warp: d.job.warp || 0, weft: !!d.job.weft, ms: d.job.ms || 0 } : null };
    site.group = new THREE.Group();
    site.group.position.set(site.x, site.y, site.z);
    site.group.rotation.y = site.rot;
    scene.add(site.group);
    sites.push(site);
    rebuild(site);
    return site;
  }
  for (const d of (saved && saved.sites) || []) if (Number.isFinite(d.x) && Number.isFinite(d.z)) addSite(d);

  // ------------------------------------------------------------------ preview à placer (face au joueur)
  let preview = null;
  const ghost = new THREE.Group();
  PIECES.forEach((p) => ghost.add(meshOf(p, ghostMat)));
  ghost.visible = false;
  scene.add(ghost);
  function validSpot(x, z) {
    if (!forest.inWalk(x, z, -2) || forest.streamDist(x, z) < 2.4 || forest.blocked(x, z, 0.6)) return false;
    if ([...sites, ...(others?.() || [])].some((s) => Math.hypot(s.x - x, s.z - z) < 2.2)) return false;
    const h = forest.groundAt(x, z);
    return [[0.5, 0], [-0.5, 0], [0, 0.4], [0, -0.4]].every(([dx, dz]) => Math.abs(forest.groundAt(x + dx, z + dz) - h) < 0.2);
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
    const x = player.x - Math.sin(yaw) * 1.8, z = player.z - Math.cos(yaw) * 1.8;
    Object.assign(preview, { x, z, rot: yaw, ok: validSpot(x, z) });
    ghost.position.set(x, forest.groundAt(x, z) + 0.03, z);
    ghost.rotation.y = yaw;
    for (const m of ghost.children) m.material = preview.ok ? ghostMat : badMat;
  }

  // ------------------------------------------------------------------ toucher
  const p3 = new THREE.Vector3();
  function pickAt(camera, px, py, player, reach = 2.6) {
    let best = null, bd = Infinity;
    for (const s of sites) {
      const c = toWorld(s, 0, 0.62, 0), dist = Math.hypot(c.x - player.x, c.z - player.z);
      if (dist > 7) continue;
      p3.copy(c).project(camera);
      if (p3.z > 1) continue;
      const sx = (p3.x * 0.5 + 0.5) * innerWidth, sy = (-p3.y * 0.5 + 0.5) * innerHeight;
      const rad = Math.max(60, Math.min(240, (innerHeight * 0.55) / Math.max(0.5, dist)));
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
  let onMenu = null;
  function act(site) {
    if (hands.busy || weaving) return;
    if (site.stage === 'build') {
      const p = PIECES[site.placed];
      if (!inventory.count(p.type)) {
        const left = PIECES.slice(site.placed).filter((x) => x.type === p.type).length;
        return hint(left > 1 ? `Il te faut encore ${left} ${p.type === 'corde' ? 'cordes' : 'bâtons'}.` : `Il te faut ${anItem(p.type)}.`);
      }
      inventory.take(p.type);
      hands.place(new THREE.Vector3().setFromMatrixPosition(p.m).applyAxisAngle(THREE.Object3D.DEFAULT_UP, site.rot).add(v3.set(site.x, site.y, site.z)), p.type, () => {
        audio()?.place(p.type);
        site.placed++;
        if (site.placed >= PIECES.length) { site.stage = 'built'; hint('Le métier à tisser est prêt. Touche-le pour choisir ce que tu fabriques.'); }
        rebuild(site);
        onChange?.();
      });
      return;
    }
    const job = site.job;
    if (!job) return onMenu?.(site);
    const w = W(site);
    if (job.warp < w.warp) {
      // tendre la corde suivante : la main la noue en haut et en bas du cadre
      if (!inventory.count('corde')) return hint(`Il te faut encore ${w.warp - job.warp} corde${w.warp - job.warp > 1 ? 's' : ''} pour la chaîne.`);
      inventory.take('corde');
      const x = (WARP_X[job.warp * 3] + WARP_X[job.warp * 3 + 2]) / 2;
      hands.place(toWorld(site, x, (Y0 + Y1) / 2 + 0.12, 0.03), 'corde', () => {
        audio()?.tick('twist');
        job.warp++;
        rebuild(site);
        onChange?.();
        if (job.warp >= w.warp) hint('La chaîne est tendue. Touche le métier pour t’asseoir et tisser.', 3500);
      });
      return;
    }
    if (!job.weft) {
      if (inventory.count('corde') < w.weft) return hint(`Il te faut ${w.weft} cordes pour la trame.`);
      for (let i = 0; i < w.weft; i++) inventory.take('corde');
      job.weft = true;
      onChange?.();
    }
    sit(site);
  }
  // choisir une fabrication (depuis la fenêtre du métier)
  function choose(site, id) {
    const w = WEAVES.find((x) => x.id === id);
    if (!w || site.job) return;
    const need = w.warp + w.weft;
    if (inventory.count('corde') < need) return hint(`Il te faut ${need} cordes (tu en as ${inventory.count('corde')}).`);
    site.job = { id, warp: 0, weft: false, ms: 0 };
    rebuild(site);
    onChange?.();
    hint('Touche le métier pour tendre les cordes une par une.', 3500);
  }

  // ------------------------------------------------------------------ tisser, assis devant le métier
  let weaving = null; // { site, anim, leaving }
  const lerp = (a, b, t) => a + (b - a) * t, ease = (k) => k * k * (3 - 2 * k);
  function seat(site) {
    const p = toWorld(site, 0, 0, 0.78), c = toWorld(site, 0, 0.6, 0);
    const y = forest.groundAt(p.x, p.z) + 0.98;
    return { x: p.x, y, z: p.z, yaw: site.rot, pitch: Math.atan2(c.y - y, 0.78), roll: 0 };
  }
  function sit(site) {
    const to = seat(site);
    const from = { x: st.pos.x, y: st.pos.y, z: st.pos.z, yaw: st.yaw, pitch: st.pitch, roll: 0 };
    weaving = { site, anim: { t: 0, dur: 1.2, from, to }, stopping: false };
    st.enabled = false; st.frozen = true;
    st.lie = { ...from };
  }
  // bord gauche et droit du rang en cours (repère du monde) pour les mains
  function rowEdges() {
    const s = weaving.site, k = Math.min(1, s.job.ms / W(s).ms);
    const y = Y0 + 0.04 + k * (Y1 - Y0 - 0.06);
    return { left: toWorld(s, -0.27, y, 0.05), right: toWorld(s, 0.27, y, 0.05), mid: toWorld(s, 0, y + 0.03, 0.05) };
  }
  function stop() {
    if (!weaving || weaving.stopping) return;
    weaving.stopping = true;
  }
  function finishSitting() {
    // on se relève, un pas en arrière
    const s = weaving.site, p = toWorld(s, 0, 0, 1.25);
    const to = { x: p.x, y: forest.groundAt(p.x, p.z) + 1.6, z: p.z, yaw: s.rot, pitch: -0.25, roll: 0 };
    weaving.anim = { t: 0, dur: 1.0, from: { ...st.lie }, to, leave: true };
  }
  let t = 0;
  function update(dt, player, camera, yaw) {
    t += dt;
    if (preview) updatePreview(player, yaw);
    nextMat.opacity = 0.35 + 0.25 * Math.sin(t * 3.2);
    if (!weaving) return;
    const a = weaving.anim;
    if (a) {
      a.t += dt;
      const k = ease(Math.min(1, a.t / a.dur));
      Object.assign(st.lie, { x: lerp(a.from.x, a.to.x, k), y: lerp(a.from.y, a.to.y, k), z: lerp(a.from.z, a.to.z, k), yaw: a.from.yaw + ((((a.to.yaw - a.from.yaw) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * k, pitch: lerp(a.from.pitch, a.to.pitch, k) });
      if (a.t >= a.dur) {
        weaving.anim = null;
        if (a.leave) {
          st.lie = null; st.pos.set(a.to.x, a.to.y, a.to.z); st.groundY = undefined; st.yaw = a.to.yaw; st.pitch = a.to.pitch;
          st.frozen = false; st.enabled = true;
          const done = weaving.done;
          weaving = null;
          if (done) onDone?.(done);
          return;
        }
        // assis : les mains se mettent au travail
        hands.weave(rowEdges, () => !!weaving && !weaving.stopping && !weaving.anim, () => audio()?.tick('twist')).then(() => { if (weaving) finishSitting(); });
      }
      return;
    }
    // le tissage avance (seulement appli ouverte, pendant qu'on tisse)
    const s = weaving.site, w = W(s);
    if (!weaving.stopping) {
      s.job.ms += dt * 1000;
      showCloth(s);
      if (s.job.ms >= w.ms) {
        s.job.ms = w.ms;
        weaving.done = s;
        weaving.stopping = true;
      }
      saveTimer -= dt;
      if (saveTimer <= 0) { saveTimer = 10; onChange?.(); }
    }
  }
  let saveTimer = 10, onDone = null;
  // l'ouvrage terminé : on le décroche du cadre
  onDone = (s) => {
    const w = W(s);
    s.job = null;
    if (s.cloth) { s.group.remove(s.cloth); s.cloth.material.map.dispose(); s.cloth.material.dispose(); s.cloth = null; }
    rebuild(s);
    if (inventory.canAdd(w.out)) inventory.add(w.out);
    else hint('Inventaire plein : le tissu est resté au pied du métier.');
    audio()?.pick('tissu');
    hint(`${w.name} terminé !`, 3000);
    onChange?.();
  };
  function label(site) {
    if (site.stage === 'build') return `Poser ${anItem(PIECES[site.placed].type)} (${site.placed}/${PIECES.length})`;
    const job = site.job;
    if (!job) return 'Métier à tisser · touche pour choisir une fabrication';
    const w = W(site);
    if (job.warp < w.warp) return `Tendre une corde de chaîne (${job.warp}/${w.warp})`;
    return `Tissage : ${Math.floor(job.ms / 60e3)}/${Math.round(w.ms / 60e3)} min · touche pour tisser`;
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
  return {
    update, act, choose, stop, dismantle, label, pickAt, nearest, startPlacement, cancelPlacement, confirmPlacement,
    setMenu(fn) { onMenu = fn; },
    get placing() { return !!preview; }, get placeOk() { return !!preview && preview.ok; },
    get weaving() { return !!weaving; },
    progress: () => (weaving ? { ms: weaving.site.job ? weaving.site.job.ms : 0, total: W(weaving.site).ms } : null),
    sites,
    data: () => ({ sites: sites.map(({ x, z, rot, placed, stage, job }) => ({ x, z, rot, placed, stage, job: job && { id: job.id, warp: job.warp, weft: job.weft, ms: Math.round(job.ms) } })) }),
  };
}
