// Pluie tombée à Annecy, heure par heure (Open-Meteo, sans clé), y compris
// pendant que l'appli était fermée (jusqu'à 92 jours en arrière). Sert au
// récupérateur d'eau : 1 mm de pluie sur la bâche (~1 m²) = 1 L.
// Avec ?meteo=pluie (ou averse, orage, neige) : pluie simulée, forte, pour tester.
import { ANNECY } from './weather.js';

const H = 36e5;
const FORCED_MM_H = { pluie: 60, averse: 120, orage: 120, neige: 30 };

export function createRain() {
  const forced = new URLSearchParams(location.search).get('meteo');
  const isForced = !!forced && forced in { clair: 1, nuageux: 1, couvert: 1, brouillard: 1, pluie: 1, averse: 1, neige: 1, orage: 1 };
  let hours = null; // [{ t: fin de l'heure (ms), mm }]
  let from = Infinity, loading = false, wantFrom = Date.now();

  async function load() {
    if (isForced || loading) return;
    loading = true;
    try {
      const days = Math.min(92, Math.max(1, Math.ceil((Date.now() - wantFrom) / 864e5) + 1));
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${ANNECY.lat}&longitude=${ANNECY.lng}&hourly=precipitation&past_days=${days}&forecast_days=1&timezone=GMT`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      hours = j.hourly.time.map((t, i) => ({ t: Date.parse(t + ':00Z'), mm: j.hourly.precipitation[i] || 0 }));
      from = hours.length ? hours[0].t - H : Infinity;
    } catch (e) {
      // hors ligne : on réessaiera plus tard
    }
    loading = false;
  }
  load();
  setInterval(load, 30 * 60e3);

  // millimètres tombés entre t0 et t1 (null si on ne sait pas encore)
  function mmBetween(t0, t1) {
    if (t1 <= t0) return 0;
    if (isForced) return ((FORCED_MM_H[forced] || 0) * (t1 - t0)) / H;
    if (!hours) return null;
    if (t0 < from - 1) { wantFrom = Math.min(wantFrom, t0); if (from > Date.now() - 91 * 864e5) load(); t0 = Math.max(t0, from); }
    const last = hours[hours.length - 1].t;
    if (t1 > last) t1 = last; // au-delà, on attend la prochaine mise à jour
    if (t1 <= t0) return 0;
    let mm = 0;
    for (const h of hours) {
      const a = Math.max(t0, h.t - H), b = Math.min(t1, h.t);
      if (b > a) mm += (h.mm * (b - a)) / H;
    }
    return mm;
  }
  // il pleut maintenant ? (mm/h de l'heure en cours)
  function rateNow() {
    if (isForced) return FORCED_MM_H[forced] || 0;
    if (!hours) return 0;
    const t = Date.now(), h = hours.find((x) => x.t > t);
    return h ? h.mm : 0;
  }
  // l'heure couverte par les données (on n'avance pas au-delà)
  const coveredUntil = () => (isForced ? Date.now() : hours ? Math.min(Date.now(), hours[hours.length - 1].t) : null);
  return { mmBetween, rateNow, coveredUntil, get ready() { return isForced || !!hours; }, need(t) { if (t < from) { wantFrom = Math.min(wantFrom, t); load(); } } };
}
