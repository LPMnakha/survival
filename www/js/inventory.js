// Inventaire : 5 cases sans sac (dont 3 d'accès rapide toujours visibles),
// 8 avec la sacoche équipée. Piles de 10 au plus ; un même objet peut occuper
// plusieurs cases. Toucher une case d'accès rapide met l'objet en main (ou le
// range) ; dans l'inventaire complet, toucher une case puis une autre les échange.
// Équipement : tête, haut, bas, chaussures, sac (la sacoche va dans la case sac).
import { ITEMS, ICONS, itemName, anItem, bottleIcon, fmtWater, EQUIP_SLOTS } from './models.js';

export const MAX = 8, BASE = 5, QUICK = 3;

export function createInventory({ saved, onChange }) {
  let slots = [{ type: 'pierre-a-feu', n: 1 }, null, null, null, null, null, null, null];
  let held = -1;
  const equip = { tete: null, haut: null, bas: null, chaussures: null, sac: null };
  const clean = (s) => (s && ITEMS[s.type] && s.n > 0 ? { type: s.type, n: Math.min(s.n, ITEMS[s.type].stack), ...(s.type === 'bouteille' ? { w: Math.max(0, Math.min(1000, s.w || 0)) } : {}) } : null);
  if (saved && Array.isArray(saved.slots)) {
    slots = Array.from({ length: MAX }, (_, i) => clean(saved.slots[i]));
    held = Number.isInteger(saved.held) && saved.held < QUICK ? saved.held : -1;
    for (const k of Object.keys(equip)) if (saved.equip && saved.equip[k] && ITEMS[saved.equip[k].type]) equip[k] = { type: saved.equip[k].type };
  }
  const cap = () => BASE + (equip.sac ? 3 : 0);
  const changed = () => { render(); onChange?.(); };
  const usable = () => slots.slice(0, cap()).map((s, i) => [s, i]);

  const count = (type) => usable().reduce((a, [s]) => a + (s && s.type === type ? s.n : 0), 0);
  const canAdd = (type) => usable().some(([s]) => !s || (s.type === type && s.n < ITEMS[type].stack));
  function add(type, extra = {}) {
    let i = -1;
    if (ITEMS[type].stack > 1) i = slots.findIndex((s, k) => k < cap() && s && s.type === type && s.n < ITEMS[type].stack);
    if (i < 0) i = slots.findIndex((s, k) => k < cap() && !s);
    if (i < 0) return false;
    if (slots[i]) slots[i].n++; else slots[i] = { type, n: 1, ...(type === 'bouteille' ? { w: extra.w || 0 } : {}) };
    changed();
    return true;
  }
  // retire un objet : d'abord dans la plus petite pile qui n'est pas en main
  function take(type) {
    let best = -1;
    usable().forEach(([s, i]) => {
      if (!s || s.type !== type) return;
      if (best < 0) { best = i; return; }
      const score = (k, x) => (k === held ? 100 : 0) + x.n;
      if (score(i, s) < score(best, slots[best])) best = i;
    });
    if (best < 0) return false;
    if (--slots[best].n <= 0) { slots[best] = null; if (held === best) held = -1; }
    changed();
    return true;
  }
  // retire un objet d'une case précise (pour jeter) ; rend son type et son contenu (eau)
  function takeAt(i) {
    const s = slots[i];
    if (!s) return null;
    const out = { type: s.type, extra: s.type === 'bouteille' ? { w: s.w || 0 } : undefined };
    if (--s.n <= 0) { slots[i] = null; if (held === i) held = -1; }
    changed();
    return out;
  }
  const heldType = () => (held >= 0 && slots[held] ? slots[held].type : null);
  const heldSlot = () => (held >= 0 ? slots[held] : null);
  function toggleHeld(i) {
    held = held === i ? -1 : i;
    changed();
  }
  function swap(a, b) {
    [slots[a], slots[b]] = [slots[b], slots[a]];
    // ce qu'on a en main suit l'objet, tant qu'il reste dans l'accès rapide
    if (held === a) held = b < QUICK ? b : -1;
    else if (held === b) held = a < QUICK ? a : -1;
    changed();
  }
  // équiper ce qui se porte (la sacoche dans la case sac)
  function equipFrom(i) {
    const s = slots[i];
    const where = s && ITEMS[s.type].wear;
    if (!where || equip[where]) return false;
    equip[where] = { type: s.type };
    slots[i] = null;
    if (held === i) held = -1;
    changed();
    return true;
  }
  // enlever : il faut que les cases du sac soient vides et qu'il reste une place pour lui
  function unequip(where) {
    const e = equip[where];
    if (!e) return 'vide';
    if (where === 'sac' && slots.slice(BASE, MAX).some(Boolean)) return 'sac-plein';
    const free = slots.findIndex((s, k) => k < BASE && !s);
    if (free < 0) return 'plein';
    slots[free] = { type: e.type, n: 1 };
    equip[where] = null;
    changed();
    return 'ok';
  }

  // ------------------------------------------------------------------ interface
  const $ = (id) => document.getElementById(id);
  const quick = $('quick'), full = $('inv-slots'), sheet = $('inv-sheet'), dropBtn = $('btn-drop'), equipBtn = $('btn-equip'), readBtn = $('btn-read');
  const eqSheet = $('equip-sheet'), eqSlots = $('equip-slots'), eqBtn = $('btn-unequip'), eqHint = $('equip-hint');
  let onDrop = null, onEquip = null, onRead = null, locked = () => false;
  const slotHTML = (s) => {
    if (!s) return '';
    if (s.type === 'bouteille') return `${bottleIcon(s.w)}<span class="qty">${fmtWater(s.w)}</span>`;
    return `${ICONS[s.type]}${ITEMS[s.type].stack > 1 ? `<span class="qty">${s.n}</span>` : ''}`;
  };
  const label = (s) => (!s ? 'case vide' : s.type === 'bouteille' ? `bouteille, ${fmtWater(s.w)}` : `${s.n} ${itemName(s.type, s.n)}`);
  let sel = -1, eqSel = null;
  for (let i = 0; i < QUICK; i++) {
    const b = document.createElement('button');
    b.className = 'slot';
    // la carte s'ouvre directement ; le reste se prend en main
    b.addEventListener('click', () => { if (locked()) return; if (slots[i]?.type === 'carte') onRead?.(); else toggleHeld(i); });
    quick.appendChild(b);
  }
  for (let i = 0; i < MAX; i++) {
    if (i === QUICK) { const br = document.createElement('div'); br.className = 'slot-break'; full.appendChild(br); }
    const b = document.createElement('button');
    b.className = 'slot';
    b.dataset.i = i;
    b.addEventListener('click', () => {
      if (locked()) return;
      if (sel < 0) sel = i;
      else if (sel === i) sel = -1;
      else { const a = sel; sel = -1; swap(a, i); return; }
      render();
    });
    full.appendChild(b);
  }
  for (const E of EQUIP_SLOTS) {
    const b = document.createElement('button');
    b.className = 'slot eq';
    b.dataset.id = E.id;
    b.innerHTML = `<span class="eq-empty">${E.icon}</span><span class="eq-name">${E.name}</span>`;
    b.addEventListener('click', () => { if (locked()) return; eqSel = eqSel === E.id ? null : E.id; render(); });
    eqSlots.appendChild(b);
  }
  function render() {
    [...quick.children].forEach((b, i) => {
      b.innerHTML = slotHTML(slots[i]);
      b.classList.toggle('held', i === held && !!slots[i]);
      b.setAttribute('aria-label', label(slots[i]) + (i === held ? ', en main' : ''));
    });
    const c = cap();
    if (sel >= c) sel = -1;
    full.querySelectorAll('.slot').forEach((b) => {
      const i = +b.dataset.i;
      b.hidden = i >= c;
      b.innerHTML = slotHTML(slots[i]);
      b.classList.toggle('held', i === held && !!slots[i]);
      b.classList.toggle('sel', i === sel);
      b.classList.toggle('bag', i >= BASE);
      b.setAttribute('aria-label', label(slots[i]));
    });
    // « Jeter » : un objet sélectionné qu'on peut jeter (pas la pierre à feu) ; « Équiper » : ce qui se porte
    if (sel >= 0 && !slots[sel]) sel = -1;
    const s = sel >= 0 ? slots[sel] : null;
    dropBtn.disabled = !s || s.type === 'pierre-a-feu' || locked();
    dropBtn.textContent = s && s.type !== 'pierre-a-feu' ? `Jeter ${anItem(s.type)}` : 'Jeter';
    const wear = s && ITEMS[s.type].wear;
    equipBtn.hidden = !wear;
    equipBtn.disabled = !wear || !!equip[wear] || locked();
    readBtn.hidden = !(s && s.type === 'carte');
    // équipement
    eqSlots.querySelectorAll('.slot').forEach((b) => {
      const e = equip[b.dataset.id];
      b.classList.toggle('filled', !!e);
      b.classList.toggle('sel', eqSel === b.dataset.id);
      const icon = b.querySelector('.eq-item');
      if (e && !icon) b.insertAdjacentHTML('afterbegin', `<span class="eq-item">${ICONS[e.type]}</span>`);
      if (!e && icon) icon.remove();
      b.setAttribute('aria-label', `${b.dataset.id} : ${e ? ITEMS[e.type].one : 'vide'}`);
    });
    if (eqSel && !equip[eqSel]) eqSel = null;
    eqBtn.disabled = !eqSel || locked();
    eqBtn.textContent = eqSel ? `Retirer la ${ITEMS[equip[eqSel].type].one}` : 'Retirer';
    eqHint.textContent = equip.sac ? 'La sacoche ajoute 3 cases à l’inventaire.' : 'Rien d’équipé pour l’instant. Une sacoche trouvée irait dans la case sac.';
  }
  function open(on = !sheet.classList.contains('on')) {
    sel = -1;
    sheet.classList.toggle('on', on);
    if (on) eqSheet.classList.remove('on');
    render();
  }
  function openEquip(on = !eqSheet.classList.contains('on')) {
    eqSel = null;
    eqSheet.classList.toggle('on', on);
    if (on) sheet.classList.remove('on');
    render();
  }
  dropBtn.addEventListener('click', () => { if (!dropBtn.disabled && onDrop) onDrop(sel); });
  readBtn.addEventListener('click', () => { open(false); onRead?.(); });
  equipBtn.addEventListener('click', () => {
    if (equipBtn.disabled) return;
    const t = slots[sel]?.type;
    if (equipFrom(sel)) { sel = -1; onEquip?.(`${ITEMS[t].one[0].toUpperCase() + ITEMS[t].one.slice(1)} équipée : 3 cases en plus.`); render(); }
  });
  eqBtn.addEventListener('click', () => {
    if (eqBtn.disabled) return;
    const r = unequip(eqSel);
    if (r === 'sac-plein') onEquip?.('Vide d’abord les 3 cases de la sacoche.');
    else if (r === 'plein') onEquip?.('Il faut une case libre pour ranger la sacoche.');
    else eqSel = null;
    render();
  });
  sheet.querySelector('.sheet-close').addEventListener('click', () => open(false));
  eqSheet.querySelector('.sheet-close').addEventListener('click', () => openEquip(false));
  $('btn-inv').addEventListener('click', () => open());
  $('btn-equipment').addEventListener('click', () => openEquip());
  render();

  return {
    count, canAdd, add, take, takeAt, heldType, heldSlot, toggleHeld, swap, open, openEquip, render, equipFrom, unequip,
    setDrop(fn) { onDrop = fn; },
    setEquipMessage(fn) { onEquip = fn; },
    setRead(fn) { onRead = fn; },
    get held() { return held; },
    get slots() { return slots; },
    get equip() { return equip; },
    get capacity() { return cap(); },
    changed,
    setLock(fn) { locked = fn; },
    data: () => ({ slots, held, equip }),
  };
}
