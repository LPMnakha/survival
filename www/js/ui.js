// Touchers dans le monde (ramasser, construire, allumer, alimenter le feu),
// fenêtre « Fabriquer », boutons d'action et petits messages en haut.
import { RECIPE } from './campfire.js';
import { itemName } from './models.js';

export function createUI({ canvas, camera, controls, inventory, items, campfires, hands, getAudio }) {
  const $ = (id) => document.getElementById(id);
  const pill = $('hint-pill'), actions = $('actions'), craft = $('craft-sheet'), recipes = $('recipes');
  const st = controls.state;

  // ------------------------------------------------------------------ petit message en haut
  let hintUntil = 0, hintText = '', context = '';
  function hint(text, ms = 2800) {
    hintText = text;
    hintUntil = performance.now() + ms;
    pill.textContent = text;
    pill.classList.add('on');
  }

  // ------------------------------------------------------------------ boutons d'action (placer, annuler, démonter)
  let shownActions = '';
  function setActions(key, list, top = false) {
    if (key === shownActions) return;
    shownActions = key;
    actions.classList.toggle('top', top);
    actions.innerHTML = '';
    for (const a of list) {
      const b = document.createElement('button');
      b.textContent = a.label;
      if (a.main) b.className = 'main';
      b.addEventListener('click', a.fn);
      a.el = b;
      actions.appendChild(b);
    }
    actions.classList.toggle('on', list.length > 0);
    actionList = list;
  }
  let actionList = [];

  // ------------------------------------------------------------------ fabriquer
  const fireIcon = '<svg class="r-ico" viewBox="0 0 40 40" aria-hidden="true"><g fill="#a39e95"><ellipse cx="9" cy="31" rx="4" ry="2.6"/><ellipse cx="17" cy="33" rx="4" ry="2.6"/><ellipse cx="25" cy="33" rx="4" ry="2.6"/><ellipse cx="32" cy="30.5" rx="4" ry="2.6"/></g><g stroke="#7a5e45" stroke-width="2.6" stroke-linecap="round"><path d="M11 29 20 9M29 29 20 9"/></g><path d="M20 15c3 4 5 6 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1 2 2 2 3 1-1-2-1-3 0-4z" fill="#e9a061"/></svg>';
  function renderRecipes() {
    const needs = Object.entries(RECIPE.needs).map(([t, n]) => {
      const have = inventory.count(t);
      return `${n} ${itemName(t, n)} <b>(${Math.min(have, n)}/${n})</b>`;
    }).join(' · ');
    recipes.innerHTML = `<button class="recipe">${fireIcon}<span><span class="r-name">${RECIPE.name}</span><span class="r-needs">${needs}</span></span></button>`;
    recipes.querySelector('.recipe').addEventListener('click', () => {
      craft.classList.remove('on');
      inventory.open(false);
      campfires.startPlacement();
      hint('Choisis l’endroit, puis « Placer ici ».', 4000);
    });
  }
  $('btn-craft').addEventListener('click', () => {
    if (hands.busy) return;
    const on = !craft.classList.contains('on');
    inventory.open(false);
    if (on) renderRecipes();
    craft.classList.toggle('on', on);
  });
  craft.querySelector('.sheet-close').addEventListener('click', () => craft.classList.remove('on'));
  $('btn-inv').addEventListener('click', () => craft.classList.remove('on'));
  inventory.setLock(() => hands.busy);

  // ------------------------------------------------------------------ toucher le monde
  // un toucher = appui court sans glisser (sinon c'est regarder ou marcher)
  const downs = new Map();
  canvas.addEventListener('pointerdown', (e) => downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() }));
  const up = (e) => {
    const d = downs.get(e.pointerId);
    downs.delete(e.pointerId);
    if (!d || e.type === 'pointercancel') return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 12 && performance.now() - d.t < 450) tap(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  function tap(x, y) {
    if (!st.enabled || hands.busy || campfires.placing) return;
    craft.classList.remove('on');
    const p = st.pos;
    const fire = campfires.pickAt(camera, x, y, p);
    if (fire) {
      if (!fire.near) return hint('Approche-toi du feu.');
      campfires.act(fire.site);
      return;
    }
    const { spot, far } = items.pickAt(camera, x, y, p);
    if (spot) {
      if (!inventory.canAdd(spot.type)) return hint('Inventaire plein.');
      const target = { x: spot.x, y: spot.y, z: spot.z };
      hands.pickup(target, spot.type, () => {
        items.take(spot);
        inventory.add(spot.type);
        getAudio()?.pick(spot.type);
      });
      return;
    }
    if (far) hint(`Approche-toi pour ramasser ${far.type === 'caillou' ? 'ce caillou' : far.type === 'brindille' ? 'cette brindille' : 'ce bâton'}.`);
  }

  // ------------------------------------------------------------------ chaque image : boutons et indice selon la situation
  let timer = 0;
  function update(dt) {
    timer -= dt;
    if (timer > 0) return;
    timer = 0.2;
    const now = performance.now();
    if (campfires.placing) {
      setActions('placer', [
        { label: 'Placer ici', main: true, fn: () => { if (campfires.confirmPlacement()) { setActions('', []); hint('Touche la preview pour poser les éléments un par un.', 4000); } } },
        { label: 'Annuler', fn: () => { campfires.cancelPlacement(); setActions('', []); } },
      ]);
      const b = actionList[0]?.el;
      if (b) b.disabled = !campfires.placeOk;
      context = campfires.placeOk ? '' : 'Pas ici : trouve un endroit dégagé et plat.';
    } else {
      const site = !hands.busy && st.enabled ? campfires.nearest(st.pos, 3.2) : null;
      // en haut de l'écran, pour ne pas le toucher en visant le feu
      if (site && site.stage === 'build') setActions('demonter', [{ label: 'Démonter', fn: () => campfires.dismantle(site) }], true);
      else setActions('', []);
      context = site && !hands.busy ? campfires.label(site) : '';
    }
    // un message ponctuel passe avant l'indice de contexte
    if (now < hintUntil) return;
    if (context) { if (pill.textContent !== context) pill.textContent = context; pill.classList.add('on'); }
    else pill.classList.remove('on');
  }

  return { hint, update };
}
