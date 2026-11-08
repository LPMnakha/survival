// La carte du mirador : une vieille carte papier dessinée d'après la forêt
// (relief, ruisseau et gués, clairières, lieux). Pas de point « vous êtes ici ».
// On y écrit au doigt au crayon ; la gomme efface. Les notes sont sauvegardées.
import { HALF, SITES, streamX, clearingAt, height } from './forest.js';

const INK = '#4a3a2a', PAPER = '#e9dcbc';

export function createMap({ saved, onChange, onOpen }) {
  const $ = (id) => document.getElementById(id);
  const box = $('map'), cv = $('map-canvas'), pen = $('map-pen'), eraser = $('map-eraser');
  const g = cv.getContext('2d');
  let strokes = Array.isArray(saved && saved.strokes) ? saved.strokes.filter((s) => Array.isArray(s) && s.length >= 2) : [];
  let base = null, tool = 'pen', size = 0;
  const W = 2 * HALF;
  const toMap = (x, z) => [(x + HALF) / W, (z + HALF) / W]; // nord (-z) en haut

  // ------------------------------------------------------------------ le fond de carte (dessiné une fois)
  function drawBase(S) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const b = c.getContext('2d');
    // papier, un peu jauni sur les bords
    b.fillStyle = PAPER; b.fillRect(0, 0, S, S);
    const vg = b.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75);
    vg.addColorStop(0, 'rgba(255,250,235,0.25)'); vg.addColorStop(1, 'rgba(150,110,60,0.35)');
    b.fillStyle = vg; b.fillRect(0, 0, S, S);
    // relief estompé (ombrage d'après la pente)
    const N = 120, cell = S / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -HALF + (i + 0.5) * W / N, z = -HALF + (j + 0.5) * W / N;
      const d = 3, dx = height(x + d, z) - height(x - d, z), dz = height(x, z + d) - height(x, z - d);
      const shade = Math.max(-1, Math.min(1, (dx * 0.7 + dz * 0.7) * 0.9));
      b.fillStyle = shade > 0 ? `rgba(110,80,40,${shade * 0.16})` : `rgba(255,248,225,${-shade * 0.18})`;
      b.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5);
    }
    // forêt : petits sapins à l'encre, sauf dans les clairières
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    b.strokeStyle = 'rgba(74,58,42,0.55)'; b.lineWidth = Math.max(0.7, S / 900);
    const T = S / 140;
    for (let k = 0; k < 2600; k++) {
      const u = rnd(), v = rnd();
      const x = -HALF + u * W, z = -HALF + v * W;
      if (clearingAt(x, z) > 0.2 || Math.abs(x - streamX(z)) < 6) continue;
      const px = u * S, py = v * S;
      b.beginPath(); b.moveTo(px - T * 0.45, py + T * 0.5); b.lineTo(px, py - T * 0.6); b.lineTo(px + T * 0.45, py + T * 0.5); b.stroke();
    }
    // clairières : pointillés
    b.fillStyle = 'rgba(74,58,42,0.35)';
    for (let k = 0; k < 9000; k++) {
      const u = rnd(), v = rnd(), x = -HALF + u * W, z = -HALF + v * W;
      if (clearingAt(x, z) > 0.5) b.fillRect(u * S, v * S, 1, 1);
    }
    // ruisseau, à l'encre bleue
    b.strokeStyle = '#3d6b86'; b.lineWidth = Math.max(1.6, S / 260); b.lineCap = 'round';
    b.beginPath();
    for (let z = -HALF; z <= HALF; z += 4) { const [u, v] = toMap(streamX(z), z); z === -HALF ? b.moveTo(u * S, v * S) : b.lineTo(u * S, v * S); }
    b.stroke();
    // gués
    b.strokeStyle = INK; b.lineWidth = Math.max(1, S / 500);
    for (const zc of [-390, -330, -270, -210, -170, -110, -50, 7, 48, 110, 170, 230, 290, 350, 390]) {
      const [u, v] = toMap(streamX(zc), zc);
      for (const o of [-1, 0, 1]) { b.beginPath(); b.moveTo(u * S - T * 0.5, v * S + o * T * 0.28); b.lineTo(u * S + T * 0.5, v * S + o * T * 0.28); b.stroke(); }
    }
    // lieux
    b.font = `italic ${Math.round(S / 34)}px Georgia, 'Times New Roman', serif`;
    b.fillStyle = INK; b.strokeStyle = INK; b.lineWidth = Math.max(1, S / 420);
    const label = (txt, px, py) => { b.fillText(txt, px + T * 0.9, py + T * 0.35); };
    for (const s of SITES) {
      const [u, v] = toMap(s.x, s.z), px = u * S, py = v * S, k = T * 0.8;
      b.beginPath();
      if (s.id === 'cabane') { b.rect(px - k * 0.7, py - k * 0.2, k * 1.4, k * 0.9); b.moveTo(px - k * 0.9, py - k * 0.15); b.lineTo(px, py - k); b.lineTo(px + k * 0.9, py - k * 0.15); label('vieille cabane', px, py); }
      else if (s.id === 'mirador') { b.moveTo(px - k * 0.5, py + k * 0.8); b.lineTo(px - k * 0.3, py - k * 0.4); b.moveTo(px + k * 0.5, py + k * 0.8); b.lineTo(px + k * 0.3, py - k * 0.4); b.rect(px - k * 0.5, py - k * 0.9, k, k * 0.5); label('mirador', px, py); }
      else { b.moveTo(px - k, py + k * 0.6); b.lineTo(px, py - k * 0.6); b.lineTo(px + k, py + k * 0.6); b.closePath(); label('campement', px, py); }
      b.stroke();
    }
    // cadre, rose des vents, échelle
    b.strokeStyle = INK; b.lineWidth = Math.max(1.2, S / 300);
    b.setLineDash([S / 90, S / 120]); b.strokeRect(S * 0.012, S * 0.012, S * 0.976, S * 0.976); b.setLineDash([]);
    const cx = S * 0.9, cy = S * 0.1, r = S * 0.045;
    b.beginPath(); b.moveTo(cx, cy - r); b.lineTo(cx + r * 0.3, cy); b.lineTo(cx, cy + r); b.lineTo(cx - r * 0.3, cy); b.closePath(); b.stroke();
    b.beginPath(); b.moveTo(cx, cy - r); b.lineTo(cx + r * 0.3, cy); b.lineTo(cx, cy); b.closePath(); b.fill();
    b.font = `${Math.round(S / 30)}px Georgia, serif`; b.textAlign = 'center'; b.fillText('N', cx, cy - r * 1.25); b.textAlign = 'left';
    const L = S * (100 / W);
    b.beginPath(); b.moveTo(S * 0.06, S * 0.95); b.lineTo(S * 0.06 + L, S * 0.95); b.moveTo(S * 0.06, S * 0.94); b.lineTo(S * 0.06, S * 0.96); b.moveTo(S * 0.06 + L, S * 0.94); b.lineTo(S * 0.06 + L, S * 0.96); b.stroke();
    b.font = `italic ${Math.round(S / 40)}px Georgia, serif`; b.fillText('100 m', S * 0.06, S * 0.93);
    return c;
  }

  // ------------------------------------------------------------------ affichage et dessin
  function layout() {
    const S = Math.floor(Math.min(innerWidth - 24, innerHeight - 150, 900));
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.style.width = cv.style.height = S + 'px';
    if (size !== S * dpr) { size = S * dpr; cv.width = cv.height = size; base = drawBase(size); }
    redraw();
  }
  function redraw() {
    g.drawImage(base, 0, 0);
    g.strokeStyle = 'rgba(60,40,30,0.92)'; g.lineWidth = size / 260; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of strokes) {
      g.beginPath();
      for (let i = 0; i < s.length; i += 2) { const x = s[i] * size, y = s[i + 1] * size; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      if (s.length === 2) g.lineTo(s[0] * size + 0.5, s[1] * size + 0.5);
      g.stroke();
    }
  }
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
  let cur = null;
  // gomme : on retire les points touchés, les traits sont coupés en morceaux
  function erase(u, v) {
    const R = 0.022, out = [];
    let changed = false;
    for (const s of strokes) {
      let part = [];
      for (let i = 0; i < s.length; i += 2) {
        if (Math.hypot(s[i] - u, s[i + 1] - v) < R) { changed = true; if (part.length >= 2) out.push(part); part = []; }
        else part.push(s[i], s[i + 1]);
      }
      if (part.length >= 2) out.push(part);
    }
    if (changed) { strokes = out; redraw(); }
  }
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture?.(e.pointerId);
    const [u, v] = pt(e);
    if (tool === 'pen') { cur = [+u.toFixed(4), +v.toFixed(4)]; strokes.push(cur); redraw(); }
    else { cur = 'erase'; erase(u, v); }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const [u, v] = pt(e);
    if (cur === 'erase') return erase(u, v);
    const lu = cur[cur.length - 2], lv = cur[cur.length - 1];
    if (Math.hypot(u - lu, v - lv) < 0.003) return;
    cur.push(+u.toFixed(4), +v.toFixed(4));
    redraw();
  });
  const end = () => { if (cur) { cur = null; onChange?.(); } };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  const setTool = (t) => { tool = t; pen.classList.toggle('on', t === 'pen'); eraser.classList.toggle('on', t === 'eraser'); };
  pen.addEventListener('click', () => setTool('pen'));
  eraser.addEventListener('click', () => setTool('eraser'));

  function open() {
    box.hidden = false;
    layout();
    requestAnimationFrame(() => box.classList.add('on'));
    onOpen?.(true);
  }
  function close() {
    box.classList.remove('on');
    setTimeout(() => { if (!box.classList.contains('on')) box.hidden = true; }, 400);
    onOpen?.(false);
  }
  $('map-close').addEventListener('click', close);
  addEventListener('resize', () => { if (!box.hidden) layout(); });
  return { open, close, get isOpen() { return !box.hidden; }, data: () => ({ strokes }) };
}
