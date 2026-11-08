// Sons de la forêt, entièrement synthétisés (aucun fichier son) : pas selon le
// sol, vent dans les arbres, oiseaux légers le jour, pluie, murmure du ruisseau,
// feu de camp, gestes (ramasser, poser, pierre à feu).
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

  // ---------- feu de camp : souffle et petits craquements (repris de la cheminée de Détente)
  const fireBus = ctx.createGain(); fireBus.gain.value = 0;
  fireBus.connect(master);
  const roarLp = ctx.createBiquadFilter(); roarLp.type = 'lowpass'; roarLp.frequency.value = 420;
  const roarGain = ctx.createGain(); roarGain.gain.value = 0.35;
  loop(1, 0.2).connect(roarLp).connect(roarGain).connect(fireBus);
  const roarLfo = ctx.createOscillator(); roarLfo.frequency.value = 0.13;
  const roarLfoG = ctx.createGain(); roarLfoG.gain.value = 0.12;
  roarLfo.connect(roarLfoG).connect(roarGain.gain); roarLfo.start();
  const pop = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
  const pd = pop.getChannelData(0);
  for (let i = 0; i < pd.length; i++) pd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.004));
  function crackle(t, strength, bus = fireBus) {
    const s = ctx.createBufferSource();
    s.buffer = pop;
    s.playbackRate.value = 0.6 + Math.random() * 1.2;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1200 + Math.random() * 3200; f.Q.value = 0.8 + Math.random() * 2;
    const g = ctx.createGain();
    g.gain.value = strength * (0.15 + Math.random() * 0.5);
    s.connect(f).connect(g).connect(bus);
    s.start(t);
  }
  let fireLevel = 0, nextCrackle = 0;
  const fireTimer = setInterval(() => {
    const now = ctx.currentTime;
    if (fireLevel < 0.01) { nextCrackle = now + 0.1; return; }
    if (nextCrackle < now) nextCrackle = now + 0.05;
    while (nextCrackle < now + 0.4) {
      if (Math.random() < 0.12) { const n = 2 + Math.floor(Math.random() * 5); for (let i = 0; i < n; i++) crackle(nextCrackle + i * (0.015 + Math.random() * 0.05), 0.6); }
      else crackle(nextCrackle, 0.45 + Math.random() * 0.4);
      nextCrackle += 0.06 + Math.random() * Math.random() * 0.6;
    }
  }, 120);

  // ---------- gestes : ramasser, poser, gratter la pierre à feu, le feu qui prend
  function knock(t, f0, f1, dur, vol) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function handle(type, t) {
    if (type === 'caillou') { knock(t, 1400, 900, 0.05, 0.05); burst(t, 0.04, 'bandpass', 2600, 2, 0.04); knock(t + 0.07, 1250, 850, 0.04, 0.03); }
    else if (type === 'brindille') { for (let i = 0; i < 4; i++) burst(t + i * 0.02 + Math.random() * 0.01, 0.04, 'bandpass', 3200 + Math.random() * 2000, 1.4, 0.035); }
    else if (type === 'baton') { knock(t, 230, 150, 0.12, 0.08); burst(t, 0.08, 'bandpass', 700, 3, 0.05); }
    else if (type === 'bache') { for (let i = 0; i < 6; i++) burst(t + i * 0.03 + Math.random() * 0.02, 0.06, 'highpass', 2500 + Math.random() * 2500, 0.8, 0.03); }
    else if (type === 'bouteille') { knock(t, 520, 380, 0.07, 0.04); burst(t + 0.01, 0.05, 'bandpass', 1800, 2, 0.03); }
    else if (type === 'sacoche') { burst(t, 0.18, 'bandpass', 900, 0.8, 0.05); burst(t + 0.08, 0.1, 'lowpass', 500, 0.7, 0.04); }
    else if (type === 'baies') { for (let i = 0; i < 5; i++) burst(t + i * 0.035, 0.08, 'bandpass', 2000 + Math.random() * 1500, 0.9, 0.035); }
    else burst(t, 0.12, 'lowpass', 800, 0.7, 0.04);
  }
  // eau versée dans la bouteille : glouglou qui monte
  function pourSound(t) {
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1400, t + 0.9);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 11;
    const lg = ctx.createGain(); lg.gain.value = 180;
    lfo.connect(lg).connect(f.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.08); g.gain.setValueAtTime(0.09, t + 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 2); s.stop(t + 1.05); lfo.start(t); lfo.stop(t + 1.05);
  }
  // gorgées : petits « glou » graves et doux
  function gulps(t) {
    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.28;
      knock(at, 210, 120, 0.12, 0.06);
      burst(at, 0.08, 'lowpass', 380, 0.8, 0.04);
    }
  }
  // taille du silex : un « tac » sec et clair, un peu différent à chaque coup
  function knap(t) {
    knock(t, 2400 + Math.random() * 600, 1500, 0.035, 0.07);
    burst(t, 0.04, 'bandpass', 3800 + Math.random() * 1500, 3, 0.06);
    burst(t + 0.01, 0.06, 'highpass', 5000, 0.8, 0.02);
  }
  // fibres qu'on tord, corde qu'on serre
  function twist(t) { for (let i = 0; i < 4; i++) burst(t + i * 0.06, 0.07, 'bandpass', 1600 + Math.random() * 900, 1.2, 0.025); }
  // un coup de couteau dans les tiges
  function slice(t) {
    for (let k = 0; k < 3; k++) {
      const at = t + 1.12 + k * 0.37;
      burst(at, 0.09, 'highpass', 3000, 0.8, 0.04);
      burst(at + 0.02, 0.05, 'bandpass', 1800, 2, 0.03);
    }
  }
  // souffle d'un geste rapide (estoc, lancer)
  function swish(t, f0, f1, dur, vol) {
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 2); s.stop(t + dur + 0.02);
  }
  // impacts, assourdis : dans un lapin, dans le bois, dans la terre
  function thud(kind, t) {
    if (kind === 'bois') { knock(t, 320, 180, 0.12, 0.09); burst(t, 0.06, 'bandpass', 1400, 2, 0.05); }
    else if (kind === 'sol') { knock(t, 110, 60, 0.14, 0.08); burst(t, 0.12, 'lowpass', 500, 0.7, 0.07); }
    else { knock(t, 150, 80, 0.1, 0.06); burst(t, 0.08, 'lowpass', 700, 0.8, 0.05); }
  }
  // grésillement de la viande sur la broche (bruit filtré, en continu)
  const sizzleHp = ctx.createBiquadFilter(); sizzleHp.type = 'highpass'; sizzleHp.frequency.value = 3200;
  const sizzleGain = ctx.createGain(); sizzleGain.gain.value = 0;
  loop(1.7, 0.6).connect(sizzleHp).connect(sizzleGain).connect(master);
  // croquer des baies
  function crunch(t) { for (let i = 0; i < 3; i++) { burst(t + i * 0.12, 0.05, 'bandpass', 1500 + Math.random() * 800, 1.5, 0.04); knock(t + i * 0.12, 300, 180, 0.05, 0.025); } }
  function scrape(t) {
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(3200, t); f.frequency.linearRampToValueAtTime(6200, t + 0.13);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 3); s.stop(t + 0.18);
    for (let i = 0; i < 4; i++) crackle(t + 0.03 + i * 0.025, 0.25, master);
  }
  function whoosh(t) {
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(250, t); f.frequency.linearRampToValueAtTime(900, t + 0.9);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 2); s.stop(t + 1.7);
  }

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

  let on = true, sleepK = 1;
  return {
    ctx, step,
    pick(type) { handle(type, ctx.currentTime + 0.01); },
    place(type) { handle(type, ctx.currentTime + 0.01); },
    strike() { scrape(ctx.currentTime + 0.005); },
    pour() { pourSound(ctx.currentTime); },
    drink() { gulps(ctx.currentTime + 0.05); },
    eat() { crunch(ctx.currentTime + 0.02); },
    tick(kind) { const t = ctx.currentTime + 0.005; if (kind === 'knap') knap(t); else if (kind === 'skin') { burst(t, 0.18, 'bandpass', 900, 1, 0.04); burst(t + 0.05, 0.12, 'highpass', 2500, 0.8, 0.02); } else twist(t); },
    thrust() { swish(ctx.currentTime + 0.13, 500, 1400, 0.22, 0.05); },
    whoosh() { swish(ctx.currentTime, 700, 260, 0.6, 0.06); },
    impact(kind) { thud(kind, ctx.currentTime + 0.005); },
    setSizzle(level) { sizzleGain.gain.setTargetAtTime(Math.min(0.06, level * 0.05), ctx.currentTime, 0.6); },
    cut() { /* le bruit des coups est joué pendant le geste */ },
    cutStart() { slice(ctx.currentTime); },
    crafted(type) { handle(type === 'couteau' ? 'caillou' : 'brindille', ctx.currentTime + 0.01); },
    // en dormant, la forêt s'éloigne doucement
    setSleep(asleep) { sleepK = asleep ? 0.35 : 1; master.gain.setTargetAtTime(on ? sleepK : 0, ctx.currentTime, 2); },
    ignite() { whoosh(ctx.currentTime + 0.05); },
    setFire(level) { fireLevel = level; fireBus.gain.setTargetAtTime(Math.min(1, level * 1.3), ctx.currentTime, 0.25); },
    async start() {
      if (ctx.state !== 'running') await ctx.resume();
      master.gain.setTargetAtTime(on ? sleepK : 0, ctx.currentTime, 1.2);
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
      master.gain.setTargetAtTime(on ? sleepK : 0, ctx.currentTime, 0.3);
      return on;
    },
    get on() { return on; },
    stop() { clearInterval(birdTimer); clearInterval(fireTimer); ctx.close(); },
  };
}
