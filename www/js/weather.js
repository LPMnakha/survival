// Saisons (date à Paris) et météo en direct à Annecy (Open-Meteo, sans clé).
export const ANNECY = { lat: 45.8992, lng: 6.1294 };

const params = new URLSearchParams(location.search);

// ---------------- saisons ----------------
// Retourne { name, autumnBare } ; name ∈ printemps | ete | automne | hiver
export function seasonOf(date = new Date()) {
  const forced = params.get('saison');
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const m = +parts.find((p) => p.type === 'month').value, d = +parts.find((p) => p.type === 'day').value;
  const md = m * 100 + d;
  let name;
  if (md >= 320 && md < 621) name = 'printemps';
  else if (md >= 621 && md < 922) name = 'ete';
  else if (md >= 922 && md < 1221) name = 'automne';
  else name = 'hiver';
  if (forced && ['printemps', 'ete', 'automne', 'hiver'].includes(forced.replace('é', 'e'))) name = forced.replace('é', 'e');
  // en automne, les arbres se dénudent peu à peu (fin octobre -> début décembre)
  const dayOfYear = Math.floor((Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 864e5);
  const bare = name === 'automne' ? Math.min(1, Math.max(0, (dayOfYear - 293) / 45)) : 0;
  return { name, autumnBare: forced ? 0.3 : bare };
}

// ---------------- météo ----------------
// État normalisé : cloud, rain, snow, fog, wind (0..1), temp (°C), snowDepth (m), label
const PRESETS = {
  clair: { code: 0, cloud: 0.05, rain: 0, snow: 0, fog: 0, wind: 0.15 },
  nuageux: { code: 2, cloud: 0.5, rain: 0, snow: 0, fog: 0, wind: 0.25 },
  couvert: { code: 3, cloud: 0.95, rain: 0, snow: 0, fog: 0, wind: 0.3 },
  brouillard: { code: 45, cloud: 0.8, rain: 0, snow: 0, fog: 1, wind: 0.05 },
  pluie: { code: 63, cloud: 1, rain: 0.6, snow: 0, fog: 0.15, wind: 0.4 },
  averse: { code: 81, cloud: 0.85, rain: 0.9, snow: 0, fog: 0.1, wind: 0.5 },
  neige: { code: 73, cloud: 1, rain: 0, snow: 0.7, fog: 0.2, wind: 0.2, snowDepth: 0.2 },
  orage: { code: 95, cloud: 1, rain: 1, snow: 0, fog: 0.1, wind: 0.8 },
};

function labelOf(code) {
  if (code === 0) return 'ciel dégagé';
  if (code <= 2) return 'quelques nuages';
  if (code === 3) return 'ciel couvert';
  if (code === 45 || code === 48) return 'brouillard';
  if (code >= 51 && code <= 57) return 'bruine';
  if (code >= 61 && code <= 67) return code >= 65 ? 'forte pluie' : 'pluie';
  if (code >= 71 && code <= 77) return 'neige';
  if (code >= 80 && code <= 82) return 'averses';
  if (code === 85 || code === 86) return 'averses de neige';
  if (code >= 95) return 'orage';
  return '';
}

function interpret(c) {
  const code = c.weather_code ?? 0;
  const s = { code, cloud: (c.cloud_cover ?? 30) / 100, rain: 0, snow: 0, fog: 0, wind: Math.min(1, (c.wind_speed_10m ?? 8) / 45), temp: c.temperature_2m, snowDepth: c.snow_depth ?? 0 };
  if (code === 45 || code === 48) { s.fog = 1; s.cloud = Math.max(s.cloud, 0.7); }
  if (code >= 51 && code <= 57) s.rain = 0.25;
  if (code === 61 || code === 80) s.rain = 0.45;
  if (code === 63 || code === 81 || code === 66) s.rain = 0.7;
  if (code === 65 || code === 82 || code === 67) s.rain = 1;
  if (code === 71 || code === 85 || code === 77) s.snow = 0.4;
  if (code === 73) s.snow = 0.7;
  if (code === 75 || code === 86) s.snow = 1;
  if (code >= 95) { s.rain = 1; s.wind = Math.max(s.wind, 0.6); }
  // si la station signale de la pluie/neige sans code explicite
  if (!s.rain && !s.snow && (c.precipitation ?? 0) > 0.1) {
    if ((c.snowfall ?? 0) > 0) s.snow = 0.5; else s.rain = 0.4;
  }
  if (s.rain || s.snow) s.cloud = Math.max(s.cloud, 0.85);
  s.label = labelOf(code);
  return s;
}

export function createWeather(onUpdate) {
  const forced = params.get('meteo');
  const target = { ...PRESETS.nuageux, temp: null, snowDepth: 0, label: '' };
  const cur = { ...target };
  let live = false;

  async function refresh() {
    if (forced && PRESETS[forced]) {
      Object.assign(target, { snowDepth: 0, temp: null }, PRESETS[forced], { label: forced });
      onUpdate?.(target, true);
      return;
    }
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${ANNECY.lat}&longitude=${ANNECY.lng}` +
        '&current=temperature_2m,weather_code,cloud_cover,precipitation,rain,snowfall,wind_speed_10m,snow_depth&timezone=Europe%2FParis';
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      Object.assign(target, interpret(j.current));
      live = true;
      onUpdate?.(target, false);
    } catch (e) {
      // hors ligne : on garde un temps doux par défaut
    }
  }
  refresh();
  if (!forced) setInterval(refresh, 15 * 60 * 1000);

  // à la première mesure, on se cale directement ; ensuite transitions lentes
  let first = true;
  function update(dt) {
    if (first && (live || forced)) { Object.assign(cur, target); first = false; return cur; }
    const k = 1 - Math.exp(-dt / 25);
    for (const key of ['cloud', 'rain', 'snow', 'fog', 'wind', 'snowDepth']) cur[key] += ((target[key] ?? 0) - cur[key]) * k;
    cur.temp = target.temp; cur.label = target.label; cur.code = target.code;
    return cur;
  }
  return { update, target, get live() { return live; } };
}
