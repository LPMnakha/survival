// Établi : un plateau de 3 planches à hauteur de hanches, une étagère de 2
// planches, quatre pieds faits chacun de 2 bâtons liés (8 bâtons, 4 cordes).
// Monté pièce par pièce, dehors ou dans la cabane. On y fabrique, debout, le
// sac à dos en fibre (2 tissus, 4 cordes, 2 bâtons) : 20 minutes de travail
// actif ; on peut s'arrêter et reprendre.
import * as THREE from '../vendor/three.module.min.js';
import { itemGeometry, itemMaterial, anItem, itemName } from './models.js';
import { mergeColored } from './builder.js';
import { plankGeometry, PLANK } from './logs.js';

export const RECIPE7 = { name: 'Établi', needs: { planche: 5, baton: 8, corde: 4 } };
export const WORKS = [{ id: 'sac', name: 'Sac à dos en fibre', needs: { tissu: 2, corde: 4, baton: 2 }, ms: 20 * 60e3, out: 'sac-a-dos', note: 'Deux tissus cousus à la corde sur une armature de bâtons · 20 min de travail · 15 cases d’inventaire en tout' }];

const TOP = 0.86, L = 1.6, D = 0.45; // hauteur du plateau, longueur, profondeur
const LEG = { x: 0.68, z: 0.15 };
const X = new THREE.Vector3(1, 0, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = THREE.Object3D.DEFAULT_UP;
const stickM = (a, b, thick = 1.5) => {
  const d = b.clone().sub(a), len = d.length();
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(X, d.normalize()), V(len / 0.72, thick, thick));
};
const lashGeo = mergeColored([
  [new THREE.TorusGeometry(0.035, 0.01, 4, 10).rotateX(Math.PI / 2), 0xa48d62],
  [new THREE.TorusGeometry(0.035, 0.01, 4, 10).rotateX(Math.PI / 2).translate(0, -0.03, 0), 0xb59e70],
]);
const mergeM = (list) => {
  // [géométrie, matrice] -> une géométrie (les couleurs des sommets sont gardées)
  const pos = [], nor = [], col = [];
  for (const [g0, m] of list) {
    const g = (g0.index ? g0.toNonIndexed() : g0.clone()).applyMatrix4(m);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); col.push(...g.attributes.color.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
};
// les pièces, dans l'ordre de montage
const PIECES = [];
for (const [sx, sz] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
  const x = sx * LEG.x, z = sz * LEG.z;
  PIECES.push({ kind: 'pied', cost: { baton: 2, corde: 1 }, hand: 'baton', at: V(x, TOP / 2, z), geo: mergeM([
    [itemGeometry('baton'), stickM(V(x - 0.018, 0, z), V(x - 0.014, TOP - 0.02, z + 0.004))],
    [itemGeometry('baton'), stickM(V(x + 0.018, 0, z), V(x + 0.014, TOP - 0.02, z - 0.004))],
    [lashGeo, new THREE.Matrix4().makeTranslation(x, TOP - 0.06, z)],
  ]) });
}
const plankAt = (y, z, len) => new THREE.Matrix4().compose(V(0, y, z), new THREE.Quaternion(), V(len / PLANK.len, 1, 1));
for (const z of [-0.08, 0.08]) PIECES.push({ kind: 'étagère', plank: true, at: V(0, 0.26, z), m: plankAt(0.26, z, LEG.x * 2 + 0.06) });
for (const z of [-0.152, 0, 0.152]) PIECES.push({ kind: 'plateau', plank: true, at: V(0, TOP, z), m: plankAt(TOP, z, L) });
for (const p of PIECES) if (p.plank) p.geo = mergeM([[plankGeometry(PLANK.len, PIECES.indexOf(p) % 3), p.m]]);

export function createWorkbenches(scene, { forest, inventory, hands, controls, logs, getAudio, hint, onChange, saved, others }) {
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0xf4e9da, transparent: true, opacity: 0.2, depthWrite: false });
  const nextMat = new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.5, depthWrite: false });
  const badMat = new THREE.MeshBasicMaterial({ color: 0xe0705a, transparent: true, opacity: 0.3, depthWrite: false });
  const audio = () => getAudio?.();
  const st = controls.state;
  const sites = [];
  const v3 = new THREE.Vector3();
  const toWorld = (site, p) => p.clone().applyAxisAngle(UP, site.rot).add(v3.set(site.x, site.y, site.z));
  const W = (site) => WORKS.find((w) => w.id === site.job?.id) || WORKS[0];
  // l'ouvrage posé sur le plateau : des morceaux de toile, puis le sac qui prend forme
  const bagGeo = itemGeometry('sac-a-dos');
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xa99d6c, roughness: 1, flatShading: true, side: THREE.DoubleSide });
  function rebuild(site) {
    const g = site.group;
    for (const c of [...g.children]) g.remove(c);
    PIECES.forEach((p, i) => {
      const real = site.stage === 'built' || i < site.placed;
      const m = new THREE.Mesh(p.geo, real ? itemMaterial : i === site.placed ? nextMat : ghostMat);
      m.castShadow = real;
      m.receiveShadow = true;
      g.add(m);
    });
    if (site.stage === 'built' && site.job) {
      const k = Math.min(1, site.job.ms / W(site).ms);
      // deux pans de toile à plat, qui se replient en sac au fil du travail
      if (k < 0.5) for (const sx of [-1, 1]) {
        const c = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.42).rotateX(-Math.PI / 2), clothMat);
        c.position.set(sx * 0.2, TOP + 0.02 + (sx > 0 ? 0.002 : 0), 0);
        c.rotation.y = sx * 0.08;
        g.add(c);
      }
      const bag = new THREE.Mesh(bagGeo, itemMaterial);
      bag.position.set(0, TOP + 0.02, 0);
      bag.rotation.set(-Math.PI / 2, 0, 0.3);
      bag.scale.set(1, Math.max(0.05, k), 1);
      bag.visible = k > 0.15;
      bag.castShadow = true;
      g.add(bag);
      site.bag = bag;
      // les bâtons de l'armature et les cordes, posés à côté
      if (k < 0.7) {
        const sticks = new THREE.Mesh(itemGeometry('baton'), itemMaterial);
        sticks.position.set(0.52, TOP + 0.03, 0.08); sticks.rotation.y = 0.2;
        g.add(sticks);
        const rope = new THREE.Mesh(itemGeometry('corde'), itemMaterial);
        rope.position.set(-0.55, TOP + 0.03, 0.1);
        g.add(rope);
      }
    }
    if (!site.col && site.placed > 0) {
      const pts = [toWorld(site, V(-L / 2, 0, D / 2)), toWorld(site, V(L / 2, 0, D / 2)), toWorld(site, V(-L / 2, 0, -D / 2)), toWorld(site, V(L / 2, 0, -D / 2))];
      site.col = { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), z0: Math.min(...pts.map((p) => p.z)), z1: Math.max(...pts.map((p) => p.z)) };
      forest.colliders.push(site.col);
    }
  }
  function addSite(d) {
    const site = { x: d.x, z: d.z, rot: d.rot || 0, y: forest.groundAt(d.x, d.z) + 0.02, placed: d.placed || 0, stage: d.stage || 'build', job: d.job && WORKS.some((w) => w.id === d.job.id) ? { id: d.job.id, ms: d.job.ms || 0 } : null };
    site.group = new THREE.Group();
    site.group.position.set(site.x, site.y, site.z);
    site.group.rotation.y = site.rot;
    scene.add(site.group);
    sites.push(site);
    rebuild(site);
    return site;
  }
  for (const d of (saved && saved.sites) || []) if (Number.isFinite(d.x) && Number.isFinite(d.z)) addSite(d);

  // ------------------------------------------------------------------ placer : face à soi, par quarts de tour (pour s'aligner sur les murs de la cabane)
  let preview = null;
  const ghost = new THREE.Group();
  for (const p of PIECES) ghost.add(new THREE.Mesh(p.geo, ghostMat));
  ghost.visible = false;
  scene.add(ghost);
  const quarter = (yaw) => (((Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2)) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  function validSpot(x, z, rot) {
    if (!forest.inWalk(x, z, -2) || forest.streamDist(x, z) < 2.2) return false;
    // le plateau et la place devant pour travailler doivent être libres (les murs de la cabane comptent)
    for (const [a, b] of [[-L / 2, -D / 2], [L / 2, -D / 2], [-L / 2, D / 2], [L / 2, D / 2], [0, 0], [0, 0.7]]) {
      const p = V(a, 0, b).applyAxisAngle(UP, rot);
      if (forest.blocked(x + p.x, z + p.z, 0.1)) return false;
    }
    if ([...sites, ...(others?.() || [])].some((s) => Math.hypot(s.x - x, s.z - z) < 2)) return false;
    const h = forest.groundAt(x, z);
    return [[0.8, 0], [-0.8, 0], [0, 0.3], [0, -0.3]].every(([dx, dz]) => Math.abs(forest.groundAt(x + dx, z + dz) - h) < 0.25);
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
    const x = player.x - Math.sin(yaw) * 1.5, z = player.z - Math.cos(yaw) * 1.5, rot = quarter(yaw);
    Object.assign(preview, { x, z, rot, ok: validSpot(x, z, rot) });
    ghost.position.set(x, forest.groundAt(x, z) + 0.02, z);
    ghost.rotation.y = rot;
    for (const m of ghost.children) m.material = preview.ok ? ghostMat : badMat;
  }

  // ------------------------------------------------------------------ toucher
  const p3 = new THREE.Vector3();
  function pickAt(camera, px, py, player, reach = 2.4) {
    let best = null, bd = Infinity;
    for (const s of sites) {
      const c = toWorld(s, V(0, TOP * 0.7, 0)), dist = Math.hypot(c.x - player.x, c.z - player.z);
      if (dist > 7) continue;
      for (const lx of [-0.6, 0, 0.6]) {
        p3.copy(toWorld(s, V(lx, TOP * 0.7, 0))).project(camera);
        if (p3.z > 1) continue;
        const sx = (p3.x * 0.5 + 0.5) * innerWidth, sy = (-p3.y * 0.5 + 0.5) * innerHeight;
        const rad = Math.max(60, Math.min(220, (innerHeight * 0.4) / Math.max(0.5, dist)));
        const d = Math.hypot(sx - px, sy - py);
        if (d < rad && d < bd) { bd = d; best = s; }
      }
    }
    return best ? { site: best, near: Math.hypot(best.x - player.x, best.z - player.z) <= reach } : null;
  }
  const nearest = (player, r) => { let best = null, bd = r; for (const s of sites) { const d = Math.hypot(s.x - player.x, s.z - player.z); if (d < bd) { bd = d; best = s; } } return best; };
  let onMenu = null;
  const placedPiece = (site) => {
    site.placed++;
    if (site.placed >= PIECES.length) { site.stage = 'built'; hint('L’établi est prêt. Touche-le pour choisir ce que tu fabriques.', 4000); }
    rebuild(site);
    onChange?.();
  };
  function act(site) {
    if (hands.busy || working) return;
    if (site.stage === 'build') {
      const p = PIECES[site.placed];
      if (p.plank) {
        if (logs.carriedKind !== 'planche') {
          const left = PIECES.slice(site.placed).filter((x) => x.plank).length;
          return hint(logs.carrying ? 'Ce sont des planches qu’il faut ici.' : `Apporte des planches sur l’épaule (encore ${left}).`);
        }
        const m = new THREE.Matrix4().compose(toWorld(site, p.at), new THREE.Quaternion().setFromAxisAngle(UP, site.rot), V(1, 1, 1));
        logs.deliver(m, () => { audio()?.place('baton'); placedPiece(site); }, { crouch: p.at.y < 0.5 ? 0.6 : 0.2, approach: 1.1 });
        return;
      }
      if (logs.carrying) return hint('Pose d’abord ce que tu portes : cette étape se fait avec l’inventaire.');
      const miss = Object.entries(p.cost).filter(([t, n]) => inventory.count(t) < n);
      if (miss.length) return hint(`Il te faut ${miss.map(([t, n]) => `${n} ${itemName(t, n)}`).join(' et ')} pour ce pied.`);
      for (const [t, n] of Object.entries(p.cost)) for (let k = 0; k < n; k++) inventory.take(t);
      hands.place(toWorld(site, p.at), p.hand, () => { audio()?.place('baton'); placedPiece(site); });
      return;
    }
    if (logs.carrying) return hint('Pose d’abord ce que tu portes pour travailler à l’établi.');
    if (!site.job) return onMenu?.(site);
    work(site);
  }
  // choisir une fabrication : on prend le matériel et on se met au travail
  function choose(site, id) {
    const w = WORKS.find((x) => x.id === id);
    if (!w || site.job || working) return;
    const miss = Object.entries(w.needs).filter(([t, n]) => inventory.count(t) < n);
    if (miss.length) return hint(`Il te faut ${miss.map(([t, n]) => `${n} ${itemName(t, n)}`).join(' et ')}.`);
    for (const [t, n] of Object.entries(w.needs)) for (let k = 0; k < n; k++) inventory.take(t);
    site.job = { id, ms: 0 };
    rebuild(site);
    onChange?.();
    work(site);
  }

  // ------------------------------------------------------------------ travailler, debout devant l'établi
  let working = null;
  const lerp = (a, b, t) => a + (b - a) * t, ease = (k) => k * k * (3 - 2 * k);
  function stand(site) {
    const p = toWorld(site, V(0, 0, 0.62)), c = toWorld(site, V(0, TOP, 0));
    const y = forest.groundAt(p.x, p.z) + 1.55;
    return { x: p.x, y, z: p.z, yaw: site.rot, pitch: Math.atan2(c.y - y, 0.62), roll: 0 };
  }
  function work(site) {
    const from = { x: st.pos.x, y: st.pos.y, z: st.pos.z, yaw: st.yaw, pitch: st.pitch, roll: 0 };
    working = { site, anim: { t: 0, dur: 0.9, from, to: stand(site) }, stopping: false };
    st.enabled = false; st.frozen = true;
    st.lie = { ...from };
  }
  // l'endroit où les mains cousent (sur le sac posé sur le plateau)
  function edges() {
    const s = working.site;
    return { left: toWorld(s, V(-0.17, TOP + 0.08, 0.05)), right: toWorld(s, V(0.17, TOP + 0.08, 0.05)), mid: toWorld(s, V(0, TOP + 0.1, 0.05)) };
  }
  function stop() { if (working && !working.stopping) working.stopping = true; }
  function leave() {
    const s = working.site, p = toWorld(s, V(0, 0, 1.15));
    working.anim = { t: 0, dur: 0.8, from: { ...st.lie }, to: { x: p.x, y: forest.groundAt(p.x, p.z) + 1.6, z: p.z, yaw: s.rot, pitch: -0.2, roll: 0 }, leave: true };
  }
  let t = 0, saveTimer = 10, rebuildTimer = 0;
  function update(dt, player, camera, yaw) {
    t += dt;
    if (preview) updatePreview(player, yaw);
    nextMat.opacity = 0.35 + 0.25 * Math.sin(t * 3.2);
    if (!working) return;
    const a = working.anim;
    if (a) {
      a.t += dt;
      const k = ease(Math.min(1, a.t / a.dur));
      Object.assign(st.lie, { x: lerp(a.from.x, a.to.x, k), y: lerp(a.from.y, a.to.y, k), z: lerp(a.from.z, a.to.z, k), yaw: a.from.yaw + ((((a.to.yaw - a.from.yaw) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * k, pitch: lerp(a.from.pitch, a.to.pitch, k) });
      if (a.t >= a.dur) {
        working.anim = null;
        if (a.leave) {
          st.lie = null; st.pos.set(a.to.x, a.to.y, a.to.z); st.groundY = undefined; st.yaw = a.to.yaw; st.pitch = a.to.pitch;
          st.frozen = false; st.enabled = true;
          const done = working.done;
          working = null;
          if (done) finish(done);
          return;
        }
        // les mains cousent : la droite passe la corde, la gauche tient et serre
        hands.weave(edges, () => !!working && !working.stopping && !working.anim, () => audio()?.tick('twist')).then(() => { if (working) leave(); });
      }
      return;
    }
    const s = working.site, w = W(s);
    if (!working.stopping) {
      s.job.ms += dt * 1000;
      rebuildTimer -= dt;
      if (rebuildTimer <= 0) { rebuildTimer = 1; rebuild(s); }
      if (s.job.ms >= w.ms) { s.job.ms = w.ms; working.done = s; working.stopping = true; }
      saveTimer -= dt;
      if (saveTimer <= 0) { saveTimer = 10; onChange?.(); }
    }
  }
  function finish(s) {
    const w = W(s);
    s.job = null;
    rebuild(s);
    if (inventory.canAdd(w.out)) inventory.add(w.out);
    else { hint('Inventaire plein : fais de la place, le sac reste sur l’établi.'); s.job = { id: w.id, ms: w.ms }; rebuild(s); return; }
    audio()?.pick('tissu');
    hint(`${w.name} terminé ! Équipe-le dans la case sac (icône t-shirt) : 15 cases en tout.`, 5000);
    onChange?.();
  }
  function label(site) {
    if (site.stage === 'build') {
      const p = PIECES[site.placed];
      return p.plank ? `Établi · ${p.kind} : poser une planche (${site.placed}/${PIECES.length})` : `Établi · pied : 2 bâtons + 1 corde (${site.placed}/${PIECES.length})`;
    }
    if (!site.job) return 'Établi · touche pour choisir une fabrication';
    const w = W(site);
    if (site.job.ms >= w.ms) return `${w.name} terminé · touche pour le prendre`;
    return `${w.name} : ${Math.floor(site.job.ms / 60e3)}/${Math.round(w.ms / 60e3)} min · touche pour continuer`;
  }
  function dismantle(site) {
    if (site.stage !== 'build' || hands.busy) return;
    if (PIECES.slice(0, site.placed).some((p) => p.plank)) return hint('Les planches sont posées : l’établi ne se démonte plus.');
    while (site.placed > 0) {
      const p = PIECES[site.placed - 1];
      if (!Object.entries(p.cost).every(([t, n]) => inventory.canAdd(t))) break;
      for (const [t, n] of Object.entries(p.cost)) for (let k = 0; k < n; k++) inventory.add(t);
      site.placed--;
    }
    if (site.placed > 0) { hint('Inventaire plein : le reste est resté en place.'); rebuild(site); onChange?.(); return; }
    scene.remove(site.group);
    if (site.col) forest.colliders.splice(forest.colliders.indexOf(site.col), 1);
    sites.splice(sites.indexOf(site), 1);
    onChange?.();
  }
  // un ouvrage fini resté sur l'établi (inventaire plein) : on le reprend en touchant
  const actOuter = act;
  function actFull(site) {
    if (site.stage === 'built' && site.job && site.job.ms >= W(site).ms && !working) return finish(site);
    return actOuter(site);
  }
  return {
    update, act: actFull, choose, stop, dismantle, label, pickAt, nearest, startPlacement, cancelPlacement, confirmPlacement,
    setMenu(fn) { onMenu = fn; },
    get placing() { return !!preview; }, get placeOk() { return !!preview && preview.ok; },
    get working() { return !!working; },
    progress: () => (working && working.site.job ? { ms: working.site.job.ms, total: W(working.site).ms, name: W(working.site).name } : null),
    sites,
    data: () => ({ sites: sites.map(({ x, z, rot, placed, stage, job }) => ({ x, z, rot, placed, stage, job: job && { id: job.id, ms: Math.round(job.ms) } })) }),
  };
}
