// Torches : un bâton, une corde, un tissu. On la trempe dans la sève (résine)
// qui coule d'une cavité dans le tronc de certains épicéas, puis on l'allume à
// la pierre à feu ou à un feu de camp allumé. Elle brûle 1 h (temps réel, même
// appli fermée). Allumée, elle ne se range pas : on la garde en main ou on la
// plante dans le sol. Éteinte, il reste le bâton. La pluie ne l'éteint pas.
import * as THREE from '../vendor/three.module.min.js';
import { makeNoise } from './noise.js';
import { mergeColored } from './builder.js';
import { itemGeometry, itemMaterial } from './models.js';
import { glow } from './textures.js';

const MIN = 60e3;
export const TORCH = { burn: 60 * MIN, fade: 5 * MIN };
const soft = (t, s) => 0.5 + 0.25 * Math.sin(t * 1.7 + s) + 0.15 * Math.sin(t * 3.1 + s * 2.3) + 0.1 * Math.sin(t * 5.3 + s * 0.7);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// force de la flamme : elle faiblit les 5 dernières minutes
export const torchLevel = (end, now = Date.now()) => (end > now ? 0.35 + 0.65 * smooth(0, TORCH.fade, end - now) : 0);

// ------------------------------------------------------------------ la flamme (petite, comme celle du feu de camp)
const haloTex = glow('rgba(255,175,95,0.9)', 'rgba(255,90,20,0)');
export function makeTorchFlame() {
  const g = new THREE.Group();
  const flames = [];
  const layers = [
    { n: 3, color: 0xff6a1f, r: 0.042, h: 0.26, spread: 0.03, op: 0.55 },
    { n: 3, color: 0xffa23a, r: 0.032, h: 0.19, spread: 0.022, op: 0.65 },
    { n: 2, color: 0xffe08a, r: 0.019, h: 0.12, spread: 0.01, op: 0.8 },
  ];
  layers.forEach((Ly, li) => {
    for (let i = 0; i < Ly.n; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(Ly.r, Ly.h, 5, 1).translate(0, Ly.h / 2, 0),
        new THREE.MeshBasicMaterial({ color: Ly.color, transparent: true, opacity: Ly.op, blending: THREE.AdditiveBlending, depthWrite: false }));
      const a = (i / Ly.n) * Math.PI * 2 + li;
      m.position.set(Math.cos(a) * Ly.spread, -0.04, Math.sin(a) * Ly.spread);
      m.userData = { seed: Math.random() * 100, base: m.position.clone(), h: 0.8 + Math.random() * 0.4, speed: 1 + Math.random() * 0.7, op: Ly.op };
      g.add(m);
      flames.push(m);
    }
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 }));
  halo.scale.set(0.5, 0.55, 1);
  halo.position.set(0, 0.08, 0);
  g.add(halo);
  // quelques étincelles qui montent
  const N = 8, pp = new Float32Array(N * 3), life = new Float32Array(N);
  const reset = (i, t = Math.random()) => { pp[i * 3] = (Math.random() - 0.5) * 0.05; pp[i * 3 + 1] = 0.05 + t * 0.35; pp[i * 3 + 2] = (Math.random() - 0.5) * 0.05; life[i] = t; };
  for (let i = 0; i < N; i++) reset(i);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const sparks = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffb060, size: 0.012, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  sparks.frustumCulled = false;
  g.add(sparks);
  function update(t, dt, k) {
    for (const f of flames) {
      const u = f.userData, kk = soft(t * u.speed, u.seed);
      const w = (0.85 + kk * 0.3) * (0.6 + 0.4 * k);
      f.scale.set(w, u.h * (0.6 + kk * 0.7) * k, w);
      f.position.x = u.base.x + Math.sin(t * 1.9 + u.seed) * 0.008;
      f.rotation.y = t * 0.4 + u.seed;
      f.rotation.z = Math.sin(t * 1.1 + u.seed) * 0.1;
      f.material.opacity = u.op * Math.min(1, k * 1.5);
    }
    for (let i = 0; i < N; i++) {
      life[i] += dt * (0.5 + (i % 3) * 0.12);
      if (life[i] > 1) reset(i, 0);
      pp[i * 3 + 1] += dt * 0.3;
      pp[i * 3] += Math.sin(t * 3 + i) * dt * 0.03;
    }
    pg.attributes.position.needsUpdate = true;
    sparks.material.opacity = 0.8 * k;
    halo.material.opacity = (0.28 + soft(t * 1.6, 2.2) * 0.18) * k;
  }
  function dispose() { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  return { g, update, dispose };
}

export function createTorches(scene, { forest, inventory, hands, items, getAudio, hint, onChange, saved }) {
  const audio = () => getAudio?.();
  hands.setFlame(makeTorchFlame);

  // ------------------------------------------------------------------ épicéas à sève : une cavité dans le tronc, la résine coule
  const R = makeNoise(77).rnd;
  const sp = forest.spawn;
  const saps = [];
  const trees = forest.spruces.filter((t) => forest.inWalk(t.x, t.z, -2));
  let first = null, fd = Infinity;
  for (const t of trees) { const d = Math.hypot(t.x - sp.x, t.z - sp.z); if (d > 6 && d < fd) { fd = d; first = t; } }
  const H = 1.0; // hauteur de la cavité au-dessus du sol
  for (const t of trees) {
    const pick = R() < 1 / 30, face = R() * Math.PI * 2;
    if (!pick && t !== first) continue;
    // la première, près du départ, regarde vers le point de départ
    const a = t === first ? Math.atan2(sp.x - t.x, sp.z - t.z) : face;
    const ground = t.y + 0.15, h = (H + 0.15) / t.s;
    const r = (0.21 - (0.1 * h) / 2.6) * t.s;
    saps.push({ id: saps.length, tree: t, a, x: t.x + Math.sin(a) * r, z: t.z + Math.cos(a) * r, y: ground + H, rot: a });
  }
  const resinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.05, flatShading: true, emissive: 0x6a3200, emissiveIntensity: 0.35 });
  // repère de la cavité : à la surface du tronc, tournée vers +z
  const barkGeo = mergeColored([
    [new THREE.TorusGeometry(0.07, 0.024, 4, 9).scale(1, 1.55, 0.7).translate(0, 0, -0.004), 0x3b2819],
    [new THREE.CircleGeometry(0.07, 9).scale(1, 1.5, 1).translate(0, 0, 0.004), 0x0e0906],
    [new THREE.IcosahedronGeometry(0.03, 0).scale(1.2, 0.5, 0.5).translate(0.06, 0.13, 0.008), 0x4a3423],
  ]);
  const drips = [[new THREE.IcosahedronGeometry(0.04, 1).scale(1.35, 0.6, 0.55).translate(0, -0.075, 0.01), 0xc98a2e]];
  for (const [x, L, w] of [[-0.035, 0.24, 0.013], [0.018, 0.34, 0.011], [0.05, 0.15, 0.009]]) {
    drips.push([new THREE.CylinderGeometry(w * 0.7, w, L, 5).translate(0, -0.1 - L / 2, 0).rotateX(-0.06).translate(x, 0, 0.012), 0xb87522]);
    drips.push([new THREE.IcosahedronGeometry(w * 1.3, 0).translate(x, -0.1 - L, 0.012 + L * 0.06), 0xd9962f]);
  }
  const resinGeo = mergeColored(drips);
  const inst = saps.map((s) => ({ x: s.x, y: s.y, z: s.z, s: 1, rot: s.rot }));
  forest.chunked(barkGeo, itemMaterial, inst, { far: 60 });
  forest.chunked(resinGeo, resinMat, inst, { far: 60 });
  const GRID = new Map(), key = (x, z) => Math.floor(x / 8) * 1000 + Math.floor(z / 8);
  for (const s of saps) { const k = key(s.x, s.z); if (!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(s); }
  const nearSaps = (p, r, fn) => {
    for (let i = Math.floor((p.x - r) / 8); i <= Math.floor((p.x + r) / 8); i++) for (let j = Math.floor((p.z - r) / 8); j <= Math.floor((p.z + r) / 8); j++) for (const s of GRID.get(i * 1000 + j) || []) fn(s);
  };
  const p3 = new THREE.Vector3();
  const toScreen = (x, y, z, camera) => { p3.set(x, y, z).project(camera); return p3.z > 1 ? null : [(p3.x * 0.5 + 0.5) * innerWidth, (-p3.y * 0.5 + 0.5) * innerHeight]; };
  function pickSap(camera, px, py, player, reach = 1.9) {
    let best = null, bd = Infinity;
    nearSaps(player, 7, (s) => {
      const dist = Math.hypot(s.x - player.x, s.z - player.z);
      if (dist > 7) return;
      const sc = toScreen(s.x, s.y - 0.08, s.z, camera);
      if (!sc) return;
      const rad = Math.max(55, Math.min(200, (innerHeight * 0.22) / Math.max(0.5, dist)));
      const d = Math.hypot(sc[0] - px, sc[1] - py);
      if (d < rad && d < bd) { bd = d; best = s; }
    });
    return best && { sap: best, near: Math.hypot(best.x - player.x, best.z - player.z) <= reach };
  }
  const sapNear = (player, r) => { let f = null; nearSaps(player, r, (s) => { if (!f && Math.hypot(s.x - player.x, s.z - player.z) < r) f = s; }); return f; };

  // ------------------------------------------------------------------ torches plantées dans le sol
  const planted = [];
  const plantGeo = itemGeometry('torche-allumee');
  function addPlanted(d) {
    const g = new THREE.Group();
    const y = forest.surfaceY(d.x, d.z) - 0.12;
    g.position.set(d.x, y, d.z);
    g.rotation.set(d.lean || 0.06, d.rot || 0, 0, 'YXZ');
    const m = new THREE.Mesh(plantGeo, itemMaterial);
    m.castShadow = true;
    g.add(m);
    const flame = makeTorchFlame();
    g.add(flame.g);
    scene.add(g);
    const t = { x: d.x, z: d.z, y, end: d.end, rot: d.rot || 0, lean: d.lean || 0.06, g, flame };
    planted.push(t);
    return t;
  }
  function removePlanted(t) {
    scene.remove(t.g);
    t.flame.dispose();
    planted.splice(planted.indexOf(t), 1);
  }
  const headOf = (t, out = new THREE.Vector3()) => { t.g.updateMatrixWorld(true); return out.set(0, 0.56, 0).applyMatrix4(t.g.matrixWorld); };
  // éteinte, la torche plantée tombe : il reste un bâton au sol
  function burnOut(t) {
    items.drop('baton', t.x, t.z, t.rot + 0.4);
    removePlanted(t);
    onChange?.();
  }
  for (const d of (saved && saved.planted) || []) if (Number.isFinite(d.x) && Number.isFinite(d.z) && Number.isFinite(d.end)) {
    if (d.end > Date.now()) addPlanted(d); else items.drop('baton', d.x, d.z, (d.rot || 0) + 0.4);
  }
  function pickPlanted(camera, px, py, player, reach = 1.9) {
    let best = null, bd = Infinity;
    for (const t of planted) {
      const dist = Math.hypot(t.x - player.x, t.z - player.z);
      if (dist > 7) continue;
      const sc = toScreen(t.x, t.y + 0.4, t.z, camera);
      if (!sc) continue;
      const rad = Math.max(55, Math.min(200, (innerHeight * 0.3) / Math.max(0.5, dist)));
      const d = Math.hypot(sc[0] - px, sc[1] - py);
      if (d < rad && d < bd) { bd = d; best = t; }
    }
    return best && { torch: best, near: Math.hypot(best.x - player.x, best.z - player.z) <= reach };
  }

  // ------------------------------------------------------------------ étincelles de la pierre à feu (allumage à la main)
  const SN = 40, spos = new Float32Array(SN * 3), svel = new Float32Array(SN * 3), slife = new Float32Array(SN);
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const sparks = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xffd08a, size: 0.018, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  sparks.frustumCulled = false;
  scene.add(sparks);
  let sNext = 0;
  function emitSparks(at, toward, n = 16) {
    const dir = toward.clone().sub(at).normalize();
    for (let k = 0; k < n; k++) {
      const i = sNext++ % SN;
      spos.set([at.x, at.y, at.z], i * 3);
      svel.set([dir.x * 0.9 + (Math.random() - 0.5) * 0.5, dir.y * 0.9 + Math.random() * 0.2, dir.z * 0.9 + (Math.random() - 0.5) * 0.5], i * 3);
      slife[i] = 0.2 + Math.random() * 0.25;
    }
  }

  // ------------------------------------------------------------------ actions
  const held = () => inventory.heldType();
  const lit = (end) => {
    audio()?.ignite();
    onChange?.();
    hint('La torche brûle 1 h. Elle ne se range pas : garde-la en main ou plante-la dans le sol.', 5000);
    return end;
  };
  // tremper la torche dans la cavité
  function dip(s) {
    if (hands.busy || held() !== 'torche') return;
    if (!inventory.canReplaceHeld('torche-enduite')) return hint('Inventaire plein : fais de la place pour la torche enduite.');
    hands.torchTo(new THREE.Vector3(s.x, s.y - 0.06, s.z), 'torche', {
      tilt: 1.95, dur: 2.6, back: 0.42, ticks: [0.15, 0.55],
      onEnd: () => { inventory.replaceHeld('torche-enduite'); hands._arms.setItem(hands._arms.R, 'torche-enduite'); hint('La torche est enduite de sève : allume-la à la pierre à feu ou à un feu de camp.', 4500); onChange?.(); },
    });
  }
  // l'allumer aux flammes d'un feu de camp
  function lightFromFire(site) {
    if (hands.busy || held() !== 'torche-enduite') return;
    if (!inventory.canReplaceHeld('torche-allumee')) return hint('Libère une case d’accès rapide pour tenir la torche allumée.');
    hands.torchTo(new THREE.Vector3(site.x, site.y + 0.2, site.z), 'torche-enduite', {
      tilt: 2.15, dur: 1.6, back: 0.4,
      onMid: () => {
        const end = Date.now() + TORCH.burn;
        inventory.replaceHeld('torche-allumee', { end });
        hands._arms.setItem(hands._arms.R, 'torche-allumee');
        lit(end);
      },
    });
  }
  // l'allumer à la pierre à feu (1 à 3 coups)
  function lightWithSteel() {
    if (hands.busy || held() !== 'torche-enduite') return;
    if (!inventory.count('pierre-a-feu')) return hint('Il te faut la pierre à feu.');
    if (!inventory.canReplaceHeld('torche-allumee')) return hint('Libère une case d’accès rapide pour tenir la torche allumée.');
    const attempts = 1 + Math.floor(Math.random() * 3);
    hands.lightTorch(attempts, (i, tip, head, last) => {
      emitSparks(tip, head);
      audio()?.strike();
      if (last) lit(inventory.replaceHeld('torche-allumee', { end: Date.now() + TORCH.burn }));
    });
  }
  // planter la torche allumée devant soi
  function plant(player, yaw) {
    if (hands.busy || held() !== 'torche-allumee') return;
    // un peu devant soi, sur un sol libre
    let spot = null;
    for (const [dist, da] of [[1.0, 0], [1.0, 0.35], [1.0, -0.35], [0.85, 0.7], [0.85, -0.7], [0.7, 0]]) {
      const a = yaw + da, x = player.x - Math.sin(a) * dist, z = player.z - Math.cos(a) * dist;
      if (forest.streamDist(x, z) > 1.65 && !forest.blocked(x, z, 0.15) && forest.inWalk(x, z, -0.5)) { spot = { x, z }; break; }
    }
    if (!spot) return hint('Pas de place ici pour planter la torche.');
    const slot = inventory.held, end = inventory.slots[slot].end;
    const target = new THREE.Vector3(spot.x, forest.surfaceY(spot.x, spot.z) + 0.15, spot.z);
    hands.plantTorch(target, () => {
      inventory.takeAt(slot);
      addPlanted({ x: spot.x, z: spot.z, end, rot: Math.random() * 6.28, lean: 0.03 + Math.random() * 0.07 });
      onChange?.();
    });
  }
  // reprendre une torche plantée : elle revient directement en main
  function takePlanted(t) {
    if (hands.busy) return;
    if (held() === 'torche-allumee') return hint('Tu tiens déjà une torche allumée.');
    if (!inventory.canHoldNew()) return hint('Libère une case d’accès rapide pour reprendre la torche.');
    hands.pickup(new THREE.Vector3(t.x, t.y + 0.27, t.z), 'torche-allumee', () => {
      const end = t.end;
      removePlanted(t);
      inventory.addHeld('torche-allumee', { end });
      audio()?.pick('baton');
      onChange?.();
    }, true);
  }

  // ------------------------------------------------------------------ chaque image
  // lumières : une pour la torche en main, une pour la torche plantée la plus proche
  const heldLight = new THREE.PointLight(0xff9a50, 0, 10, 1.4);
  const plantLight = new THREE.PointLight(0xff9a50, 0, 9, 1.4);
  scene.add(heldLight, plantLight);
  let t = 0, check = 0;
  const out = { level: 0, hand: 0, dir: new THREE.Vector3() }, tmp = new THREE.Vector3();
  function update(dt, player, camera, day = 0) {
    // en plein jour, la lueur d'une torche se remarque à peine
    const glowK = 0.3 + 0.7 * (1 - day);
    t += dt;
    const now = Date.now();
    // torches éteintes : en main il reste le bâton, plantées elles tombent au sol
    check -= dt;
    if (check <= 0) {
      check = 1;
      const slots = inventory.slots;
      let gone = false;
      slots.forEach((s, i) => { if (s && s.type === 'torche-allumee' && s.end <= now) { slots[i] = { type: 'baton', n: 1 }; gone = true; } });
      if (gone) { inventory.changed(); hint('La torche s’est éteinte : il ne reste que le bâton.', 4000); }
      for (const p of planted.slice()) if (p.end <= now) burnOut(p);
    }
    out.level = 0; out.hand = 0;
    // en main : la lumière suit le bout de la torche
    const hs = inventory.heldSlot();
    const kHeld = hs && hs.type === 'torche-allumee' ? torchLevel(hs.end, now) : 0;
    hands.setFlameLevel(Math.max(0.35, kHeld));
    const head = hands.torchHead();
    if (kHeld > 0 && head) {
      heldLight.position.copy(head);
      heldLight.intensity = 3.4 * glowK * kHeld * (0.85 + soft(t * 1.6, 1.3) * 0.25);
      out.level = 0.4 * kHeld;
      out.hand = 0.75 * kHeld;
      camera.updateMatrixWorld();
      out.dir.copy(head).sub(camera.position).normalize();
    } else heldLight.intensity = 0;
    // plantées
    let best = null, bd = 40;
    for (const p of planted) {
      const d = Math.hypot(p.x - player.x, p.z - player.z);
      const k = torchLevel(p.end, now);
      if (d < 70) p.flame.update(t, dt, k);
      if (d < bd) { bd = d; best = p; }
      out.level = Math.max(out.level, (0.4 * k) / (1 + d * d * 0.09));
      const h = (0.75 * k) / (1 + d * d * 0.15);
      if (h > out.hand) { out.hand = h; out.dir.set(p.x - player.x, 0.4, p.z - player.z).normalize(); }
    }
    if (best) {
      plantLight.position.copy(headOf(best, tmp)).y += 0.15;
      plantLight.intensity = 3.2 * glowK * torchLevel(best.end, now) * (0.85 + soft(t * 1.5, 4.2) * 0.25);
    } else plantLight.intensity = 0;
    // étincelles
    for (let i = 0; i < SN; i++) {
      if (slife[i] <= 0) { spos[i * 3 + 1] = -9999; continue; }
      slife[i] -= dt;
      svel[i * 3 + 1] -= 4 * dt;
      for (let k = 0; k < 3; k++) spos[i * 3 + k] += svel[i * 3 + k] * dt;
    }
    sgeo.attributes.position.needsUpdate = true;
    return out;
  }
  // ce que dit l'indice selon la torche tenue
  function label(player) {
    const hs = inventory.heldSlot();
    if (!hs) return '';
    if (hs.type === 'torche-allumee') return `Torche allumée : encore ${Math.max(1, Math.ceil((hs.end - Date.now()) / MIN))} min`;
    if (hs.type === 'torche') return sapNear(player, 4) ? 'Touche la cavité du tronc pour tremper la torche dans la sève.' : '';
    return '';
  }

  return {
    update, label, pickSap, pickPlanted, dip, lightFromFire, lightWithSteel, plant, takePlanted, saps, planted, sapNear,
    data: () => ({ planted: planted.map((p) => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), end: p.end, rot: +p.rot.toFixed(2), lean: +p.lean.toFixed(3) })) }),
  };
}
