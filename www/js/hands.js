// Les mains du joueur, vues à la première personne (dessinées par-dessus le
// décor). Elles tiennent l'objet en main et jouent les gestes : se baisser pour
// ramasser, poser un objet, frotter la pierre à feu. Pendant un geste, on ne
// peut ni bouger ni enchaîner un autre geste (pas de clics à répétition).
import * as THREE from '../vendor/three.module.min.js';
import { mergeColored } from './builder.js';
import { itemGeometry, matFor } from './models.js';

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (k) => k * k * (3 - 2 * k);
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const angLerp = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

const SKIN = 0xd9a982, SLEEVE = 0x55624a, CUFF = 0x434e3c;

// avant-bras (coude à l'origine, le long de +z) et main en poing (repère du poignet)
const WRIST = 0.335;
function forearmGeometry() {
  return mergeColored([
    [new THREE.CylinderGeometry(0.038, 0.045, 0.3, 7).rotateX(Math.PI / 2).translate(0, 0, 0.15), SLEEVE],
    [new THREE.CylinderGeometry(0.041, 0.041, 0.04, 7).rotateX(Math.PI / 2).translate(0, 0, 0.3), CUFF],
    [new THREE.CylinderGeometry(0.03, 0.034, 0.05, 6).rotateX(Math.PI / 2).translate(0, 0, 0.335), SKIN],
  ]);
}
function fistGeometry(s) { // s = 1 main droite (paume vers la gauche), -1 main gauche
  return mergeColored([
    [new THREE.BoxGeometry(0.03, 0.08, 0.08).translate(0.008 * s, 0, 0.06), SKIN], // paume
    [new THREE.BoxGeometry(0.036, 0.074, 0.032).translate(-0.016 * s, -0.002, 0.095), 0xd29f78], // doigts repliés
    [new THREE.BoxGeometry(0.02, 0.02, 0.05).rotateX(-0.35).translate(-0.006 * s, 0.045, 0.07), SKIN], // pouce
  ]);
}

export function createHands({ camera, controls }) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const amb = new THREE.AmbientLight(0xffffff, 0.5);
  const hemi = new THREE.HemisphereLight(0xdde8f0, 0x6a5a48, 0.6);
  const sunL = new THREE.DirectionalLight(0xfff1dc, 1);
  const fireL = new THREE.DirectionalLight(0xff9a50, 0);
  scene.add(amb, hemi, sunL, sunL.target, fireL, fireL.target);

  const skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const mkArm = (side) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(forearmGeometry(), skinMat));
    const wrist = new THREE.Group();
    wrist.position.set(0, 0, WRIST);
    wrist.add(new THREE.Mesh(fistGeometry(side), skinMat));
    g.add(wrist);
    const grip = new THREE.Object3D();
    grip.position.set(-0.016 * side, 0, 0.09);
    wrist.add(grip);
    const item = new THREE.Mesh(itemGeometry('caillou'), matFor('caillou'));
    grip.add(item);
    item.visible = false;
    g.visible = false;
    root.add(g);
    return { g, wrist, grip, item, type: null, pose: { p: new THREE.Vector3(), roll: 0, tilt: 0 } };
  };
  const R = mkArm(1), L = mkArm(-1);
  // épaules bas et sur les côtés : on ne voit que le bout de l'avant-bras, comme dans un jeu à la première personne
  const SHOULDER = { r: new THREE.Vector3(0.3, -0.62, 0.05), l: new THREE.Vector3(-0.3, -0.62, 0.05) };
  const POSE = {
    rest: new THREE.Vector3(0.16, -0.2, -0.4), // objet tenu, bas à droite
    away: new THREE.Vector3(0.3, -0.62, -0.18), // main baissée hors de vue
    pocket: new THREE.Vector3(0.26, -0.48, -0.16), // on range dans la poche
    prep: new THREE.Vector3(0.12, -0.24, -0.36),
    lAway: new THREE.Vector3(-0.32, -0.62, -0.18),
  };

  // comment l'objet est tenu dans le poing
  function setItem(arm, type) {
    arm.type = type;
    if (!type) { arm.item.visible = false; return; }
    arm.item.geometry = itemGeometry(type);
    arm.item.material = matFor(type);
    arm.item.visible = true;
    arm.item.position.set(0, 0, 0);
    arm.item.rotation.set(0, 0, 0);
    if (type === 'caillou') { arm.item.position.set(0, -0.012, 0.012); }
    else if (type === 'brindille') { arm.item.rotation.set(0, 0, Math.PI / 2 - 0.25); arm.item.position.set(0, 0.03, 0); }
    else if (type === 'baton') { arm.item.rotation.set(BATON.rx, BATON.ry, BATON.rz); arm.item.position.set(0, BATON.y, 0); }
    else if (type === 'pierre-a-feu') { arm.item.position.set(0, -0.035, 0); arm.item.rotation.set(-0.25, 0, 0); }
    else if (type === 'bouteille') { arm.item.position.set(0, -0.09, 0.005); arm.item.rotation.set(0, 0, 0); }
    else if (type === 'baies') { arm.item.position.set(0, 0.035, 0.01); arm.item.rotation.set(-0.3, 0, 0); }
    else if (type === 'bache' || type === 'sacoche') { arm.item.position.set(0, -0.02, 0.06); arm.item.rotation.set(Math.PI / 2 - 0.2, 0, 0); }
    else if (type === 'silex') { arm.item.position.set(0, -0.01, 0.012); }
    else if (type === 'feuille' || type === 'fibre') { arm.item.rotation.set(0, 0, Math.PI / 2 - 0.3); arm.item.position.set(0, 0.04, 0); }
    else if (type === 'corde') { arm.item.position.set(0, -0.02, 0.03); arm.item.rotation.set(Math.PI / 2, 0, 0); }
    else if (type === 'couteau') { arm.item.position.set(0, 0.0, 0.004); arm.item.rotation.set(-0.15, Math.PI / 2, 0); }
    else if (type === 'lance') { arm.item.visible = false; } // dessinée à part : voir spearMesh
    else if (type === 'viande' || type === 'viande-cuite') { arm.item.position.set(0, 0.02, 0.02); arm.item.rotation.set(0, Math.PI / 2, 0.4); }
    else if (type === 'peau') { arm.item.position.set(0, -0.03, 0.05); arm.item.rotation.set(Math.PI / 2 - 0.3, 0, 0.3); }
    else if (type === 'grattoir') { arm.item.position.set(0.004, 0.012, 0.008); arm.item.rotation.set(0, Math.PI / 2, 0.3); }
  }

  // place un bras : la main va au point voulu (repère caméra), l'avant-bras vient de l'épaule
  const zAxis = new THREE.Vector3(), xAxis = new THREE.Vector3(), yAxis = new THREE.Vector3(), upV = new THREE.Vector3(0, 1, 0), zUnit = new THREE.Vector3(0, 0, 1);
  const mBasis = new THREE.Matrix4(), qRoll = new THREE.Quaternion(), off = new THREE.Vector3();
  function placeArm(arm, shoulder) {
    const { p, roll, tilt } = arm.pose;
    zAxis.copy(p).sub(shoulder).normalize();
    xAxis.crossVectors(upV, zAxis).normalize();
    yAxis.crossVectors(zAxis, xAxis);
    mBasis.makeBasis(xAxis, yAxis, zAxis);
    arm.g.quaternion.setFromRotationMatrix(mBasis).multiply(qRoll.setFromAxisAngle(zUnit, roll));
    // le poignet se plie (tilt) ; c'est le poing, pas le coude, qui arrive au point demandé
    arm.wrist.rotation.x = tilt;
    off.copy(arm.grip.position).applyEuler(arm.wrist.rotation).add(arm.wrist.position).applyQuaternion(arm.g.quaternion);
    arm.g.position.copy(p).sub(off);
  }

  // ------------------------------------------------------------------ petites animations (coroutines pilotées par update)
  let tweens = [];
  const tween = (dur, fn) => new Promise((res) => tweens.push({ t: 0, dur, fn, res }));
  let busy = false;
  const st = controls.state;
  let heldType = null, shown = 0; // 0 = main baissée hors de vue, 1 = main levée avec l'objet
  R.pose.p.copy(POSE.away);
  L.pose.p.copy(POSE.lAway);

  const tmpW = new THREE.Vector3();
  const toLocal = (w) => { camera.updateMatrixWorld(); return camera.worldToLocal(tmpW.copy(w)); };
  // où la main peut aller vers un point (on ne tend pas le bras à l'infini)
  const reachTo = (target, max = 0.85) => {
    const l = toLocal(target);
    const len = l.length();
    return l.setLength(Math.min(Math.max(0.2, len - 0.03), max)).clone();
  };

  // un pas vers le point visé, on s'accroupit et on le regarde
  async function begin(target, { crouch = 0.8, approach = 0.5, dur = 0.55 } = {}) {
    busy = true;
    st.frozen = true;
    const y0 = st.yaw, p0 = st.pitch, c0 = st.crouch, x0 = st.pos.x, z0 = st.pos.z;
    const dx = target.x - x0, dz = target.z - z0, d = Math.hypot(dx, dz);
    const go = Math.max(0, d - approach) / Math.max(d, 1e-6);
    const x1 = x0 + dx * go, z1 = z0 + dz * go;
    const eyeY = controls.groundAt(x1, z1) + 1.6 - crouch;
    const yaw1 = Math.atan2(-dx, -dz), pitch1 = Math.max(-1.25, Math.atan2(target.y - eyeY, Math.max(0.05, Math.hypot(target.x - x1, target.z - z1))));
    const from = R.pose.p.clone();
    await tween(dur, (k) => {
      const e = ease(k);
      st.pos.x = lerp(x0, x1, e);
      st.pos.z = lerp(z0, z1, e);
      st.crouch = lerp(c0, crouch, e);
      st.yaw = angLerp(y0, yaw1, e);
      st.pitch = lerp(p0, pitch1, e);
      R.pose.p.lerpVectors(from, POSE.prep, e);
    });
    return { pitch0: p0 };
  }
  async function end(ctx, dur = 0.45) {
    const c0 = st.crouch, p1 = st.pitch;
    await tween(dur, (k) => {
      const e = ease(k);
      st.crouch = lerp(c0, 0, e);
      // en se relevant, on garde les yeux sur ce qu'on vient de faire
      st.pitch = lerp(p1, Math.max(-0.75, Math.min(-0.25, lerp(ctx.pitch0, p1, 0.6))), e);
    });
    st.frozen = false;
    busy = false;
  }
  const showArm = (type) => { setItem(R, type); R.g.visible = true; };

  // un pas, se baisser, ramasser l'objet au sol, le ranger
  async function pickup(target, type, onGrab) {
    showArm(null);
    R.pose.roll = 0; R.pose.tilt = 0;
    // on s'accroupit moins pour un objet posé en hauteur (étagère, table)
    const above = target.y - controls.groundAt(target.x, target.z);
    const ctx = await begin(target, { crouch: Math.max(0.05, Math.min(0.85, 0.85 - above * 0.75)), approach: 0.55 });
    const a = R.pose.p.clone(), b = reachTo(target);
    await tween(0.42, (k) => R.pose.p.lerpVectors(a, b, ease(k)));
    onGrab?.();
    setItem(R, type);
    await tween(0.18, () => {});
    const c = R.pose.p.clone();
    const endP = end(ctx, 0.55);
    await tween(0.5, (k) => R.pose.p.lerpVectors(c, POSE.pocket, ease(k)));
    await endP;
    restore();
  }

  // sortir l'objet, s'approcher, se baisser, le poser à sa place
  async function place(target, type, onRelease) {
    setItem(R, type);
    R.g.visible = true;
    R.pose.roll = 0; R.pose.tilt = 0;
    const ctx = await begin(target, { crouch: 0.82, approach: 0.9 });
    const a = R.pose.p.clone(), b = reachTo(target);
    await tween(0.45, (k) => R.pose.p.lerpVectors(a, b, ease(k)));
    onRelease?.();
    setItem(R, null);
    await tween(0.15, () => {});
    const c = R.pose.p.clone();
    const endP = end(ctx, 0.5);
    await tween(0.45, (k) => R.pose.p.lerpVectors(c, POSE.pocket, ease(k)));
    await endP;
    restore();
  }

  // remplir la bouteille : on s'approche, la main plonge la bouteille dans la poche d'eau, on attend qu'elle se remplisse
  async function fill(target, onTouch, onDip) {
    setItem(R, 'bouteille');
    R.g.visible = true;
    R.pose.roll = 0; R.pose.tilt = 0;
    const ctx = await begin(target, { crouch: 0.55, approach: 0.8 });
    const a = R.pose.p.clone(), b = reachTo(target);
    await tween(0.45, (k) => { const e = ease(k); R.pose.p.lerpVectors(a, b, e); R.pose.tilt = lerp(0, 1.25, e); });
    onDip?.();
    await tween(1.0, (k) => { R.pose.p.y = b.y + Math.sin(k * Math.PI * 3) * 0.006; });
    onTouch?.();
    const c = R.pose.p.clone();
    const endP = end(ctx, 0.5);
    await tween(0.45, (k) => { const e = ease(k); R.pose.p.lerpVectors(c, POSE.rest, e); R.pose.tilt = lerp(1.25, REST.tilt, e); });
    await endP;
    restore();
  }

  // boire ou manger, debout : la main porte la bouteille (ou les baies) à la bouche
  async function consume(type, onDone) {
    busy = true;
    st.frozen = true;
    setItem(R, type);
    R.g.visible = true;
    const drink = type === 'bouteille';
    const p0 = st.pitch, a = R.pose.p.clone(), t0 = R.pose.tilt, r0 = R.pose.roll;
    const mouth = drink ? CONSUME.drink : CONSUME.eat;
    await tween(0.55, (k) => {
      const e = ease(k);
      R.pose.p.lerpVectors(a, mouth.p, e);
      R.pose.tilt = lerp(t0, mouth.tilt, e);
      R.pose.roll = lerp(r0, mouth.roll, e);
      st.pitch = lerp(p0, Math.min(0.6, p0 + mouth.look), e);
    });
    if (!drink) setItem(R, null);
    await tween(drink ? 0.9 : 0.45, (k) => { if (!drink) R.pose.p.y = mouth.p.y - Math.sin(k * Math.PI * 2) * 0.008; });
    onDone?.();
    const c = R.pose.p.clone(), t1 = R.pose.tilt, r1 = R.pose.roll, p1 = st.pitch;
    await tween(0.5, (k) => {
      const e = ease(k);
      R.pose.p.lerpVectors(c, POSE.rest, e);
      R.pose.tilt = lerp(t1, REST.tilt, e);
      R.pose.roll = lerp(r1, REST.roll, e);
      st.pitch = lerp(p1, p0, e);
    });
    st.frozen = false;
    busy = false;
    restore();
  }

  // ------------------------------------------------------------------ éclats de silex et cordon (dans le repère des mains)
  const FLK = 40, flkPos = new Float32Array(FLK * 3), flkVel = new Float32Array(FLK * 3), flkLife = new Float32Array(FLK);
  const flkGeo = new THREE.BufferGeometry();
  flkGeo.setAttribute('position', new THREE.BufferAttribute(flkPos, 3));
  const flakes = new THREE.Points(flkGeo, new THREE.PointsMaterial({ color: 0x6e7078, size: 0.011, sizeAttenuation: true }));
  flakes.frustumCulled = false;
  root.add(flakes);
  let flkNext = 0;
  function chips(at, n = 6) {
    for (let k = 0; k < n; k++) {
      const i = flkNext++ % FLK;
      flkPos.set([at.x, at.y, at.z], i * 3);
      flkVel.set([(Math.random() - 0.3) * 0.5, 0.15 + Math.random() * 0.35, (Math.random() - 0.5) * 0.3], i * 3);
      flkLife[i] = 0.6 + Math.random() * 0.4;
    }
  }
  function updateFlakes(dt) {
    for (let i = 0; i < FLK; i++) {
      if (flkLife[i] <= 0) { flkPos[i * 3 + 1] = -99; continue; }
      flkLife[i] -= dt;
      flkVel[i * 3 + 1] -= 2.2 * dt;
      for (let k = 0; k < 3; k++) flkPos[i * 3 + k] += flkVel[i * 3 + k] * dt;
    }
    flkGeo.attributes.position.needsUpdate = true;
  }
  // un objet posé dans le champ de vision pendant une fabrication (la lance)
  const prop = new THREE.Mesh(itemGeometry('lance'), matFor('lance'));
  prop.visible = false;
  root.add(prop);
  // cordon entre les deux mains (pour tresser la corde)
  const strandMat = new THREE.MeshStandardMaterial({ color: 0xb3a272, roughness: 1, flatShading: true });
  const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 5, 6).translate(0, 0.5, 0), strandMat);
  strand.visible = false;
  root.add(strand);
  const gL = new THREE.Vector3(), gR = new THREE.Vector3(), upY = new THREE.Vector3(0, 1, 0);
  function updateStrand(twist) {
    if (!strand.visible) return;
    root.updateMatrixWorld(true);
    root.worldToLocal(L.grip.getWorldPosition(gL));
    root.worldToLocal(R.grip.getWorldPosition(gR));
    const d = gR.clone().sub(gL), len = d.length();
    strand.position.copy(gL);
    strand.quaternion.setFromUnitVectors(upY, d.normalize());
    strand.rotateY(twist);
    strand.scale.set(1, len, 1);
  }

  // regarder ses mains : on baisse les yeux, on ne bouge plus
  async function lookAtHands(pitch = -0.72) {
    busy = true;
    st.frozen = true;
    const p0 = st.pitch;
    await tween(0.45, (k) => { st.pitch = lerp(p0, pitch, ease(k)); });
    return p0;
  }
  async function lookUp(p0) {
    const p1 = st.pitch;
    await tween(0.45, (k) => { st.pitch = lerp(p1, Math.min(p0, -0.2), ease(k)); });
    st.frozen = false;
    busy = false;
  }
  const both = (fn) => { fn(R); fn(L); };
  const moveTo = (arm, to, dur, e = ease, tilt, roll) => {
    const a = arm.pose.p.clone(), t0 = arm.pose.tilt, r0 = arm.pose.roll;
    return tween(dur, (k) => { const x = e(k); arm.pose.p.lerpVectors(a, to, x); if (tilt !== undefined) arm.pose.tilt = lerp(t0, tilt, x); if (roll !== undefined) arm.pose.roll = lerp(r0, roll, x); });
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // couper une plante : la gauche saisit le haut, la droite tranche la base, la gauche se relève avec la récolte
  async function cut(target, harvest, onCut) {
    setItem(R, 'couteau');
    R.g.visible = true;
    R.pose.roll = 0; R.pose.tilt = 0;
    const ctx = await begin(target, { crouch: 0.72, approach: 0.85 });
    setItem(L, null);
    L.g.visible = true;
    L.pose.p.copy(POSE.lAway); L.pose.roll = 1.1; L.pose.tilt = 0.2;
    const top = reachTo(new THREE.Vector3(target.x, target.y + 0.28, target.z), 0.75);
    const base = reachTo(new THREE.Vector3(target.x, target.y + 0.05, target.z), 0.8);
    await Promise.all([moveTo(L, top, 0.45), moveTo(R, base.clone().add(V(0.09, 0.02, 0.02)), 0.45, ease, 0.6, -1.3)]);
    for (let i = 0; i < 3; i++) {
      // un coup vif de droite à gauche, la plante tremble
      await moveTo(R, base.clone().add(V(-0.07, 0, 0)), 0.15, easeOut);
      L.pose.p.y -= 0.006;
      await moveTo(R, base.clone().add(V(0.09, 0.02, 0.02)), 0.22);
    }
    onCut?.();
    setItem(L, harvest);
    const endP = end(ctx, 0.55);
    await Promise.all([moveTo(L, V(-0.12, -0.15, -0.36), 0.4), moveTo(R, POSE.rest, 0.45, ease, REST.tilt, REST.roll)]);
    await tween(0.25, () => {});
    await moveTo(L, POSE.lAway, 0.4);
    L.g.visible = false;
    setItem(L, null);
    await endP;
    restore();
  }

  // fabriquer un outil dans les mains
  async function craft(kind, onDone) {
    const p0 = await lookAtHands(kind === 'lance' ? -0.55 : -0.72);
    both((a) => { a.g.visible = true; a.pose.roll = 0; a.pose.tilt = 0; });
    if (kind === 'couteau') {
      // taille du silex : la gauche tient le rognon, la droite frappe le bord avec l'autre silex
      setItem(L, 'silex'); setItem(R, 'silex');
      L.pose.p.copy(POSE.lAway); R.pose.p.copy(POSE.away);
      const core = V(-0.035, -0.095, -0.34);
      await Promise.all([moveTo(L, core, 0.5, ease, 0.4, 1.4), moveTo(R, V(0.09, -0.01, -0.31), 0.5, ease, 0.3, -0.4)]);
      for (let i = 0; i < 6; i++) {
        const hit = V(0.012 - i * 0.004, -0.078, -0.335);
        await moveTo(R, hit, 0.11, easeOut);
        root.updateMatrixWorld(true);
        chips(root.worldToLocal(L.grip.getWorldPosition(new THREE.Vector3())).add(V(0.02, 0.02, 0)), 5 + (i % 3));
        onTick?.('knap');
        L.pose.p.y -= 0.004;
        await moveTo(R, V(0.09 - i * 0.003, -0.005, -0.31), 0.32);
        L.pose.roll = 1.4 + (i % 2 ? 0.15 : -0.15); // on tourne un peu le rognon entre deux coups
        L.pose.p.y = core.y;
      }
      setItem(L, 'couteau');
      setItem(R, null);
      onDone?.();
      // on regarde la lame obtenue
      await Promise.all([moveTo(L, V(-0.02, -0.06, -0.3), 0.5, ease, 0.1, 0.4), moveTo(R, POSE.away, 0.4)]);
      await tween(0.4, (k) => { L.pose.roll = 0.4 + Math.sin(k * Math.PI) * 0.6; });
    } else if (kind === 'corde') {
      // tresser : les deux mains tordent les fibres en sens contraire et s'écartent ; le cordon s'allonge
      setItem(L, 'fibre'); setItem(R, null);
      L.pose.p.copy(POSE.lAway); R.pose.p.copy(POSE.away);
      await Promise.all([moveTo(L, V(-0.03, -0.09, -0.36), 0.45, ease, 0.4, 1.2), moveTo(R, V(0.03, -0.09, -0.36), 0.45, ease, 0.4, -1.2)]);
      setItem(L, null);
      strand.visible = true;
      let tw = 0;
      for (let i = 0; i < 5; i++) {
        const spread = 0.03 + (i + 1) * 0.022;
        await tween(0.38, (k) => {
          const e = ease(k);
          L.pose.roll = 1.2 + Math.sin(e * Math.PI) * 0.9;
          R.pose.roll = -1.2 - Math.sin(e * Math.PI) * 0.9;
          L.pose.p.x = lerp(-spread + 0.022, -spread, e);
          R.pose.p.x = lerp(spread - 0.022, spread, e);
          tw += 0.18;
          updateStrand(tw);
        });
        onTick?.('twist');
      }
      strand.visible = false;
      setItem(R, 'corde');
      onDone?.();
      await Promise.all([moveTo(R, V(0.05, -0.06, -0.31), 0.45, ease, 0.2, -0.2), moveTo(L, POSE.lAway, 0.45)]);
      await tween(0.45, () => {});
    } else if (kind === 'lance') {
      // ligature : la lance posée en travers devant soi, la gauche la tient, la droite enroule la corde autour de la lame
      const dir = V(0.82, 0.18, -0.55).normalize();
      const knot = V(0.07, -0.07, -0.42);
      prop.geometry = itemGeometry('lance');
      prop.material = matFor('lance');
      prop.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
      prop.position.copy(knot).addScaledVector(dir, -1.6);
      prop.visible = true;
      prop.scale.setScalar(0.001);
      setItem(L, null); setItem(R, 'corde');
      L.pose.p.copy(POSE.lAway); R.pose.p.copy(POSE.away);
      const hold = knot.clone().addScaledVector(dir, -0.26).add(V(0, -0.02, 0));
      await Promise.all([moveTo(L, hold, 0.5, ease, 0.3, 1.0), moveTo(R, knot.clone().add(V(0.02, 0.06, 0.04)), 0.5),
        tween(0.35, (k) => prop.scale.setScalar(Math.max(0.001, ease(k))))]);
      for (let i = 0; i < 4; i++) {
        await tween(0.42, (k) => {
          const a = k * Math.PI * 2, along = -i * 0.012;
          R.pose.p.copy(knot).addScaledVector(dir, along).add(V(Math.sin(a) * 0.012, Math.cos(a) * 0.045 + 0.01, Math.sin(a) * 0.035));
          R.pose.roll = -0.4 + Math.sin(a) * 0.7;
        });
        onTick?.('wrap');
      }
      setItem(R, null);
      onDone?.();
      // on soupèse la lance terminée
      await moveTo(R, POSE.away, 0.4);
      await tween(0.6, (k) => {
        const lift = Math.sin(k * Math.PI) * 0.03;
        prop.position.copy(knot).addScaledVector(dir, -1.6).add(V(0, lift, 0));
        L.pose.p.copy(hold).add(V(0, lift, 0));
      });
      await Promise.all([moveTo(L, POSE.lAway, 0.4), tween(0.35, (k) => prop.scale.setScalar(Math.max(0.001, 1 - ease(k))))]);
      prop.visible = false;
    }
    // les mains redescendent
    await Promise.all([moveTo(L, POSE.lAway, 0.4), moveTo(R, POSE.away, 0.4)]);
    L.g.visible = false;
    setItem(L, null);
    await lookUp(p0);
    restore();
  }
  let onTick = null;

  // pierre à feu : à genoux près du feu, la main droite tient la tige pointée sur
  // les brindilles, la gauche gratte la tige vers le bas avec le grattoir
  const rodW = new THREE.Vector3();
  const REST = { tilt: 0.8, roll: 0.15 };
  const CONSUME = {
    drink: { p: new THREE.Vector3(0.06, -0.13, -0.3), tilt: -0.75, roll: 0.7, look: 0.3 },
    eat: { p: new THREE.Vector3(0.04, -0.12, -0.19), tilt: 0.3, roll: 0.3, look: 0.08 },
  };
  const BATON = { rx: 0, ry: -0.7, rz: 1.0, y: 0.04 };
  const STRIKE = { p: new THREE.Vector3(0.15, -0.13, -0.48), tilt: 1.2, roll: -0.9 };
  async function strike(target, attempts, onSpark) {
    setItem(R, 'pierre-a-feu');
    R.g.visible = true;
    R.pose.roll = 0; R.pose.tilt = 0;
    const ctx = await begin(target, { crouch: 0.9, approach: 0.8, dur: 0.65 });
    // la main reste bas dans le champ (bras vus de dessus), la tige penchée vers les brindilles
    const a = R.pose.p.clone(), b = STRIKE.p.clone();
    await tween(0.5, (k) => { const e = ease(k); R.pose.p.lerpVectors(a, b, e); R.pose.tilt = lerp(0, STRIKE.tilt, e); R.pose.roll = lerp(0, STRIKE.roll, e); });
    // un point de la tige (0.085 : contre le manche, 0.172 : le bout), repère du monde puis de la caméra
    const rod = (y) => { root.updateMatrixWorld(true); return R.item.localToWorld(rodW.set(0, y, 0)).clone(); };
    const rodL = (y, dx = -0.01) => root.worldToLocal(rod(y)).add(tmpW.set(dx, 0.012, 0.012));
    setItem(L, 'grattoir');
    L.g.visible = true;
    L.pose.roll = 0.5; L.pose.tilt = 0.9;
    const la = L.pose.p.clone();
    await tween(0.45, (k) => L.pose.p.lerpVectors(la, rodL(0.09), ease(k)));
    for (let i = 0; i < attempts; i++) {
      // geste vif le long de la tige, vers le bout
      const s0 = rodL(0.09), s1 = rodL(0.19);
      await tween(0.14, (k) => L.pose.p.lerpVectors(s0, s1, easeOut(k)));
      onSpark?.(i, rod(0.185), i === attempts - 1);
      await tween(0.14, () => {});
      if (i < attempts - 1) { const c = L.pose.p.clone(); await tween(0.42, (k) => L.pose.p.lerpVectors(c, rodL(0.09), ease(k))); }
    }
    await tween(0.4, () => {});
    const lc = L.pose.p.clone(), rc = R.pose.p.clone();
    const endP = end(ctx, 0.6);
    await tween(0.55, (k) => {
      const e = ease(k);
      L.pose.p.lerpVectors(lc, POSE.lAway, e);
      R.pose.p.lerpVectors(rc, POSE.rest, e);
      R.pose.tilt = lerp(STRIKE.tilt, 0, e);
      R.pose.roll = lerp(STRIKE.roll, 0, e);
    });
    L.g.visible = false;
    setItem(L, null);
    await endP;
    restore();
  }

  // après un geste, la main reprend ce qu'on tient (ou se baisse hors de vue)
  function restore() {
    R.pose.roll = 0; R.pose.tilt = 0;
    setItem(R, heldType);
    shown = 0;
  }
  function setHeld(type) {
    if (type === heldType) return;
    heldType = type;
    if (!busy) setItem(R, type);
  }

  // ------------------------------------------------------------------ la lance tenue à deux mains
  // main droite à l'arrière du manche, main gauche devant, pointe vers l'avant un peu relevée
  const spearMesh = new THREE.Mesh(itemGeometry('lance'), matFor('lance'));
  spearMesh.visible = false;
  root.add(spearMesh);
  const SPEAR = { g: new THREE.Vector3(0.1, -0.19, -0.37), d: new THREE.Vector3(-0.09, 0.19, -1).normalize(), back: 0.45, front: 0.33 };
  const LP = { g: SPEAR.g.clone(), d: SPEAR.d.clone(), left: 1, lAway: POSE.lAway.clone() };
  let spearAnim = false;
  const yUp = new THREE.Vector3(0, 1, 0), tmpS = new THREE.Vector3();
  function poseSpear(k, bobV) {
    // k : 0 = lance baissée hors de vue, 1 = en main
    tmpS.copy(POSE.away).lerp(LP.g, k).add(bobV);
    R.pose.p.copy(tmpS);
    R.pose.tilt = 1.15; R.pose.roll = -0.35;
    spearMesh.quaternion.setFromUnitVectors(yUp, LP.d);
    spearMesh.position.copy(tmpS).addScaledVector(LP.d, -SPEAR.back);
    const front = tmpS.clone().addScaledVector(LP.d, SPEAR.front);
    L.pose.p.copy(POSE.lAway).lerp(front, Math.min(k, LP.left));
    L.pose.tilt = 1.2; L.pose.roll = 0.95;
    L.g.visible = k * LP.left > 0.02;
    spearMesh.visible = k > 0.02;
  }
  const spearTipWorld = () => { root.updateMatrixWorld(true); return spearMesh.localToWorld(new THREE.Vector3(0, 1.72, 0)); };

  // coup d'estoc : on recule un peu, on pique vers l'avant, on revient
  async function thrust(onHit) {
    if (busy || heldType !== 'lance') return;
    busy = true; spearAnim = true;
    const g0 = SPEAR.g.clone();
    await tween(0.13, (k) => LP.g.copy(g0).addScaledVector(LP.d, -0.09 * ease(k)));
    await tween(0.13, (k) => LP.g.copy(g0).addScaledVector(LP.d, -0.09 + 0.47 * easeOut(k)));
    onHit?.();
    await tween(0.09, () => {});
    await tween(0.32, (k) => LP.g.copy(g0).addScaledVector(LP.d, 0.38 * (1 - ease(k))));
    LP.g.copy(g0);
    spearAnim = false; busy = false;
  }
  // lancer comme un javelot : la gauche lâche, la droite ramène la lance au-dessus de l'épaule, puis la projette
  async function throwSpear(onRelease) {
    if (busy || heldType !== 'lance') return;
    busy = true; spearAnim = true;
    const g0 = SPEAR.g.clone(), d0 = SPEAR.d.clone();
    const gUp = new THREE.Vector3(0.24, -0.02, -0.26), dUp = new THREE.Vector3(-0.16, 0.2, -1).normalize();
    await tween(0.42, (k) => { const e = ease(k); LP.left = 1 - e; LP.g.lerpVectors(g0, gUp, e); LP.d.copy(d0).lerp(dUp, e).normalize(); });
    await tween(0.2, (k) => LP.g.copy(gUp).add(tmpS.set(0.01, 0.01, 0.06 * ease(k)))); // on arme le bras
    const gArmed = LP.g.clone(), gOut = new THREE.Vector3(0.05, -0.08, -0.6);
    let released = false;
    await tween(0.15, (k) => {
      LP.g.lerpVectors(gArmed, gOut, k * k);
      if (!released && k >= 0.5) {
        released = true;
        const tip = spearTipWorld();
        camera.updateMatrixWorld();
        const fwd = new THREE.Vector3(0, 0.07, -1).normalize().applyQuaternion(camera.quaternion);
        spearHidden = true;
        onRelease?.(tip, fwd);
      }
      if (released) { R.pose.p.copy(LP.g); spearMesh.visible = false; }
    });
    // le bras accompagne le geste puis redescend
    spearAnim = false;
    const a = R.pose.p.clone();
    await tween(0.18, (k) => R.pose.p.lerpVectors(a, gOut.clone().add(tmpS.set(0.02, -0.06, 0.02)), easeOut(k)));
    const b = R.pose.p.clone();
    await tween(0.35, (k) => R.pose.p.lerpVectors(b, POSE.away, ease(k)));
    LP.g.copy(g0); LP.d.copy(d0); LP.left = 1;
    spearHidden = false;
    busy = false;
    restore();
  }
  let spearHidden = false;

  // dépecer : accroupi, la gauche maintient le lapin, la droite incise au couteau, puis on tire la peau
  async function skin(target, onDone) {
    setItem(R, 'couteau');
    R.g.visible = true;
    R.pose.roll = 0; R.pose.tilt = 0;
    const ctx = await begin(target, { crouch: 0.85, approach: 0.6 });
    setItem(L, null);
    L.g.visible = true;
    L.pose.p.copy(POSE.lAway); L.pose.roll = 1.3; L.pose.tilt = 0.5;
    const body = reachTo(target, 0.7);
    await Promise.all([moveTo(L, body.clone().add(V(-0.05, 0.03, 0)), 0.45), moveTo(R, body.clone().add(V(0.07, 0.06, 0.02)), 0.45, ease, 0.9, -1.2)]);
    for (let i = 0; i < 2; i++) { // deux incisions le long du ventre
      await moveTo(R, body.clone().add(V(-0.02, 0.025, 0.04)), 0.32);
      onTick?.('skin');
      await moveTo(R, body.clone().add(V(0.07, 0.06, 0.02)), 0.25);
    }
    // on tire la peau : les mains s'écartent
    setItem(R, null);
    await Promise.all([moveTo(L, body.clone().add(V(-0.12, 0.1, 0.03)), 0.5, ease, 0.8), moveTo(R, body.clone().add(V(0.12, 0.1, 0.03)), 0.5, ease, 0.8)]);
    onTick?.('skin');
    onDone?.();
    setItem(L, 'peau');
    const endP = end(ctx, 0.55);
    await Promise.all([moveTo(L, V(-0.1, -0.13, -0.36), 0.45), moveTo(R, POSE.away, 0.45)]);
    await tween(0.3, () => {});
    await moveTo(L, POSE.lAway, 0.4);
    L.g.visible = false;
    setItem(L, null);
    await endP;
    restore();
  }

  // ------------------------------------------------------------------ chaque image
  let phase = 0, wasSpear = false;
  const bob = new THREE.Vector3();
  function update(dt, light) {
    root.position.copy(camera.position);
    root.quaternion.copy(camera.quaternion);
    for (const tw of tweens.slice()) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1) { tweens.splice(tweens.indexOf(tw), 1); tw.res(); }
    }
    // la main reste dans le cadre, en portrait comme en paysage
    const halfH = Math.tan((camera.fov * Math.PI) / 360), halfW = halfH * camera.aspect;
    POSE.rest.set(Math.min(0.15, halfW * 0.42 * 0.6), -Math.min(0.19, halfH * 0.42 * 0.52), -0.42);
    const spearMode = heldType === 'lance' && (!busy || spearAnim) && !spearHidden;
    if (!busy || spearAnim) {
      // main levée quand on tient quelque chose, baissée sinon ; balancement de la marche
      shown += ((heldType ? 1 : 0) - shown) * (1 - Math.exp(-dt * 8));
      const speed = Math.hypot(st.vel.x, st.vel.z);
      phase += dt * speed * 5.2;
      bob.set(Math.cos(phase * 0.5) * 0.008, -Math.abs(Math.sin(phase * 0.5)) * 0.012, 0).multiplyScalar(Math.min(1, speed / 1.5));
      if (spearMode) {
        poseSpear(ease(Math.min(1, Math.max(0, shown))), bob);
        R.g.visible = true;
      } else if (!busy) {
        R.pose.p.lerpVectors(POSE.away, POSE.rest, ease(Math.min(1, Math.max(0, shown)))).add(bob);
        // poignet plié vers l'avant : l'objet tenu reste droit malgré l'avant-bras qui monte
        R.pose.tilt = REST.tilt; R.pose.roll = REST.roll;
        R.g.visible = shown > 0.02 || !!heldType;
      }
    }
    if (!spearMode && !spearAnim) {
      spearMesh.visible = false;
      if (wasSpear) { L.g.visible = false; L.pose.p.copy(POSE.lAway); }
    }
    wasSpear = spearMode;
    placeArm(R, SHOULDER.r);
    placeArm(L, SHOULDER.l);
    updateFlakes(dt);
    // lumière : ciel, soleil, et la lueur d'un feu proche
    if (light) {
      amb.intensity = 0.18 + 0.32 * light.day;
      hemi.intensity = 0.25 + 0.5 * light.day;
      hemi.color.copy(light.sky);
      sunL.color.copy(light.sunColor);
      sunL.intensity = light.sunIntensity * 0.35;
      sunL.position.copy(camera.position).add(light.sunDir);
      sunL.target.position.copy(camera.position);
      fireL.intensity = light.fire * 2.2;
      fireL.position.copy(camera.position).add(light.fireDir);
      fireL.target.position.copy(camera.position);
    }
  }
  function render(renderer) {
    if (!R.g.visible && !L.g.visible && !prop.visible && !spearMesh.visible) return;
    // (r169 n'efface la profondeur que si l'écriture est permise : le dernier objet dessiné peut l'avoir coupée)
    renderer.state.buffers.depth.setMask(true);
    renderer.clearDepth();
    renderer.render(scene, camera);
  }

  return { update, render, pickup, place, strike, fill, consume, cut, craft, thrust, throwSpear, skin, setTick(fn) { onTick = fn; }, setHeld, get busy() { return busy; }, _arms: { R, L, root, scene, STRIKE, REST, BATON, CONSUME, SPEAR, LP, spearMesh, setItem } };
}
