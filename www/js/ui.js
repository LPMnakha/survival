// Touchers dans le monde (ramasser, cueillir, construire, allumer, remplir la
// bouteille), fenêtre « Fabriquer », boutons d'action (placer, démonter, boire,
// manger) et petits messages en haut.
import * as THREE from '../vendor/three.module.min.js';
import { RECIPE } from './campfire.js';
import { RECIPE2 } from './collector.js';
import { RECIPE3 } from './shelter.js';
import { RECIPE5, WEAVES } from './loom.js';
import { itemName, theItem, anItem, ICONS } from './models.js';
import { YIELD } from './plants.js';
import { NEEDS } from './needs.js';

const SIP = 250;

export function createUI({ canvas, camera, controls, inventory, items, campfires, collectors, shelters, looms, berries, plants, rabbits, spears, needs, sleep, forest, hands, getAudio }) {
  const $ = (id) => document.getElementById(id);
  const pill = $('hint-pill'), actions = $('actions'), craft = $('craft-sheet'), recipes = $('recipes');
  const st = controls.state;
  const builds = [campfires, collectors, shelters, looms];
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
  const loomIcon = '<svg class="r-ico" viewBox="0 0 40 40" aria-hidden="true"><g stroke="#7a5e45" stroke-width="2.4" stroke-linecap="round"><path d="M8 36 11 9M32 36 29 9M6 30h28M7 12h26"/></g><g stroke="#c3b78a" stroke-width="1.2"><path d="M13 12v18M17 12v18M21 12v18M25 12v18"/></g><path d="M12 23h16v7H12z" fill="#b3a679"/><g stroke="#8f8458" stroke-width="1"><path d="M12 25h16M12 27.5h16"/></g></svg>';
  const shelterIcon = '<svg class="r-ico" viewBox="0 0 40 40" aria-hidden="true"><path d="M5 31 20 12l15 19z" fill="#6f9a48"/><path d="M5 31 20 12l3 4-12 15z" fill="#5c853c"/><g stroke="#6b5240" stroke-width="2.4" stroke-linecap="round"><path d="M8 33 20 10M32 33 20 10M14 9l12 0"/></g><g fill="#9a968e"><ellipse cx="9" cy="33" rx="3" ry="2"/><ellipse cx="31" cy="33" rx="3" ry="2"/></g></svg>';
  const ico = (t) => `<span class="r-ico">${ICONS[t]}</span>`;
  // outils : fabriqués dans les mains ; structures : posées au sol pièce par pièce
  const TOOLS = [
    { name: 'Couteau artisanal', needs: { silex: 2 }, out: 'couteau', icon: ico('couteau'), note: 'Pour couper les plantes : feuilles et fibres.' },
    { name: 'Corde', needs: { fibre: 2 }, out: 'corde', icon: ico('corde') },
    { name: 'Lance', needs: { baton: 1, corde: 1, couteau: 1 }, out: 'lance', icon: ico('lance'), note: 'La lame du couteau est ligaturée au bout du bâton.' },
  ];
  const STRUCTS = [
    { recipe: RECIPE, mod: campfires, icon: fireIcon },
    { recipe: RECIPE2, mod: collectors, icon: rainIcon },
    { recipe: RECIPE3, mod: shelters, icon: shelterIcon },
    { recipe: RECIPE5, mod: looms, icon: loomIcon },
  ];
  // la fenêtre du métier à tisser : ce qu'on peut y fabriquer
  const loomSheet = $('loom-sheet'), loomList = $('loom-recipes');
  loomSheet.querySelector('.sheet-close').addEventListener('click', () => loomSheet.classList.remove('on'));
  looms.setMenu((site) => {
    loomList.innerHTML = '';
    for (const w of WEAVES) {
      const need = { corde: w.warp + w.weft };
      const b = document.createElement('button');
      b.className = 'recipe' + (hasAll(need) ? '' : ' missing');
      b.innerHTML = `${ico(w.out)}<span><span class="r-name">${w.name}</span><span class="r-needs">${needLine(need)}</span><span class="r-needs">${w.note}</span></span>`;
      b.addEventListener('click', () => { loomSheet.classList.remove('on'); looms.choose(site, w.id); });
      loomList.appendChild(b);
    }
    inventory.open(false); craft.classList.remove('on');
    loomSheet.classList.add('on');
  });
  let tab = 'outils';
  craft.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    craft.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b));
    renderRecipes();
  }));
  const needLine = (needs) => Object.entries(needs).map(([t, n]) => `${n} ${itemName(t, n)} <b>(${Math.min(inventory.count(t), n)}/${n})</b>`).join(' · ');
  const hasAll = (needs) => Object.entries(needs).every(([t, n]) => inventory.count(t) >= n);
  function renderRecipes() {
    recipes.innerHTML = '';
    const list = tab === 'outils' ? TOOLS.map((T) => ({ name: T.name, needs: T.needs, icon: T.icon, note: T.note, fn: () => craftTool(T) }))
      : STRUCTS.map((S) => ({ name: S.recipe.name, needs: S.recipe.needs, icon: S.icon, fn: () => { craft.classList.remove('on'); inventory.open(false); S.mod.startPlacement(); hint('Choisis l’endroit, puis « Placer ici ».', 4000); } }));
    for (const R of list) {
      const b = document.createElement('button');
      b.className = 'recipe' + (hasAll(R.needs) ? '' : ' missing');
      b.innerHTML = `${R.icon}<span><span class="r-name">${R.name}</span><span class="r-needs">${needLine(R.needs)}</span>${R.note ? `<span class="r-needs">${R.note}</span>` : ''}</span>`;
      b.addEventListener('click', R.fn);
      recipes.appendChild(b);
    }
  }
  // fabriquer un outil : on prend les ingrédients, les mains font le geste, l'outil arrive dans l'inventaire
  function craftTool(T) {
    if (hands.busy) return;
    if (!hasAll(T.needs)) {
      const miss = Object.entries(T.needs).filter(([t, n]) => inventory.count(t) < n).map(([t, n]) => `${n - inventory.count(t)} ${itemName(t, n - inventory.count(t))}`);
      return hint(`Il te manque ${miss.join(' et ')}.`);
    }
    const taken = [];
    for (const [t, n] of Object.entries(T.needs)) for (let i = 0; i < n; i++) { inventory.take(t); taken.push(t); }
    if (!inventory.canAdd(T.out)) {
      for (const t of taken) inventory.add(t);
      return hint('Inventaire plein : fais de la place pour l’outil.');
    }
    craft.classList.remove('on');
    hands.craft(T.out, () => {
      inventory.add(T.out);
      getAudio()?.crafted(T.out);
      hint(`${T.name} fabriqué${T.out === 'corde' || T.out === 'lance' ? 'e' : ''}.`, 2500);
    });
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
    const target = { x: spot.x, y: items.restY(got.type, spot.x, spot.z, rot), z: spot.z };
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
    const type = inventory.heldType();
    if (hands.busy || (type !== 'baies' && type !== 'viande-cuite')) return;
    if (needs.hunger > 0.99) return hint('Tu n’as plus faim pour le moment.');
    const slot = inventory.held;
    hands.consume(type, () => {
      inventory.takeAt(slot);
      needs.eat(type === 'baies' ? NEEDS.berry : NEEDS.meat);
      getAudio()?.eat();
    });
  }

  // la lance part vers ce qu'on regarde (point de visée au centre) : on calcule l'angle de tir
  // pour que sa trajectoire courbe retombe sur ce point (un lapin dans la mire, sinon le sol)
  const fwdV = new THREE.Vector3(), toR = new THREE.Vector3(), probe = new THREE.Vector3();
  function aimTarget() {
    camera.updateMatrixWorld();
    camera.getWorldDirection(fwdV);
    const eye = camera.position;
    let best = null, ba = 0.075;
    for (const r of rabbits.list) {
      if (!r.alive || r.gone || Math.abs(r.x - eye.x) > 30 || Math.abs(r.z - eye.z) > 30) continue;
      toR.set(r.x, forest.surfaceY(r.x, r.z) + 0.13, r.z).sub(eye);
      const d = toR.length();
      if (d > 30) continue;
      const a = Math.acos(Math.min(1, toR.dot(fwdV) / d));
      if (a < ba) { ba = a; best = toR.clone().add(eye); }
    }
    if (best) return best;
    for (let d = 1; d <= 30; d += 0.25) {
      probe.copy(eye).addScaledVector(fwdV, d);
      if (probe.y <= forest.surfaceY(probe.x, probe.z)) return probe.clone();
      if (d > 2 && forest.blocked(probe.x, probe.z, 0) && probe.y < forest.surfaceY(probe.x, probe.z) + 4) return probe.clone();
    }
    return probe.clone();
  }
  function aimVelocity(tip, v) {
    const t = aimTarget(), g = 9.8;
    const dx = Math.hypot(t.x - tip.x, t.z - tip.z), dy = t.y - tip.y;
    const disc = v ** 4 - g * (g * dx * dx + 2 * dy * v * v);
    const ang = disc >= 0 ? Math.atan((v * v - Math.sqrt(disc)) / (g * Math.max(dx, 0.01))) : Math.PI / 4;
    const h = Math.atan2(t.x - tip.x, t.z - tip.z);
    return new THREE.Vector3(Math.sin(h) * Math.cos(ang), Math.sin(ang), Math.cos(h) * Math.cos(ang)).multiplyScalar(v);
  }

  // ------------------------------------------------------------------ la lance : attaquer, lancer
  const combat = $('combat');
  $('btn-attack').addEventListener('click', () => {
    if (hands.busy || inventory.heldType() !== 'lance' || sleep.busy) return;
    getAudio()?.thrust();
    hands.thrust(() => {
      const r = rabbits.inReach(st.pos, st.yaw);
      if (r) { rabbits.kill(r); getAudio()?.impact('lapin'); hint('Touché !', 2000); }
    });
  });
  $('btn-throw').addEventListener('click', () => {
    if (hands.busy || inventory.heldType() !== 'lance' || sleep.busy || spears.flying) return;
    const slot = inventory.held;
    hands.throwSpear((tip) => {
      inventory.takeAt(slot);
      spears.launch(tip, aimVelocity(tip, 16));
    });
  });

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

  let lastKnifeHint = 0;
  const P_HINT = () => { const t = performance.now(); if (t - lastKnifeHint < 20000) return false; lastKnifeHint = t; return true; };
  function tap(x, y) {
    if (!st.enabled || hands.busy || placingMod() || sleep.busy || looms.weaving) return;
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
    // une lance plantée : on la ramasse
    const sp = spears.pickAt(camera, x, y, p);
    if (sp) {
      if (!sp.near) return hint('Approche-toi de la lance.');
      if (!inventory.canAdd('lance')) return hint('Inventaire plein.');
      hands.pickup({ x: sp.at.x, y: sp.at.y, z: sp.at.z }, 'lance', () => { spears.take(sp.spear); inventory.add('lance'); getAudio()?.pick('baton'); });
      return;
    }
    // un lapin mort : récupérer la lance plantée dedans, puis le dépecer au couteau
    const dead = rabbits.pickDead(camera, x, y, p);
    if (dead) {
      if (!dead.near) return hint('Approche-toi du lapin.');
      const r = dead.rabbit, gy = controls.groundAt(r.x, r.z) + 0.1;
      const lance = spears.inRabbit(r.id);
      if (lance) {
        if (!inventory.canAdd('lance')) return hint('Inventaire plein.');
        hands.pickup({ x: r.x, y: gy + 0.3, z: r.z }, 'lance', () => { spears.take(lance); inventory.add('lance'); getAudio()?.pick('baton'); });
        return;
      }
      if (inventory.heldType() !== 'couteau') return hint('Prends le couteau artisanal en main pour dépecer le lapin.');
      const room = ['peau', 'viande'].every((t) => inventory.canAdd(t));
      if (!room) return hint('Il faut de la place pour la peau et la viande.');
      hands.skin({ x: r.x, y: gy, z: r.z }, () => {
        rabbits.remove(r);
        inventory.add('peau');
        inventory.add('viande'); inventory.add('viande');
        hint('1 peau de lapin et 2 viandes crues. La viande crue se garde 2 jours : fais-la cuire sur le feu.', 4500);
      });
      return;
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
        if (spot.loot && spot.type === 'carte') hint('Une vieille carte de la forêt. Touche-la dans l’inventaire pour l’ouvrir et y écrire.', 5000);
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
    // plantes : avec le couteau artisanal en main, on coupe feuilles et fibres
    const plant = plants.pickAt(camera, x, y, p);
    if (plant && inventory.heldType() === 'couteau') {
      if (!plant.near) return hint('Approche-toi de la plante.');
      const Y = YIELD[plant.plant.kind];
      if (!inventory.canAdd(Y.type)) return hint('Inventaire plein.');
      const P = plant.plant;
      getAudio()?.cutStart();
      // on coupe une fronde au bord de la plante, côté joueur (une fougère s'étale sur plus d'un mètre)
      const dx = p.x - P.x, dz = p.z - P.z, dl = Math.hypot(dx, dz) || 1, off = P.kind === 'fougere' ? 0.6 * P.s : 0;
      const tx = P.x + (dx / dl) * off, tz = P.z + (dz / dl) * off;
      hands.cut({ x: tx, y: controls.groundAt(tx, tz) + 0.05, z: tz }, Y.type, () => {
        plants.cut(P);
        for (let i = 0; i < Y.n; i++) inventory.add(Y.type);
        getAudio()?.cut();
      });
      return;
    }
    if (plant && plant.near && P_HINT()) return hint(`Prends le couteau artisanal en main pour couper ${plants.name(plant.plant)}.`);
    // l'eau du ruisseau n'est pas potable
    if (inventory.heldType() === 'bouteille') {
      const g = groundUnder(x, y);
      if (g && forest.streamDist(g.x, g.z) < 1.8) return hint('L’eau du ruisseau n’est pas potable.');
    }
    if (far) hint(`Approche-toi pour ramasser ${theItem(far.type)}.`);
  }

  // ------------------------------------------------------------------ chaque image : boutons et indice selon la situation
  let timer = 0, wasBusy = false, spoilTimer = 2;
  function update(dt) {
    // les boutons de l'inventaire redeviennent actifs à la fin du geste
    if (hands.busy !== wasBusy) { wasBusy = hands.busy; inventory.render(); timer = 0; }
    timer -= dt;
    if (timer > 0) return;
    timer = 0.2;
    const now = performance.now();
    const pm = placingMod();
    // la viande se gâte (vérifié de temps en temps)
    spoilTimer -= 0.2;
    if (spoilTimer <= 0) { spoilTimer = 10; const lost = inventory.spoil(); if (lost.length) hint(lost.includes('viande') ? 'Ta viande crue a pourri : tu as dû la jeter.' : 'Ta viande cuite s’est gâtée : tu as dû la jeter.', 4500); }
    combat.classList.toggle('on', inventory.heldType() === 'lance' && st.enabled && !sleep.busy && !pm && !(hands.busy && !combat.classList.contains('on')));
    $('aim').classList.toggle('on', combat.classList.contains('on'));
    if (sleep.busy) { setActions('', []); pill.classList.remove('on'); return; }
    // tissage : avancement et bouton pour s'arrêter
    if (looms.weaving) {
      setActions('tisser', [{ label: 'Arrêter', fn: () => looms.stop() }]);
      const pr = looms.progress();
      if (pr && now >= hintUntil) { const m = Math.floor(pr.ms / 60e3), s = Math.floor((pr.ms % 60e3) / 1000); pill.textContent = `Tissage : ${m} min ${String(s).padStart(2, '0')} / ${Math.round(pr.total / 60e3)} min`; pill.classList.add('on'); }
      return;
    }
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
      else if (!hands.busy && st.enabled && held && (held.type === 'baies' || held.type === 'viande-cuite')) setActions('manger', [{ label: 'Manger', main: true, fn: eat }]);
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
