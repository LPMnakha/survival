import * as THREE from '../vendor/three.module.min.js';
import { createSky, makeClock } from './sky.js';
import { createControls } from './controls.js';
import { createForestAudio } from './audio.js';
import { createForest } from './forest.js';
import { createWeather, seasonOf } from './weather.js';
import { loadSave, createSaver } from './save.js';
import { createInventory } from './inventory.js';
import { createGroundItems } from './items.js';
import { createHands } from './hands.js';
import { createCampfires } from './campfire.js';
import { createUI } from './ui.js';
import { createPlaces } from './places.js';
import { createBerries } from './berries.js';
import { createNeeds, fmtDuration } from './needs.js';
import { createRain } from './rain.js';
import { createCollectors } from './collector.js';
import { createPlants } from './plants.js';
import { createShelters } from './shelter.js';
import { createSleep } from './sleep.js';
import { createMap } from './map.js';

const mobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const canvas = document.getElementById('c');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile || devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false; // les mains sont dessinées par-dessus le décor

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 9000);

const sky = createSky(scene, renderer, { shadows: true, mobile });
// en forêt, les ombres des arbres portent plus loin que dans la cabane
{
  const sc = sky.sun.shadow.camera, R = mobile ? 24 : 32;
  sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R;
  sc.updateProjectionMatrix();
}
const season = seasonOf();
const forest = createForest(scene, { season, mobile, shadows: true });

// lumière douce renvoyée par le sous-bois, pour qu'aucun recoin ne soit noir
const fill = new THREE.AmbientLight(0xffe0c2, 0.3);
scene.add(fill);
const fillDay = new THREE.Color(0xffe6c8), fillNight = new THREE.Color(0x8ea2cc);
// sous les arbres : lumière du ciel filtrée et lumière renvoyée par le sol (dessous des branches)
const bounce = new THREE.HemisphereLight(0xcfe0f0, 0x9c8858, 0.4);
scene.add(bounce);
const bounceSkyDay = new THREE.Color(0xd6e6f2), bounceSkyNight = new THREE.Color(0x6a7cae);
const bounceGroundDay = new THREE.Color(0xa89062), bounceGroundNight = new THREE.Color(0x3a4258);

// on reprend là où l'on s'était arrêté (position sauvegardée)
const savedEarly = loadSave();
const startAt = savedEarly.player && Number.isFinite(savedEarly.player.x) ? { x: savedEarly.player.x, z: savedEarly.player.z, yaw: savedEarly.player.yaw || 0, pitch: -0.08 } : { x: forest.spawn.x, z: forest.spawn.z, yaw: 1.25, pitch: -0.08 };
const controls = createControls(camera, canvas, forest.colliders, { start: startAt });
controls.setWorld({ ground: forest.groundAt, clamp: forest.clamp });
const clock = makeClock();

// ---------- inventaire, objets au sol, mains, feux de camp (sauvegardés sur l'appareil)
let audio = null;
const saved = loadSave();
let saver = null;
const changed = () => saver?.soon();
const hands = createHands({ camera, controls });
const inventory = createInventory({ saved: saved.inv, onChange: () => { hands.setHeld(inventory.heldType()); changed(); } });
hands.setHeld(inventory.heldType());
const items = createGroundItems(scene, { forest, saved: saved.items, onChange: changed });
createPlaces(scene, { forest, items, shadows: true });
const berries = createBerries(scene, { forest, season, saved: saved.berries, onChange: changed });
const plants = createPlants(scene, { forest, season, saved: saved.plants, onChange: changed });
const rain = createRain();
let ui = null, collectors = null, shelters = null;
const hint = (t, ms) => ui?.hint(t, ms);
const campfires = createCampfires(scene, { forest, inventory, hands, getAudio: () => audio, hint, onChange: changed, saved: saved.fires, others: () => [...(collectors?.sites || []), ...(shelters?.sites || [])] });
collectors = createCollectors(scene, { forest, inventory, hands, rain, getAudio: () => audio, hint, onChange: changed, saved: saved.cols, others: () => [...campfires.sites, ...(shelters?.sites || [])] });
shelters = createShelters(scene, { forest, inventory, hands, getAudio: () => audio, hint, onChange: changed, saved: saved.shelters, others: () => [...campfires.sites, ...collectors.sites] });
hands.setTick((k) => audio?.tick(k));

// ---------- soif, faim, fin de partie (mort définitive)
const gameover = document.getElementById('gameover');
let over = false;
function gameOver(dead, instant = false) {
  if (over) return;
  over = true;
  controls.state.enabled = false;
  saver?.now();
  document.getElementById('go-cause').textContent = dead.cause === 'soif' ? 'Morte de soif.' : 'Morte de faim.';
  document.getElementById('go-time').textContent = `Tu as tenu ${fmtDuration(dead.at - needs.start)} dans la forêt.`;
  gameover.hidden = false;
  if (instant) gameover.classList.add('on'); else requestAnimationFrame(() => gameover.classList.add('on'));
  for (const id of ['hud', 'needs', 'sound', 'sleep']) document.getElementById(id).hidden = true;
  document.getElementById('intro').classList.add('gone');
  for (const s of document.querySelectorAll('.sheet')) s.classList.remove('on');
  document.getElementById('actions').classList.remove('on');
}
const needs = createNeeds({ saved: saved.needs, onDeath: (d) => setTimeout(() => gameOver(d)) });
document.getElementById('btn-newgame').addEventListener('click', () => { saver.reset(); location.reload(); });

// la carte : on ne bouge pas pendant qu'on la lit
const map = createMap({ saved: saved.map, onChange: changed, onOpen: (on) => { controls.state.enabled = !on && !needs.asleep && !over; } });
inventory.setRead(() => { if (!hands.busy) map.open(); });
const sleep = createSleep({ controls, needs, shelters, forest, hint, getAudio: () => audio, onChange: changed });
shelters.setSleepHandler((site) => sleep.start(site));
needs.setCollapse(() => setTimeout(() => sleep.collapse()));
sleep.restore(startAt);
ui = createUI({ canvas, camera, controls, inventory, items, campfires, collectors, shelters, berries, plants, needs, sleep, forest, hands, getAudio: () => audio });
const playerData = () => (controls.state.lie ? savedPlayer : (savedPlayer = { x: +controls.state.pos.x.toFixed(2), z: +controls.state.pos.z.toFixed(2), yaw: +controls.state.yaw.toFixed(3) }));
let savedPlayer = startAt;
saver = createSaver({ inv: inventory.data, items: items.data, fires: campfires.data, cols: collectors.data, shelters: shelters.data, berries: berries.data, plants: plants.data, needs: needs.data, player: playerData, map: map.data });
setInterval(() => saver.soon(), 10000); // la position est sauvegardée régulièrement
if (needs.dead) gameOver(needs.dead, true);

// météo en direct à Annecy (affichée discrètement sur l'écran d'accueil)
const meteoLine = document.getElementById('meteo');
const SAISONS = { printemps: 'printemps', ete: 'été', automne: 'automne', hiver: 'hiver' };
const weather = createWeather((w, forced) => {
  const temp = w.temp != null ? `${Math.round(w.temp)}°, ` : '';
  meteoLine.textContent = `Annecy · ${temp}${w.label} · ${SAISONS[season.name]}${forced ? ' (simulé)' : ''}`;
  meteoLine.classList.add('on');
});

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 80 : 68;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();

// ---------- interface ----------
const intro = document.getElementById('intro');
const soundBtn = document.getElementById('sound');
document.getElementById('hint').textContent = mobile
  ? 'Pouce gauche pour marcher, glisse à droite pour regarder autour de toi.'
  : 'Flèches ou ZQSD pour marcher, clique-glisse pour regarder autour de toi.';
{
  const low = [needs.thirst < 0.25 && 'Tu as soif', needs.hunger < 0.25 && 'Tu as faim'].filter(Boolean);
  if (low.length && !needs.dead) document.getElementById('hint').textContent += ` ${low.join(' et ')} : pense à ${needs.thirst < 0.25 ? 'boire' : 'manger'}.`;
}
document.getElementById('enter').addEventListener('click', async () => {
  intro.classList.add('gone');
  controls.state.enabled = true;
  soundBtn.hidden = false;
  document.getElementById('hud').hidden = false;
  document.getElementById('needs').hidden = false;
  sleep.onEnter();
  try {
    audio = audio || createForestAudio();
    await audio?.start();
  } catch (e) { /* pas de son : tant pis */ }
});
soundBtn.addEventListener('click', () => {
  if (!audio) return;
  const on = audio.toggle();
  soundBtn.classList.toggle('muted', !on);
  soundBtn.setAttribute('aria-label', on ? 'Couper le son' : 'Remettre le son');
});
document.addEventListener('visibilitychange', () => {
  if (!audio) return;
  if (document.hidden) audio.ctx.suspend(); else if (audio.on) audio.ctx.resume();
});

// ---------- boucle ----------
let last = performance.now(), skyTimer = 0, t = 0;
let lastStep = null, stepDist = 0, snowCover = 0;
const handLight = { day: 1, sky: new THREE.Color(), sunColor: new THREE.Color(), sunIntensity: 0, sunDir: new THREE.Vector3(0, 1, 0), fire: 0, fireDir: new THREE.Vector3() };
const birdSeason = season.name === 'hiver' ? 0.4 : season.name === 'automne' ? 0.7 : 1;
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  t += dt;

  const wNow = weather.update(dt);
  skyTimer -= dt;
  if (skyTimer <= 0) {
    skyTimer = 1; // le soleil bouge lentement : une mise à jour par seconde suffit
    const s = sky.update(clock(), wNow);
    fill.intensity = 0.27 + 0.27 * s.day;
    fill.color.copy(fillNight).lerp(fillDay, s.day);
    bounce.intensity = 0.38 + 0.47 * s.day;
    bounce.color.copy(bounceSkyNight).lerp(bounceSkyDay, s.day);
    bounce.groundColor.copy(bounceGroundNight).lerp(bounceGroundDay, s.day);
  }

  forest.update(t, dt, wNow, sky.state, camera.position);
  snowCover = Math.max(wNow.snow * 0.5, Math.min(1, (wNow.snowDepth || 0) / 0.06));
  sky.tick(t);
  controls.update(dt);
  const p = controls.state.pos;
  sky.state.focus.x = p.x;
  sky.state.focus.z = p.z;
  // bruits de pas : un pas tous les ~65 cm, selon le sol
  if (lastStep) {
    const moved = Math.hypot(p.x - lastStep.x, p.z - lastStep.z);
    if (controls.state.enabled && moved < 0.5) stepDist += moved;
    if (stepDist > 0.65) { stepDist = 0; if (audio) audio.step(forest.surfaceAt(p.x, p.z, snowCover)); }
    const speed = moved / Math.max(dt, 1e-3);
    if (speed < 0.15) stepDist = Math.min(stepDist, 0.45); // premier pas rapide quand on repart
  }
  lastStep = { x: p.x, z: p.z };
  items.update(dt, p);
  berries.update(dt);
  plants.update(dt);
  shelters.update(dt, p, camera, controls.state.yaw);
  sleep.update(dt);
  collectors.update(dt, p, camera, controls.state.yaw);
  if (!over) needs.update(dt, hint);
  const fire = campfires.update(dt, p, camera, controls.state.yaw);
  ui.update(dt);
  if (audio) {
    const dB = forest.streamDist(p.x, p.z);
    audio.setAmbience({ rain: wNow.rain, wind: wNow.wind, snow: wNow.snow, day: sky.state.day, birds: birdSeason, brook: 1 / (1 + dB * dB * 0.012) });
    audio.setFire(fire.level);
  }
  // les mains, éclairées comme le décor (ciel, soleil, feu proche)
  handLight.day = sky.state.day;
  handLight.sky.copy(bounce.color);
  handLight.sunColor.copy(sky.sun.color);
  handLight.sunIntensity = sky.sun.visible ? sky.sun.intensity : 0;
  handLight.sunDir.copy(sky.sun.position).sub(sky.sun.target.position).normalize();
  handLight.fire = fire.hand;
  handLight.fireDir.copy(fire.dir);
  hands.update(dt, handLight);

  renderer.clear();
  renderer.render(scene, camera);
  hands.render(renderer);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__survival = { forest, controls, sky, scene, camera, renderer, weather, inventory, items, hands, campfires, collectors, shelters, berries, plants, needs, sleep, map, rain, ui, saver, ready: true };
