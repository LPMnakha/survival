// Soif et faim, en temps réel (elles baissent même appli fermée) :
// 3 jours sans boire, 14 jours sans manger pour mourir. Il faut 1 L d'eau par
// jour : la jauge pleine vaut 3 L, une gorgée de 25 cl remonte d'environ 8 %.
// Une poignée de baies remonte la faim de 3 %. La mort est définitive.
const DAY = 864e5;
export const NEEDS = { thirstDays: 3, hungerDays: 14, sip: 0.25 / 3, berry: 0.03 };

export function createNeeds({ saved, onDeath }) {
  const now = Date.now();
  const st = {
    start: saved && saved.start ? saved.start : now,
    t: saved && saved.t ? saved.t : now,
    thirst: saved && Number.isFinite(saved.thirst) ? saved.thirst : 1,
    hunger: saved && Number.isFinite(saved.hunger) ? saved.hunger : 1,
    dead: saved && saved.dead ? saved.dead : null, // { at, cause }
  };
  const $ = (id) => document.getElementById(id);
  const ui = { box: $('needs'), soif: $('need-soif'), faim: $('need-faim') };
  const bars = { soif: ui.soif.querySelector('.bar'), faim: ui.faim.querySelector('.bar') };

  // avance l'horloge jusqu'à maintenant ; détecte la mort (même survenue appli fermée)
  function tick(t = Date.now()) {
    if (st.dead) return;
    const dt = Math.max(0, t - st.t);
    st.t = t;
    const th = st.thirst - dt / (NEEDS.thirstDays * DAY);
    const hu = st.hunger - dt / (NEEDS.hungerDays * DAY);
    if (th <= 0 || hu <= 0) {
      // l'instant exact où la jauge est arrivée à zéro
      const tThirst = t - dt + st.thirst * NEEDS.thirstDays * DAY;
      const tHunger = t - dt + st.hunger * NEEDS.hungerDays * DAY;
      const thirstFirst = th <= 0 && (hu > 0 || tThirst <= tHunger);
      st.thirst = Math.max(0, th); st.hunger = Math.max(0, hu);
      st.dead = { at: Math.round(thirstFirst ? tThirst : tHunger), cause: thirstFirst ? 'soif' : 'faim' };
      onDeath?.(st.dead);
      return;
    }
    st.thirst = th; st.hunger = hu;
  }
  tick(now);

  let shown = { soif: -1, faim: -1 };
  function render() {
    for (const [k, v] of [['soif', st.thirst], ['faim', st.hunger]]) {
      const pct = Math.round(v * 100);
      if (pct === shown[k]) continue;
      shown[k] = pct;
      bars[k].style.strokeDashoffset = (94.25 * (1 - v)).toFixed(2);
      ui[k].classList.toggle('low', v < 0.25);
      ui[k].setAttribute('aria-label', `${k === 'soif' ? 'Soif' : 'Faim'} : ${pct} %`);
      ui[k].title = `${k === 'soif' ? 'Soif' : 'Faim'} : ${pct} %`;
    }
  }
  render();

  // messages doux quand une jauge passe sous 25 % puis sous 10 %
  const warned = { soif: st.thirst < 0.25 ? 1 : 0, faim: st.hunger < 0.25 ? 1 : 0 };
  let timer = 0;
  function update(dt, hint) {
    timer -= dt;
    if (timer > 0) return;
    timer = 1;
    tick();
    render();
    for (const [k, v, m1, m2] of [['soif', st.thirst, 'Tu commences à avoir soif.', 'Tu as très soif : il faut boire.'], ['faim', st.hunger, 'Tu commences à avoir faim.', 'Tu as très faim : il faut manger.']]) {
      if (v < 0.1 && warned[k] < 2) { warned[k] = 2; hint?.(m2, 5000); }
      else if (v < 0.25 && warned[k] < 1) { warned[k] = 1; hint?.(m1, 5000); }
      if (v >= 0.3) warned[k] = 0;
    }
  }
  function drink(fraction) { tick(); st.thirst = Math.min(1, st.thirst + fraction); render(); }
  function eat(fraction) { tick(); st.hunger = Math.min(1, st.hunger + fraction); render(); }

  return {
    update, drink, eat, tick, render,
    get thirst() { return st.thirst; },
    get hunger() { return st.hunger; },
    get dead() { return st.dead; },
    get start() { return st.start; },
    data: () => ({ ...st }),
  };
}

// « 3 jours et 4 heures »
export function fmtDuration(ms) {
  const h = Math.floor(ms / 36e5), d = Math.floor(h / 24), hh = h % 24, m = Math.floor((ms % 36e5) / 6e4);
  const parts = [];
  if (d) parts.push(`${d} jour${d > 1 ? 's' : ''}`);
  if (hh) parts.push(`${hh} heure${hh > 1 ? 's' : ''}`);
  if (!d && !hh) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
  return parts.join(' et ');
}
