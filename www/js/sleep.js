// Dormir : on s'allonge dans l'abri (la caméra se couche doucement sous le toit,
// les yeux vers l'ouverture), l'écran s'assombrit ; on peut fermer l'appli, on
// dort jusqu'au retour. « Se lever » ramène debout devant l'abri. À bout de
// forces, on s'endort là où l'on est, à même le sol.
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (k) => k * k * (3 - 2 * k);
const angLerp = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

export function createSleep({ controls, needs, shelters, forest, hint, getAudio, onChange }) {
  const st = controls.state;
  const $ = (id) => document.getElementById(id);
  const box = $('sleep'), title = $('sleep-title'), level = $('sleep-level'), note = $('sleep-note'), btn = $('btn-wake');
  let anim = null; // { t, dur, from, to, done }
  let shown = false;

  const camNow = () => ({ x: st.pos.x, y: st.pos.y, z: st.pos.z, yaw: st.yaw, pitch: st.pitch, roll: 0 });
  function animate(from, to, dur, done) { anim = { t: 0, dur, from, to, done }; st.lie = { ...from }; }

  function showOverlay(on, text) {
    shown = on;
    if (text) title.textContent = text;
    box.hidden = false;
    requestAnimationFrame(() => box.classList.toggle('on', on));
    if (!on) setTimeout(() => { if (!shown) box.hidden = true; }, 2600);
    for (const id of ['hud']) $(id).hidden = on;
    getAudio()?.setSleep?.(on);
  }
  function refresh() {
    if (!shown) return;
    const a = needs.asleep;
    level.textContent = `Sommeil : ${Math.round(needs.sleepLevel * 100)} %`;
    const tooEarly = a && !a.shelter && needs.sleepLevel < 0.3;
    btn.disabled = tooEarly;
    note.textContent = tooEarly ? 'Trop épuisée pour te relever pour l’instant (30 % minimum).' : 'Tu peux fermer l’appli : tu dormiras jusqu’à ton retour.';
  }

  // la pose couchée (repère du monde)
  function lyingPose(a) {
    if (a.shelter) return { x: a.x, y: a.y + 0.02, z: a.z, yaw: a.yaw + Math.PI, pitch: 0.1, roll: 0.32 };
    const g = forest.groundAt(a.x, a.z);
    return { x: a.x, y: g + 0.26, z: a.z, yaw: a.yaw, pitch: -0.18, roll: 1.15 };
  }

  // s'allonger dans l'abri
  function start(site) {
    if (needs.asleep || anim) return;
    if (needs.sleepLevel > 0.9) return hint('Tu n’as pas sommeil pour le moment.');
    const b = shelters.bed(site);
    const a = { x: b.x, y: b.y, z: b.z, yaw: b.yaw, out: b.out };
    st.enabled = false;
    st.frozen = true;
    // on s'accroupit devant l'ouverture, puis on se glisse dessous
    const front = { x: b.out.x, y: forest.groundAt(b.out.x, b.out.z) + 0.9, z: b.out.z, yaw: b.yaw + Math.PI, pitch: -0.45, roll: 0 };
    animate(camNow(), front, 0.9, () => {
      animate(front, lyingPose({ ...a, shelter: true }), 1.6, () => {
        needs.sleep(a);
        showOverlay(true, 'Tu dors dans l’abri.');
        refresh();
        onChange?.();
      });
    });
  }
  // épuisement : on s'écroule sur place
  function collapse() {
    const a = needs.asleep;
    if (!a) return;
    Object.assign(a, { x: st.pos.x, z: st.pos.z, yaw: st.yaw });
    st.enabled = false;
    st.frozen = true;
    animate(camNow(), lyingPose(a), 2.2, () => {
      showOverlay(true, 'Tu t’es endormie d’épuisement, à même le sol.');
      refresh();
      onChange?.();
    });
  }
  // au lancement : déjà endormie (dans l'abri, ou effondrée appli fermée)
  function restore(player) {
    const a = needs.asleep;
    if (!a) return false;
    if (a.x === undefined) Object.assign(a, { x: player.x, z: player.z, yaw: player.yaw });
    st.frozen = true;
    st.lie = lyingPose(a);
    return true;
  }
  function onEnter() {
    if (!needs.asleep) return;
    st.enabled = false;
    showOverlay(true, needs.asleep.shelter ? 'Tu dors dans l’abri.' : 'Tu t’es endormie d’épuisement, à même le sol.');
    refresh();
  }
  // se lever
  btn.addEventListener('click', () => {
    if (anim) return;
    const a = needs.asleep;
    if (!a) return;
    if (needs.wake() !== 'ok') return refresh();
    showOverlay(false);
    const out = a.shelter && a.out ? a.out : { x: a.x, z: a.z };
    const gy = forest.groundAt(out.x, out.z);
    const standYaw = a.shelter ? a.yaw + Math.PI : a.yaw; // en sortant de l'abri, on regarde devant soi
    const to = { x: out.x, y: gy + 1.6, z: out.z, yaw: standYaw, pitch: -0.1, roll: 0 };
    animate({ ...st.lie }, to, 1.8, () => {
      st.lie = null;
      st.pos.set(out.x, gy + 1.6, out.z);
      st.groundY = undefined;
      st.yaw = to.yaw; st.pitch = to.pitch;
      st.frozen = false;
      st.enabled = true;
      onChange?.();
    });
  });

  let timer = 0;
  function update(dt) {
    if (anim) {
      anim.t += dt;
      const k = ease(Math.min(1, anim.t / anim.dur)), f = anim.from, t = anim.to;
      Object.assign(st.lie, { x: lerp(f.x, t.x, k), y: lerp(f.y, t.y, k), z: lerp(f.z, t.z, k), yaw: angLerp(f.yaw, t.yaw, k), pitch: lerp(f.pitch, t.pitch, k), roll: lerp(f.roll || 0, t.roll || 0, k) });
      if (anim.t >= anim.dur) { const d = anim.done; anim = null; d?.(); }
    }
    timer -= dt;
    if (timer <= 0) { timer = 1; refresh(); }
    // la fatigue ralentit
    st.speedMul = (needs.sleepLevel < 0.25 ? 0.6 : 1) * (st.carryMul || 1);
  }
  return { start, collapse, restore, onEnter, update, get busy() { return !!anim || !!needs.asleep; } };
}
