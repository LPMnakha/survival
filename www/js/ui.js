// Touchers dans le monde (ramasser, cueillir, construire, allumer, remplir la
// bouteille), fenêtre « Fabriquer », boutons d'action (placer, démonter, boire,
// manger) et petits messages en haut.
import * as THREE from '../vendor/three.module.min.js';
import { RECIPE } from './campfire.js';
import { RECIPE2 } from './collector.js';
import { itemName, theItem } from './models.js';
import { NEEDS } from './needs.js';

const SIP = 250;

export function createUI({ canvas, camera, controls, inventory, items, campfires, collectors, berries, needs, forest, hands, getAudio }) {
  const $ = (id) => document.getElementById(id);
  const pill = $('hint-pill'), actions = $('actions'), craft = $('craft-sheet'), recipes = $('recipes');
  const st = controls.state;
  const builds = [campfires, collectors];
  const placingMod = () => builds.find((b) => b.placing);

  // ------------------------------------------------------------------ petit message en haut
  let hintUntil = 0, context = '';
  function hint(text, ms = 2800) {
    hintUntil = performance.now() + ms;
    pill.textContent = text;
    pill.classList.add('on');
  }
  inventory.setEquipMessage((t) => hint(t, 3500));

  // ------------------------------------------------------------------ boutons d'action
  let shownActions = '', actionList = [];
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

  // ------------------------------------------------------------------ fabriquer
  const fireIcon = '<svg class="r-ico" viewBox="0 0 40 40" aria-hidden="true"><g fill="#a39e95"><ellipse cx="9" cy="31" rx="4" ry="2.6"/><ellipse cx="17" cy="33" rx="4" ry="2.6"/><ellipse cx="25" cy="33" rx="4" ry="2.6"/><ellipse cx="32" cy="30.5" rx="4" ry="2.6"/></g><g stroke="#7a5e45" stroke-width="2.6" stroke-linecap="round"><path d="M11 29 20 9M29 29 20 9"/></g><path d="M20 15c3 4 5 6 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1 2 2 2 3 1-1-2-1-3 0-4z" fill="#e9a061"/></svg>';
  const rainIcon = '<svg class="r-ico" viewBox="0 0 40 40" aria-hidden="true"><g stroke="#7a5e45" stroke-width="2.4" stroke-linecap="round"><path d="M8 34 10 16M32 34 30 16"/></g><path d="M7 16h26c-4 7-8 9-13 9S11 23 7 16z" fill="#3f7fb8"/><path d="M14 19.5c2 1.8 4 2.5 6 2.5s4-.7 6-2.5" fill="none" stroke="#7fb8de" stroke-width="2" stroke-linecap="round"/><g fill="#9cc9e8"><path d="M14 5c1.2 1.8 2 2.8 2 3.8a2 2 0 0 1-4 0c0-1 .8-2 2-3.8z"/><path d="M24 3c1.2 1.8 2 2.8 2 3.8a2 2 0 0 1-4 0c0-1 .8-2 2-3.8z"/></g></svg>';
  const LIST = [{ recipe: RECIPE, mod: campfires, icon: fireIcon }, { recipe: RECIPE2, mod: collectors, icon: rainIcon }];
  function renderRecipes() {
    recipes.innerHTML = '';
    for (const R of LIST) {
      const need = Object.entries(R.recipe.needs).map(([t, n]) => `${n} ${itemName(t, n)} <b>(${Math.min(inventory.count(t), n)}/${n})</b>`).join(' · ');
      const b = document.createElement('button');
      b.className = 'recipe';
      b.innerHTML = `${R.icon}<span><span class="r-name">${R.recipe.name}</span><span class="r-needs">${need}</span></span>`;
      b.addEventListener('click', () => {
        craft.classList.remove('on');
        inventory.open(false);
        R.mod.startPlacement();
        hint('Choisis l’endroit, puis « Placer ici ».', 4000);
      });
      recipes.appendChild(b);
    }
  }
  $('btn-craft').addEventListener('click', () => {
    if (hands.busy) return;
    const on = !craft.classList.contains('on');
    inventory.open(false);
    inventory.openEquip(false);
    if (on) renderRecipes();
    craft.classList.toggle('on', on);
  });
  craft.querySelector('.sheet-close').addEventListener('click', () => craft.classList.remove('on'));
  $('btn-inv').addEventListener('click', () => craft.classList.remove('on'));
  $('btn-equipment').addEventListener('click', () => craft.classList.remove('on'));
  inventory.setLock(() => hands.busy);
  // jeter un objet : la main le pose au sol devant soi, un par un
  inventory.setDrop((i) => {
    if (hands.busy || !st.enabled) return;
    const spot = items.dropSpot(st.pos, st.yaw);
    if (!spot) return hint('Pas de place ici pour poser un objet.');
    const got = inventory.takeAt(i);
    if (!got) return;
    const rot = Math.random() * Math.PI * 2;
    const target = { x: spot.x, y: controls.groundAt(spot.x, spot.z) + 0.05, z: spot.z };
    hands.place(target, got.type, () => { items.drop(got.type, spot.x, spot.z, rot, got.extra); getAudio()?.place(got.type); inventory.render(); });
    inventory.render();
  });

  // ------------------------------------------------------------------ boire, manger
  function drink() {
    const b = inventory.heldSlot();
    if (hands.busy || !b || b.type !== 'bouteille') return;
    if (b.w <= 0) return hint('La bouteille est vide. Remplis-la au récupérateur d’eau de pluie.');
    if (needs.thirst > 0.98) return hint('Tu n’as pas soif pour le moment.');
    hands.consume('bouteille', () => {
      const ml = Math.min(SIP, b.w);
      b.w -= ml;
      needs.drink((NEEDS.sip * ml) / SIP);
      getAudio()?.drink();
      inventory.changed();
    });
  }
  function eat() {
    if (hands.busy || inventory.heldType() !== 'baies') return;
    if (needs.hunger > 0.99) return hint('Tu n’as plus faim pour le moment.');
    const slot = inventory.held;
    hands.consume('baies', () => {
      inventory.takeAt(slot);
      needs.eat(NEEDS.berry);
      getAudio()?.eat();
    });
  }

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

  // le point du sol sous le doigt (pour le ruisseau)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pt = new THREE.Vector3();
  function groundUnder(x, y, max = 6) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (let d = 0.3; d < max; d += 0.1) {
      pt.copy(ray.ray.origin).addScaledVector(ray.ray.direction, d);
      if (pt.y <= controls.groundAt(pt.x, pt.z) + 0.05) return pt.clone();
    }
    return null;
  }

  function tap(x, y) {
    if (!st.enabled || hands.busy || placingMod()) return;
    craft.classList.remove('on');
    const p = st.pos;
    // feux de camp et récupérateurs
    for (const mod of builds) {
      const hit = mod.pickAt(camera, x, y, p);
      if (hit) {
        if (!hit.near) return hint('Approche-toi.');
        mod.act(hit.site);
        return;
      }
    }
    // objets au sol, butin
    const { spot, far } = items.pickAt(camera, x, y, p);
    if (spot) {
      if (!inventory.canAdd(spot.type)) return hint('Inventaire plein.');
      hands.pickup({ x: spot.x, y: spot.y, z: spot.z }, spot.type, () => {
        const extra = spot.extra;
        items.take(spot);
        inventory.add(spot.type, extra || {});
        getAudio()?.pick(spot.type);
        if (spot.loot && spot.type === 'sacoche') hint('Une sacoche ! Équipe-la depuis l’inventaire : 3 cases en plus.', 4500);
        if (spot.loot && spot.type === 'bouteille') hint('Une bouteille vide, 1 L. On peut la remplir au récupérateur d’eau de pluie.', 4500);
        if (spot.loot && spot.type === 'bache') hint('Une bâche en plastique : de quoi fabriquer un récupérateur d’eau de pluie.', 4500);
      });
      return;
    }
    // buissons de baies
    const bush = berries.pickAt(camera, x, y, p);
    if (bush) {
      if (!bush.near) return hint('Approche-toi du buisson.');
      if (bush.avail <= 0) return hint(bush.bush.bare ? 'Pas de baies sur ce buisson en cette saison.' : 'Plus de baies ici. Elles repoussent en une semaine.');
      if (!inventory.canAdd('baies')) return hint('Inventaire plein.');
      const c = berries.nextCluster(bush.bush);
      hands.pickup({ x: c.x, y: c.y, z: c.z }, 'baies', () => {
        berries.pick(bush.bush);
        inventory.add('baies');
        getAudio()?.pick('baies');
      });
      return;
    }
    // l'eau du ruisseau n'est pas potable
    if (inventory.heldType() === 'bouteille') {
      const g = groundUnder(x, y);
      if (g && forest.streamDist(g.x, g.z) < 1.8) return hint('L’eau du ruisseau n’est pas potable.');
    }
    if (far) hint(`Approche-toi pour ramasser ${theItem(far.type)}.`);
  }

  // ------------------------------------------------------------------ chaque image : boutons et indice selon la situation
  let timer = 0, wasBusy = false;
  function update(dt) {
    // les boutons de l'inventaire redeviennent actifs à la fin du geste
    if (hands.busy !== wasBusy) { wasBusy = hands.busy; inventory.render(); timer = 0; }
    timer -= dt;
    if (timer > 0) return;
    timer = 0.2;
    const now = performance.now();
    const pm = placingMod();
    if (pm) {
      setActions('placer', [
        { label: 'Placer ici', main: true, fn: () => { if (pm.confirmPlacement()) { setActions('', []); hint('Touche la preview pour poser les éléments un par un.', 4000); } } },
        { label: 'Annuler', fn: () => { pm.cancelPlacement(); setActions('', []); } },
      ]);
      const b = actionList[0]?.el;
      if (b) b.disabled = !pm.placeOk;
      context = pm.placeOk ? '' : 'Pas ici : trouve un endroit dégagé et plat.';
    } else {
      let site = null, mod = null;
      if (!hands.busy && st.enabled) for (const m of builds) { const s = m.nearest(st.pos, 3.2); if (s && (!site || Math.hypot(s.x - st.pos.x, s.z - st.pos.z) < Math.hypot(site.x - st.pos.x, site.z - st.pos.z))) { site = s; mod = m; } }
      const held = inventory.heldSlot();
      // en haut de l'écran, pour ne pas le toucher en visant la construction
      if (site && site.stage === 'build') setActions('demonter', [{ label: 'Démonter', fn: () => mod.dismantle(site) }], true);
      else if (!hands.busy && st.enabled && held && held.type === 'bouteille') setActions('boire' + (held.w > 0), [{ label: held.w > 0 ? 'Boire' : 'Bouteille vide', main: held.w > 0, fn: drink }]);
      else if (!hands.busy && st.enabled && held && held.type === 'baies') setActions('manger', [{ label: 'Manger', main: true, fn: eat }]);
      else setActions('', []);
      context = site && !hands.busy ? mod.label(site) : '';
    }
    // un message ponctuel passe avant l'indice de contexte
    if (now < hintUntil) return;
    if (context) { if (pill.textContent !== context) pill.textContent = context; pill.classList.add('on'); }
    else pill.classList.remove('on');
  }

  return { hint, update, drink, eat };
}
