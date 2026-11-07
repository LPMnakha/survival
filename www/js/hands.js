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

  // ------------------------------------------------------------------ chaque image
  let phase = 0;
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
    if (!busy) {
      // main levée quand on tient quelque chose, baissée sinon ; balancement de la marche
      shown += ((heldType ? 1 : 0) - shown) * (1 - Math.exp(-dt * 8));
      const speed = Math.hypot(st.vel.x, st.vel.z);
      phase += dt * speed * 5.2;
      bob.set(Math.cos(phase * 0.5) * 0.008, -Math.abs(Math.sin(phase * 0.5)) * 0.012, 0).multiplyScalar(Math.min(1, speed / 1.5));
      R.pose.p.lerpVectors(POSE.away, POSE.rest, ease(Math.min(1, Math.max(0, shown)))).add(bob);
      // poignet plié vers l'avant : l'objet tenu reste droit malgré l'avant-bras qui monte
      R.pose.tilt = REST.tilt; R.pose.roll = REST.roll;
      R.g.visible = shown > 0.02 || !!heldType;
    }
    placeArm(R, SHOULDER.r);
    placeArm(L, SHOULDER.l);
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
    if (!R.g.visible && !L.g.visible) return;
    // (r169 n'efface la profondeur que si l'écriture est permise : le dernier objet dessiné peut l'avoir coupée)
    renderer.state.buffers.depth.setMask(true);
    renderer.clearDepth();
    renderer.render(scene, camera);
  }

  return { update, render, pickup, place, strike, fill, consume, setHeld, get busy() { return busy; }, _arms: { R, L, root, scene, STRIKE, REST, BATON, CONSUME, setItem } };
}
