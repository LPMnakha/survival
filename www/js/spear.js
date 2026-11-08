// La lance lancée comme un javelot : elle vole, pique du nez en retombant, se
// plante dans un lapin (qui meurt), dans un arbre ou dans le sol. Une lance
// plantée se ramasse en la touchant.
import * as THREE from '../vendor/three.module.min.js';
import { itemGeometry, matFor } from './models.js';

const LEN = 1.74, G = 9.8, UP = new THREE.Vector3(0, 1, 0);

export function createSpears(scene, { forest, rabbits, getAudio, hint, onChange, saved }) {
  const planted = []; // { x, y, z (pointe), d: [dx, dy, dz] (direction de la pointe), rabbit: id | null, mesh }
  const geo = itemGeometry('lance'), mat = matFor('lance');
  const meshFor = (tip, dir) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.quaternion.setFromUnitVectors(UP, dir);
    m.position.copy(tip).addScaledVector(dir, -LEN);
    scene.add(m);
    return m;
  };
  function plant(tip, dir, rabbit = null) {
    const p = { x: tip.x, y: tip.y, z: tip.z, d: [dir.x, dir.y, dir.z], rabbit, mesh: meshFor(tip, dir) };
    planted.push(p);
    onChange?.();
    return p;
  }
  for (const s of (saved && saved.planted) || []) if (Number.isFinite(s.x) && Array.isArray(s.d)) plant(new THREE.Vector3(s.x, s.y, s.z), new THREE.Vector3(...s.d).normalize(), Number.isInteger(s.rabbit) ? s.rabbit : null);
  // un lapin qui pourrit lâche la lance : elle tombe à plat au sol
  rabbits.setRot((r) => {
    const p = planted.find((x) => x.rabbit === r.id);
    if (!p) return;
    take(p);
    const dir = new THREE.Vector3(Math.sin(r.ry), 0.02, Math.cos(r.ry)).normalize();
    const tip = new THREE.Vector3(r.x, forest.surfaceY(r.x, r.z) + 0.03, r.z).addScaledVector(dir, LEN / 2);
    plant(tip, dir);
  });

  // ------------------------------------------------------------------ en vol
  let fly = null; // { tip, vel, mesh, t }
  function launch(tip, vel) {
    const dir = vel.clone().normalize();
    fly = { tip: tip.clone(), vel: vel.clone(), mesh: meshFor(tip, dir), t: 0 };
    getAudio()?.whoosh();
  }
  const prev = new THREE.Vector3(), dir = new THREE.Vector3();
  function update(dt) {
    if (!fly) return;
    const STEPS = 4;
    for (let s = 0; s < STEPS && fly; s++) {
      const h = dt / STEPS;
      prev.copy(fly.tip);
      fly.vel.y -= G * h;
      fly.tip.addScaledVector(fly.vel, h);
      fly.t += h;
      dir.copy(fly.vel).normalize();
      // un lapin sur la trajectoire
      const r = rabbits.hitSegment(prev, fly.tip);
      if (r) {
        rabbits.kill(r);
        const gy = forest.surfaceY(r.x, r.z);
        const d = dir.clone(); d.y = Math.min(d.y, -0.45); d.normalize();
        land(new THREE.Vector3(r.x, gy + 0.02, r.z), d, r.id);
        getAudio()?.impact('lapin');
        hint?.('Touché !', 2000);
        return;
      }
      // un arbre, un rocher, un tronc
      const gy = forest.surfaceY(fly.tip.x, fly.tip.z);
      // obstacles bas (rochers, troncs couchés, buissons) : seulement si la pointe passe à moins de 0,9 m du sol
      if (fly.tip.y < gy + 4.5 && forest.blocked(fly.tip.x, fly.tip.z, 0.02, fly.tip.y > gy + 0.9)) {
        land(fly.tip.clone().addScaledVector(dir, 0.08), dir.clone());
        getAudio()?.impact('bois');
        return;
      }
      // le sol
      if (fly.tip.y <= gy) {
        const d = dir.clone(); if (d.y > -0.2) { d.y = -0.2; d.normalize(); }
        land(new THREE.Vector3(fly.tip.x, gy, fly.tip.z).addScaledVector(d, 0.18), d);
        getAudio()?.impact('sol');
        return;
      }
      // hors de la zone : elle retombe au bord
      if (!forest.inWalk(fly.tip.x, fly.tip.z, 0) || fly.t > 4) {
        const c = { x: Math.max(-398, Math.min(398, fly.tip.x)), z: Math.max(-398, Math.min(398, fly.tip.z)) };
        const d = new THREE.Vector3(dir.x, -0.5, dir.z).normalize();
        land(new THREE.Vector3(c.x, forest.surfaceY(c.x, c.z), c.z).addScaledVector(d, 0.18), d);
        return;
      }
    }
    if (fly) { fly.mesh.quaternion.setFromUnitVectors(UP, dir); fly.mesh.position.copy(fly.tip).addScaledVector(dir, -LEN); }
  }
  function land(tip, d, rabbitId = null) {
    scene.remove(fly.mesh);
    fly = null;
    plant(tip, d, rabbitId);
  }

  // ------------------------------------------------------------------ ramasser
  const p3 = new THREE.Vector3();
  const grip = (p) => new THREE.Vector3(p.x, p.y, p.z).addScaledVector(new THREE.Vector3(...p.d), -0.75);
  function pickAt(camera, px, py, player, reach = 2.4) {
    let best = null, bd = Infinity;
    for (const p of planted) {
      if (p.rabbit !== null) continue; // celle d'un lapin se récupère en touchant le lapin
      const g = grip(p), dist = Math.hypot(g.x - player.x, g.z - player.z);
      if (dist > 8) continue;
      // on vise n'importe où le long du manche
      for (let k = 0.1; k <= 1.6; k += 0.3) {
        p3.set(p.x, p.y, p.z).addScaledVector(new THREE.Vector3(...p.d), -k).project(camera);
        if (p3.z > 1) continue;
        const d = Math.hypot((p3.x * 0.5 + 0.5) * innerWidth - px, (-p3.y * 0.5 + 0.5) * innerHeight - py);
        if (d < 60 && d < bd) { bd = d; best = p; }
      }
    }
    return best ? { spear: best, near: Math.hypot(grip(best).x - player.x, grip(best).z - player.z) <= reach, at: grip(best) } : null;
  }
  const inRabbit = (id) => planted.find((p) => p.rabbit === id) || null;
  function take(p) {
    scene.remove(p.mesh);
    planted.splice(planted.indexOf(p), 1);
    onChange?.();
  }
  return {
    launch, update, pickAt, take, inRabbit, grip, get flying() { return !!fly; }, get fly() { return fly && { tip: fly.tip.toArray().map((v) => +v.toFixed(2)), parent: !!fly.mesh.parent }; }, planted,
    data: () => ({ planted: planted.map((p) => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), d: p.d.map((v) => +v.toFixed(3)), rabbit: p.rabbit })) }),
  };
}
