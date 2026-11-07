// Sons de la forêt, entièrement synthétisés (aucun fichier son) : pas selon le
// sol, vent dans les arbres, oiseaux légers le jour, pluie, murmure du ruisseau.
// Repris de Détente (bruit rose, pluie, vent, pas dehors), tout reste très doux.
export function createForestAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // bruit rose (plus doux que le bruit blanc)
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  const loop = (rate, offset) => {
    const s = ctx.createBufferSource();
    s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
    s.start(0, offset);
    return s;
  };

  // ---------- pluie sur les feuilles
  const rainHp = ctx.createBiquadFilter(); rainHp.type = 'highpass'; rainHp.frequency.value = 500;
  const rainLp = ctx.createBiquadFilter(); rainLp.type = 'lowpass'; rainLp.frequency.value = 6000;
  const rainGain = ctx.createGain(); rainGain.gain.value = 0;
  loop(1.3, 1.7).connect(rainHp).connect(rainLp).connect(rainGain).connect(master);

  // ---------- vent dans les arbres : souffle de feuillage, rafales lentes
  const leavesBp = ctx.createBiquadFilter(); leavesBp.type = 'bandpass'; leavesBp.frequency.value = 900; leavesBp.Q.value = 0.5;
  const leavesAm = ctx.createGain(); leavesAm.gain.value = 0.7;
  const gust = ctx.createOscillator(); gust.frequency.value = 0.06;
  const gustG = ctx.createGain(); gustG.gain.value = 0.3;
  gust.connect(gustG).connect(leavesAm.gain); gust.start();
  const gust2 = ctx.createOscillator(); gust2.frequency.value = 0.023;
  const gust2G = ctx.createGain(); gust2G.gain.value = 260;
  gust2.connect(gust2G).connect(leavesBp.frequency); gust2.start();
  const leavesGain = ctx.createGain(); leavesGain.gain.value = 0;
  loop(0.8, 0.9).connect(leavesBp).connect(leavesAm).connect(leavesGain).connect(master);
  // souffle grave, seulement quand il y a du vent
  const windBp = ctx.createBiquadFilter(); windBp.type = 'bandpass'; windBp.frequency.value = 380; windBp.Q.value = 0.7;
  const windLfo = ctx.createOscillator(); windLfo.frequency.value = 0.07;
  const windLfoGain = ctx.createGain(); windLfoGain.gain.value = 120;
  windLfo.connect(windLfoGain).connect(windBp.frequency); windLfo.start();
  const windGain = ctx.createGain(); windGain.gain.value = 0;
  loop(0.5, 2.9).connect(windBp).connect(windGain).connect(master);

  // ---------- murmure du ruisseau (selon la distance)
  const brookBp = ctx.createBiquadFilter(); brookBp.type = 'bandpass'; brookBp.frequency.value = 1300; brookBp.Q.value = 0.9;
  const brookLfo = ctx.createOscillator(); brookLfo.frequency.value = 0.9;
  const brookLfoG = ctx.createGain(); brookLfoG.gain.value = 260;
  brookLfo.connect(brookLfoG).connect(brookBp.frequency); brookLfo.start();
  const brookAm = ctx.createGain(); brookAm.gain.value = 0.6;
  const brookLfo2 = ctx.createOscillator(); brookLfo2.frequency.value = 2.3;
  const brookLfo2G = ctx.createGain(); brookLfo2G.gain.value = 0.25;
  brookLfo2.connect(brookLfo2G).connect(brookAm.gain); brookLfo2.start();
  const brookGain = ctx.createGain(); brookGain.gain.value = 0;
  loop(1.1, 3.3).connect(brookBp).connect(brookAm).connect(brookGain).connect(master);

  // ---------- oiseaux : petits chants lointains, rares et doux, seulement le jour
  const birdBus = ctx.createGain(); birdBus.gain.value = 0;
  birdBus.connect(master);
  function note(t, f0, f1, dur, vol, pan) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; o.connect(g).connect(p).connect(birdBus); } else o.connect(g).connect(birdBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function bird() {
    const t = ctx.currentTime + 0.05;
    const pan = Math.random() * 1.6 - 0.8, vol = 0.012 + Math.random() * 0.018;
    const kind = Math.floor(Math.random() * 3);
    if (kind === 0) {
      // « ti-tu » de mésange
      const f = 3600 + Math.random() * 900;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) { note(t + i * 0.32, f, f * 0.98, 0.09, vol, pan); note(t + i * 0.32 + 0.12, f * 0.78, f * 0.76, 0.1, vol * 0.9, pan); }
    } else if (kind === 1) {
      // petit trille descendant
      const f = 4200 + Math.random() * 1200;
      const n = 6 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) note(t + i * 0.07, f * (1 - i * 0.025), f * (1 - i * 0.025) * 0.9, 0.05, vol * 0.8, pan);
    } else {
      // sifflement flûté (merle au loin)
      const f = 1900 + Math.random() * 700;
      note(t, f, f * 1.25, 0.18, vol, pan);
      note(t + 0.22, f * 1.18, f * 0.9, 0.24, vol * 0.85, pan);
      if (Math.random() < 0.5) note(t + 0.52, f * 1.4, f * 1.3, 0.14, vol * 0.7, pan);
    }
  }
  let birdLevel = 0, nextBird = 0;
  const birdTimer = setInterval(() => {
    const now = ctx.currentTime;
    if (birdLevel < 0.05) { nextBird = now + 2; return; }
    if (now >= nextBird) {
      bird();
      nextBird = now + (3 + Math.random() * 7) / Math.max(0.3, birdLevel);
    }
  }, 250);

  // ---------- pas : herbe (froissement), terre (sourd), feuilles (craquant), neige (crissement)
  let stepN = 0;
  function burst(at, dur, type, freq, q, g) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const gg = ctx.createGain();
    gg.gain.setValueAtTime(0.0001, at);
    gg.gain.exponentialRampToValueAtTime(g, at + 0.012);
    gg.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f).connect(gg).connect(master);
    s.start(at, Math.random() * 3); s.stop(at + dur + 0.02);
  }
  function step(surface = 'terre') {
    const t = ctx.currentTime + 0.005;
    stepN++;
    const vol = (stepN % 2 ? 1 : 0.85) * (0.85 + Math.random() * 0.3);
    if (surface === 'herbe') { burst(t, 0.16, 'bandpass', 2600, 0.7, 0.07 * vol); burst(t + 0.03, 0.12, 'lowpass', 400, 0.7, 0.08 * vol); }
    else if (surface === 'neige') { for (let i = 0; i < 6; i++) burst(t + i * 0.022, 0.05, 'bandpass', 1100 + Math.random() * 600, 1.5, 0.08 * vol); }
    else if (surface === 'feuilles') {
      for (let i = 0; i < 5; i++) burst(t + i * 0.018 + Math.random() * 0.012, 0.05, 'bandpass', 3000 + Math.random() * 2500, 1.2, 0.05 * vol);
      burst(t + 0.02, 0.18, 'highpass', 1800, 0.7, 0.04 * vol);
      burst(t, 0.1, 'lowpass', 450, 0.7, 0.06 * vol);
    } else {
      // terre, aiguilles, mousse : un pas sourd et feutré
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.16);
      burst(t, 0.12, 'lowpass', 600, 0.7, 0.09 * vol);
      burst(t + 0.02, 0.06, 'bandpass', 1800, 1.0, 0.025 * vol);
    }
  }

  let on = true;
  return {
    ctx, step,
    async start() {
      if (ctx.state !== 'running') await ctx.resume();
      master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 1.2);
    },
    // ambiance : météo, jour, distance au ruisseau
    setAmbience({ rain = 0, wind = 0, snow = 0, day = 1, brook = 0, birds = 1 }) {
      const now = ctx.currentTime;
      rainGain.gain.setTargetAtTime(rain * 0.3, now, 2);
      leavesGain.gain.setTargetAtTime((0.025 + wind * 0.07) * (1 - snow * 0.5), now, 2);
      windGain.gain.setTargetAtTime(Math.max(0, wind - 0.25) * 0.08, now, 2);
      brookGain.gain.setTargetAtTime(brook * 0.16, now, 0.6);
      birdLevel = birds * Math.max(0, day - 0.4) / 0.6 * (1 - Math.min(1, rain * 1.5 + snow)) * (1 - wind * 0.5);
      birdBus.gain.setTargetAtTime(birdLevel > 0.05 ? 1 : 0, now, 3);
    },
    toggle() {
      on = !on;
      master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.3);
      return on;
    },
    get on() { return on; },
    stop() { clearInterval(birdTimer); ctx.close(); },
  };
}
