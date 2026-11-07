// Sauvegarde sur l'appareil (inventaire, objets ramassés, feux de camp).
const KEY = 'survival.save.v1';

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s && typeof s === 'object' ? s : {};
  } catch (e) {
    return {};
  }
}

// chaque module fournit sa partie ; on écrit au plus une fois par seconde
export function createSaver(parts) {
  let timer = null;
  const write = () => {
    timer = null;
    const data = { t: Date.now() };
    for (const [k, fn] of Object.entries(parts)) data[k] = fn();
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* stockage indisponible */ }
  };
  const soon = () => { if (!timer) timer = setTimeout(write, 1000); };
  addEventListener('pagehide', write);
  document.addEventListener('visibilitychange', () => { if (document.hidden) write(); });
  return { soon, now: write };
}
