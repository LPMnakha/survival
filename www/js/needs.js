// Soif et faim, en temps réel (elles baissent même appli fermée) :
// 3 jours sans boire, 14 jours sans manger pour mourir. Il faut 1 L d'eau par
// jour : la jauge pleine vaut 3 L, une gorgée de 25 cl remonte d'environ 8 %.
// Une poignée de baies remonte la faim de 3 %. La mort est définitive.
// Sommeil : la jauge se vide en 2 jours éveillé ; 8 h dans l'abri la remplissent.
// À zéro, on s'endort là où l'on est (deux fois moins réparateur). Sous 25 %, on avance moins vite.
const DAY = 864e5, HOUR = 36e5;
export const NEEDS = { thirstDays: 3, hungerDays: 14, sip: 0.25 / 3, berry: 0.03, awakeDays: 2, sleepHours: 8, wakeMin: 0.3 };

export function createNeeds({ saved, onDeath }) {
  const now = Date.now();
  const st = {
    start: saved && saved.start ? saved.start : now,
    t: saved && saved.t ? saved.t : now,
    thirst: saved && Number.isFinite(saved.thirst) ? saved.thirst : 1,
    hunger: saved && Number.isFinite(saved.hunger) ? saved.hunger : 1,
    dead: saved && saved.dead ? saved.dead : null, // { at, cause }
    sleep: saved && Number.isFinite(saved.sleep) ? saved.sleep : 1,
    asleep: saved && saved.asleep ? saved.asleep : null, // { at, shelter, x, y, z, yaw, out }
  };
  let onCollapse = null;
  const $ = (id) => document.getElementById(id);
  const ui = { box: $('needs'), soif: $('need-soif'), faim: $('need-faim'), sommeil: $('need-sommeil') };
  const bars = { soif: ui.soif.querySelector('.bar'), faim: ui.faim.querySelector('.bar'), sommeil: ui.sommeil.querySelector('.bar') };

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
    // sommeil
    if (st.asleep) st.sleep = Math.min(1, st.sleep + dt / (NEEDS.sleepHours * HOUR * (st.asleep.shelter ? 1 : 2)));
    else {
      const sl = st.sleep - dt / (NEEDS.awakeDays * DAY);
      if (sl <= 0) {
        // épuisement : on s'endort là où l'on est, à l'instant où la jauge est arrivée à zéro
        const tZero = t - dt + st.sleep * NEEDS.awakeDays * DAY;
        st.sleep = Math.min(1, (t - tZero) / (NEEDS.sleepHours * HOUR * 2));
        st.asleep = { at: Math.round(tZero), shelter: false };
        onCollapse?.(st.asleep);
      } else st.sleep = sl;
    }
  }
  tick(now);

  let shown = { soif: -1, faim: -1 };
  function render() {
    for (const [k, v] of [['soif', st.thirst], ['faim', st.hunger], ['sommeil', st.sleep]]) {
      const pct = Math.round(v * 100);
      if (pct === shown[k]) continue;
      shown[k] = pct;
      bars[k].style.strokeDashoffset = (94.25 * (1 - v)).toFixed(2);
      ui[k].classList.toggle('low', v < 0.25);
      const name = { soif: 'Soif', faim: 'Faim', sommeil: 'Sommeil' }[k];
      ui[k].setAttribute('aria-label', `${name} : ${pct} %`);
      ui[k].title = `${name} : ${pct} %`;
    }
  }
  render();

  // messages doux quand une jauge passe sous 25 % puis sous 10 %
  const warned = { soif: st.thirst < 0.25 ? 1 : 0, faim: st.hunger < 0.25 ? 1 : 0, sommeil: st.sleep < 0.25 ? 1 : 0 };
  let timer = 0;
  function update(dt, hint) {
    timer -= dt;
    if (timer > 0) return;
    timer = 1;
    tick();
    render();
    const list = [['soif', st.thirst, 'Tu commences à avoir soif.', 'Tu as très soif : il faut boire.'], ['faim', st.hunger, 'Tu commences à avoir faim.', 'Tu as très faim : il faut manger.']];
    if (!st.asleep) list.push(['sommeil', st.sleep, 'La fatigue te ralentit : il faut dormir dans un abri.', 'Tu tombes de sommeil : trouve vite un abri.']);
    for (const [k, v, m1, m2] of list) {
      if (v < 0.1 && warned[k] < 2) { warned[k] = 2; hint?.(m2, 5000); }
      else if (v < 0.25 && warned[k] < 1) { warned[k] = 1; hint?.(m1, 5000); }
      if (v >= 0.3) warned[k] = 0;
    }
  }
  function drink(fraction) { tick(); st.thirst = Math.min(1, st.thirst + fraction); render(); }
  function eat(fraction) { tick(); st.hunger = Math.min(1, st.hunger + fraction); render(); }
  function sleep(info) { tick(); st.asleep = { at: Date.now(), shelter: true, ...info }; render(); }
  // se lever : possible à partir de 30 % si l'on s'est effondré d'épuisement
  function wake() {
    tick();
    if (!st.asleep) return 'ok';
    if (!st.asleep.shelter && st.sleep < NEEDS.wakeMin) return 'trop-tot';
    st.asleep = null;
    warned.sommeil = st.sleep < 0.25 ? 1 : 0;
    render();
    return 'ok';
  }

  return {
    update, drink, eat, tick, render, sleep, wake,
    setCollapse(fn) { onCollapse = fn; },
    get asleep() { return st.asleep; },
    get sleepLevel() { return st.sleep; },
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
