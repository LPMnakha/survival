// Mousse : on la ramasse à la main sur les rochers moussus et les troncs couchés
// (2 poignées par endroit), elle repousse en 3 jours. Elle sert à calfeutrer
// les fentes entre les rondins de la cabane.
import * as THREE from '../vendor/three.module.min.js';

const REGROW = 3 * 864e5, PER = 2;

export function createMoss({ forest, inventory, hands, getAudio, hint, onChange, saved }) {
  const spots = [];
  for (const r of forest.rocks) {
    if (r.sz < 0.5 || !forest.inWalk(r.x, r.z, -1)) continue;
    spots.push({ x: r.x, z: r.z, y: r.y + r.sy * 0.55, rr: Math.max(r.sx, r.sz) * 0.45 });
  }
  for (const l of forest.fallenLogs) {
    if (!forest.inWalk(l.x, l.z, -1)) continue;
    const ca = Math.cos(l.a), sa = Math.sin(l.a);
    for (let t = -l.len / 2 + 0.8; t < l.len / 2; t += 1.8) spots.push({ x: l.x + ca * t, z: l.z - sa * t, y: l.y, rr: l.r });
  }
  spots.forEach((s, i) => { s.id = i; s.picks = []; });
  if (saved && saved.picks) for (const [id, list] of Object.entries(saved.picks)) if (spots[id]) spots[id].picks = list.filter(Number.isFinite);
  const G = new Map(), gk = (x, z) => Math.floor(x / 8) * 1000 + Math.floor(z / 8);
  for (const s of spots) { const k = gk(s.x, s.z); if (!G.has(k)) G.set(k, []); G.get(k).push(s); }
  const avail = (s, now = Date.now()) => PER - s.picks.filter((t) => now - t < REGROW).length;

  const p3 = new THREE.Vector3();
  function pickAt(camera, px, py, player, reach = 1.9) {
    let best = null, bd = Infinity;
    for (let i = Math.floor((player.x - 7) / 8); i <= Math.floor((player.x + 7) / 8); i++) for (let j = Math.floor((player.z - 7) / 8); j <= Math.floor((player.z + 7) / 8); j++) {
      for (const s of G.get(i * 1000 + j) || []) {
        const dist = Math.hypot(s.x - player.x, s.z - player.z);
        if (dist > 6) continue;
        p3.set(s.x, s.y, s.z).project(camera);
        if (p3.z > 1) continue;
        const sx = (p3.x * 0.5 + 0.5) * innerWidth, sy = (-p3.y * 0.5 + 0.5) * innerHeight;
        const rad = Math.max(45, Math.min(170, (innerHeight * 0.3 * Math.max(0.4, s.rr)) / Math.max(0.5, dist)));
        const d = Math.hypot(sx - px, sy - py);
        if (d < rad && d < bd) { bd = d; best = s; }
      }
    }
    return best && { spot: best, near: Math.hypot(best.x - player.x, best.z - player.z) <= reach + best.rr };
  }
  function take(s) {
    if (hands.busy) return;
    if (avail(s) <= 0) return hint('Plus de mousse ici pour l’instant : elle repousse en 3 jours.');
    if (!inventory.canAdd('mousse')) return hint('Inventaire plein.');
    hands.pickup(new THREE.Vector3(s.x, s.y, s.z), 'mousse', () => {
      s.picks.push(Date.now());
      inventory.add('mousse');
      getAudio()?.tick('rustle');
      onChange?.();
    });
  }
  return {
    pickAt, take, spots,
    data: () => ({ picks: Object.fromEntries(spots.filter((s) => s.picks.some((t) => Date.now() - t < REGROW)).map((s) => [s.id, s.picks.filter((t) => Date.now() - t < REGROW)])) }),
  };
}
