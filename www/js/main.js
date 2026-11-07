import * as THREE from '../vendor/three.module.min.js';
import { createSky, makeClock } from './sky.js';
import { createControls } from './controls.js';
import { createForestAudio } from './audio.js';
import { createForest } from './forest.js';
import { createWeather, seasonOf } from './weather.js';

const mobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const canvas = document.getElementById('c');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile || devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

const controls = createControls(camera, canvas, forest.colliders, { start: { x: forest.spawn.x, z: forest.spawn.z, yaw: 1.25, pitch: -0.08 } });
controls.setWorld({ ground: forest.groundAt, clamp: forest.clamp });
const clock = makeClock();

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
let audio = null;
const intro = document.getElementById('intro');
const soundBtn = document.getElementById('sound');
document.getElementById('hint').textContent = mobile
  ? 'Pouce gauche pour marcher, glisse à droite pour regarder autour de toi.'
  : 'Flèches ou ZQSD pour marcher, clique-glisse pour regarder autour de toi.';
document.getElementById('enter').addEventListener('click', async () => {
  intro.classList.add('gone');
  controls.state.enabled = true;
  soundBtn.hidden = false;
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
const birdSeason = season.name === 'hiver' ? 0.4 : season.name === 'automne' ? 0.7 : 1;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
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
  if (audio) {
    const dB = forest.streamDist(p.x, p.z);
    audio.setAmbience({ rain: wNow.rain, wind: wNow.wind, snow: wNow.snow, day: sky.state.day, birds: birdSeason, brook: 1 / (1 + dB * dB * 0.012) });
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__survival = { forest, controls, sky, scene, camera, renderer, weather, ready: true };
