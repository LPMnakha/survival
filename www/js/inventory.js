// Inventaire : 5 cases en tout (pas de sac au début), dont 3 d'accès rapide
// toujours visibles. Piles de 10 au plus ; un même objet peut occuper
// plusieurs cases. Toucher une case d'accès rapide met l'objet en main (ou le
// range) ; dans l'inventaire complet, toucher une case puis une autre les échange.
import { ITEMS, ICONS, itemName } from './models.js';

export const SLOTS = 5, QUICK = 3;

export function createInventory({ saved, onChange }) {
  let slots = [{ type: 'pierre-a-feu', n: 1 }, null, null, null, null];
  let held = -1;
  if (saved && Array.isArray(saved.slots) && saved.slots.length === SLOTS) {
    slots = saved.slots.map((s) => (s && ITEMS[s.type] && s.n > 0 ? { type: s.type, n: Math.min(s.n, ITEMS[s.type].stack) } : null));
    held = Number.isInteger(saved.held) && saved.held < QUICK ? saved.held : -1;
  }
  const changed = () => { render(); onChange?.(); };

  const count = (type) => slots.reduce((a, s) => a + (s && s.type === type ? s.n : 0), 0);
  const canAdd = (type) => slots.some((s) => !s || (s.type === type && s.n < ITEMS[type].stack));
  function add(type) {
    let i = slots.findIndex((s) => s && s.type === type && s.n < ITEMS[type].stack);
    if (i < 0) i = slots.findIndex((s) => !s);
    if (i < 0) return false;
    if (slots[i]) slots[i].n++; else slots[i] = { type, n: 1 };
    changed();
    return true;
  }
  // retire un objet : d'abord dans la plus petite pile qui n'est pas en main
  function take(type) {
    let best = -1;
    slots.forEach((s, i) => {
      if (!s || s.type !== type) return;
      if (best < 0) { best = i; return; }
      const b = slots[best];
      const score = (k, x) => (k === held ? 100 : 0) + x.n;
      if (score(i, s) < score(best, b)) best = i;
    });
    if (best < 0) return false;
    if (--slots[best].n <= 0) slots[best] = null;
    changed();
    return true;
  }
  // retire un objet d'une case précise (pour jeter)
  function takeAt(i) {
    const s = slots[i];
    if (!s) return null;
    const type = s.type;
    if (--s.n <= 0) { slots[i] = null; if (held === i) held = -1; }
    changed();
    return type;
  }
  const heldType = () => (held >= 0 && slots[held] ? slots[held].type : null);
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

  // ------------------------------------------------------------------ interface
  const $ = (id) => document.getElementById(id);
  const quick = $('quick'), full = $('inv-slots'), sheet = $('inv-sheet'), dropBtn = $('btn-drop');
  let onDrop = null;
  const slotHTML = (s) => s ? `${ICONS[s.type]}${ITEMS[s.type].stack > 1 ? `<span class="qty">${s.n}</span>` : ''}` : '';
  const label = (s) => (s ? `${s.n} ${itemName(s.type, s.n)}` : 'case vide');
  let sel = -1;
  for (let i = 0; i < QUICK; i++) {
    const b = document.createElement('button');
    b.className = 'slot';
    b.addEventListener('click', () => { if (!locked()) toggleHeld(i); });
    quick.appendChild(b);
  }
  for (let i = 0; i < SLOTS; i++) {
    const b = document.createElement('button');
    b.className = 'slot' + (i === QUICK ? ' gap' : '');
    b.addEventListener('click', () => {
      if (locked()) return;
      if (sel < 0) sel = i;
      else if (sel === i) sel = -1;
      else { const a = sel; sel = -1; swap(a, i); return; }
      render();
    });
    full.appendChild(b);
  }
  let locked = () => false;
  function render() {
    [...quick.children].forEach((b, i) => {
      b.innerHTML = slotHTML(slots[i]);
      b.classList.toggle('held', i === held && !!slots[i]);
      b.setAttribute('aria-label', label(slots[i]) + (i === held ? ', en main' : ''));
    });
    [...full.children].forEach((b, i) => {
      b.innerHTML = slotHTML(slots[i]);
      b.classList.toggle('held', i === held && !!slots[i]);
      b.classList.toggle('sel', i === sel);
      b.setAttribute('aria-label', label(slots[i]));
    });
    // « Jeter » : une case sélectionnée avec un objet qu'on peut jeter (pas la pierre à feu)
    if (sel >= 0 && !slots[sel]) sel = -1;
    const s = sel >= 0 ? slots[sel] : null;
    dropBtn.disabled = !s || s.type === 'pierre-a-feu' || locked();
    dropBtn.textContent = s && s.type !== 'pierre-a-feu' ? `Jeter ${s.type === 'caillou' ? 'un caillou' : s.type === 'brindille' ? 'une brindille' : 'un bâton'}` : 'Jeter';
  }
  function open(on = !sheet.classList.contains('on')) {
    sel = -1;
    sheet.classList.toggle('on', on);
    render();
  }
  dropBtn.addEventListener('click', () => {
    if (dropBtn.disabled || !onDrop) return;
    onDrop(sel);
  });
  sheet.querySelector('.sheet-close').addEventListener('click', () => open(false));
  $('btn-inv').addEventListener('click', () => open());
  render();

  return {
    count, canAdd, add, take, takeAt, heldType, toggleHeld, swap, open, render,
    setDrop(fn) { onDrop = fn; },
    get held() { return held; },
    get slots() { return slots; },
    setLock(fn) { locked = fn; },
    data: () => ({ slots, held }),
  };
}
