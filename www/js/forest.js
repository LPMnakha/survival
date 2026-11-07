// La forêt : relief doux, clairières, petit ruisseau, épicéas et bouleaux,
// fougères, rochers moussus, troncs couchés. Arbres, herbe, nuages, pluie,
// neige et vent repris de Détente (outside.js) ; la météo (Annecy) et les
// saisons pilotent couleurs, neige au sol et balancement.
// Zone de 400 m : terrain en tuiles, arbres simplifiés au loin, petite
// végétation dessinée seulement près du joueur (performances mobiles).
import * as THREE from '../vendor/three.module.min.js';
import { makeNoise } from './noise.js';
import { Builder, merge, mergeColored } from './builder.js';

const NZ = makeNoise(11);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// zone de promenade : 400 m de côté, murs invisibles
export const HALF = 200;
export const WALL = HALF - 1;
const IN = 216; // terrain fin et forêt détaillée jusqu'ici
export const SPAWN = { x: 5, z: 9 };

// ---------------------------------------------------------------- ruisseau (coule du nord -z vers le sud +z)
export const streamX = (z) => -13 + 9 * Math.sin(z * 0.03 + 0.5) + 3.5 * Math.sin(z * 0.077 + 2.1);
const CROSSINGS = [-170, -110, -50, 7, 48, 110, 170]; // gués en pierres plates
// collines au loin, au-delà de la zone de promenade
const hills = (x, z) => {
  const r = Math.hypot(x, z);
  return Math.pow(smooth(230, 1100, r), 1.3) * (80 + 70 * NZ.fbm(x * 0.002 + 4, z * 0.002, 3));
};
const waterBase = (z) => 0.6 - z * 0.022;
export const waterY = (z) => waterBase(z) + hills(streamX(z), z);

// ---------------------------------------------------------------- clairières
const CLEARINGS = [
  { x: 3, z: 4, r: 12.5 }, { x: -41, z: -33, r: 13 }, { x: 40, z: 30, r: 12 },
  { x: 33, z: -46, r: 10 }, { x: -46, z: 45, r: 10 }, { x: 54, z: -4, r: 8 }, { x: 10, z: 55, r: 8 },
];
{
  const R = makeNoise(23).rnd;
  let g = 0;
  while (CLEARINGS.length < 28 && g++ < 4000) {
    const x = (R() * 2 - 1) * 188, z = (R() * 2 - 1) * 188, r = 7 + R() * 7;
    if (CLEARINGS.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + r + 24)) continue;
    CLEARINGS.push({ x, z, r });
  }
}
export function clearingAt(x, z) {
  let m = 0;
  for (const c of CLEARINGS) {
    const dx = x - c.x, dz = z - c.z, lim = c.r * 1.4;
    if (dx > lim || dx < -lim || dz > lim || dz < -lim) continue;
    const d = Math.hypot(dx, dz);
    if (d > lim) continue;
    const edge = c.r * (1 + 0.22 * NZ.noise(x * 0.08 + c.x, z * 0.08 + c.z));
    m = Math.max(m, smooth(edge, edge * 0.6, d));
  }
  return m;
}

// ---------------------------------------------------------------- relief
export function height(x, z) {
  const d = Math.abs(x - streamX(z));
  const bank = waterBase(z) + 0.32;
  // monte doucement en s'éloignant du ruisseau, petites bosses de sous-bois, larges ondulations
  let h = bank
    + (2.2 + 2.0 * NZ.fbm(x * 0.011 + 5, z * 0.011 - 3, 3)) * smooth(2.0, 30, d)
    + NZ.fbm(x * 0.045, z * 0.045 + 8, 3) * 0.9 * smooth(1.5, 8, d)
    + (3 + 4 * NZ.fbm(x * 0.0045 - 2, z * 0.0045 + 6, 2)) * smooth(10, 90, d)
    + d * 0.02;
  h += hills(x, z);
  // lit du ruisseau
  h -= 0.62 * smooth(1.7, 0.8, d);
  return h;
}

// palettes de saison (reprises de Détente + sous-bois et fougères)
const PAL = {
  printemps: { grass: [0x7aa956, 0x8fb862, 0x6a974b], dry: 0x8fa35a, leaves: [0x98c95e, 0xaed46e, 0x8dbf58], flowers: [0xfff4e0, 0xf6d24a, 0xe6a1c4, 0xb9a3e6, 0x9fc7f0], grassH: 1,
    floor: [0x6d7b45, 0x7a854a, 0x627141], fern: [0x84b956, 0x92c462, 0x76ab4c], moss: 0x6b8f3e },
  ete: { grass: [0x5f9443, 0x72a24c, 0x527f3a], dry: 0x8e9a52, leaves: [0x5e8a3e, 0x6d9746, 0x76a04c], flowers: [0xfff4e0, 0xf2c94c, 0xe58fb0, 0x9b8fe0], grassH: 1.15,
    floor: [0x617040, 0x6d7843, 0x58673b], fern: [0x5a9a42, 0x4e8c3a, 0x67a64a], moss: 0x5e8738 },
  automne: { grass: [0x7d904b, 0x8c9a53, 0x6c8045], dry: 0xa8925a, leaves: [0xe6b23a, 0xf0c64a, 0xd9952e, 0xc98a2a, 0xe8bd4f], flowers: [], grassH: 0.9,
    floor: [0x82693f, 0x8d7442, 0x74663d], fern: [0xb8743a, 0xc4883f, 0xa66a33, 0x8f8c3e], moss: 0x6d8a3c },
  hiver: { grass: [0x7f805e, 0x8c8a66, 0x707356], dry: 0x8f8a6a, leaves: [0x6e5a3a], flowers: [], grassH: 0.6,
    floor: [0x6f6550, 0x786b55, 0x655c4c], fern: [0x8a6c48, 0x7a6244], moss: 0x627340 },
};

export function createForest(scene, { season, mobile = false, shadows = true }) {
  const P = PAL[season.name];
  const rnd = NZ.rnd;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const col = new THREE.Color(), c2 = new THREE.Color(), tint = new THREE.Color();
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0.2 } };
  const snowAmt = { value: 0 };
  const colliders = [];
  const birchZone = (x, z) => NZ.fbm(x * 0.02 + 3, z * 0.02, 2);
  const leafy = (x, z) => season.name === 'automne' && birchZone(x, z) > -0.25;
  const streamD = (x, z) => Math.abs(x - streamX(z));

  // ------------------------------------------------------------------ niveaux de détail : chaque groupe d'objets n'est dessiné qu'à la bonne distance
  const lods = [];
  const hiddenGroups = new Set();
  const addLod = (mesh, x0, z0, x1, z1, near, far, group = null) => { lods.push({ mesh, x0, z0, x1, z1, near, far, group }); };

  // ------------------------------------------------------------------ couleurs du sol
  const canopy = season.name === 'automne' ? 0xc99a32 : season.name === 'hiver' ? 0x6d6658 : 0x5d8a46;
  const terrains = [];
  function colorize(geo) {
    const p = geo.attributes.position, nrm = geo.attributes.normal, n = p.count;
    const base = new Float32Array(n * 3), snowC = new Float32Array(n * 3), cur = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
      const slope = 1 - nrm.getY(v);
      const r = Math.max(Math.abs(x), Math.abs(z));
      const d = streamD(x, z);
      const patch = NZ.fbm(x * 0.04 + 9, z * 0.04, 3) * 0.5 + 0.5;
      // herbe (clairières, berges)
      col.set(P.grass[0]).lerp(c2.set(P.grass[1]), smooth(0.35, 0.75, patch));
      col.lerp(c2.set(P.grass[2]), smooth(0.55, 0.9, NZ.fbm(x * 0.11, z * 0.11 + 4, 2) * 0.5 + 0.5) * 0.6);
      col.lerp(c2.set(P.dry), smooth(0.6, 0.85, NZ.fbm(x * 0.02 - 5, z * 0.02, 2) * 0.5 + 0.5) * 0.45);
      let cl = 1, bank = 0;
      if (r < IN + 30) {
        cl = clearingAt(x, z);
        bank = smooth(5, 1.6, d);
        // sous-bois : aiguilles, mousse, feuilles mortes
        const fl = tint.set(P.floor[0]).lerp(c2.set(P.floor[1]), smooth(0.3, 0.7, patch)).lerp(c2.set(P.floor[2]), smooth(0.5, 0.9, NZ.fbm(x * 0.15, z * 0.15 - 2, 2) * 0.5 + 0.5) * 0.7);
        fl.lerp(c2.set(P.moss), smooth(0.55, 0.85, NZ.fbm(x * 0.07 - 3, z * 0.07 + 1, 2) * 0.5 + 0.5) * 0.5);
        if (leafy(x, z)) fl.lerp(c2.set(0xa06a30), 0.35 * smooth(-0.25, 0.3, birchZone(x, z)));
        col.lerp(fl, (1 - Math.max(cl, bank * 0.85)) * (1 - smooth(IN - 10, IN + 30, r)));
      }
      // au loin : la forêt vue de haut (épicéas sombres, taches de bouleaux)
      const far = smooth(IN - 5, IN + 45, r);
      if (far > 0) {
        const birch = smooth(0.55, 0.75, birchZone(x, z) * 0.5 + 0.5);
        c2.set(0x2f4a34).lerp(tint.set(canopy), birch * 0.8);
        col.lerp(c2, far * 0.92);
      }
      // lit du ruisseau : galets
      const bed = smooth(1.6, 1.05, d) * (r < 360 ? 1 : 0);
      if (bed > 0) col.lerp(c2.set(patch > 0.5 ? 0x7d7566 : 0x6b6558), bed);
      base.set([col.r, col.g, col.b], v * 3);
      // sous la neige : blanc, un peu moins sous les arbres et dans les pentes
      const under = r < IN + 5 ? (1 - Math.max(cl, bank)) * (0.12 + 0.3 * smooth(0.55, 0.75, patch)) : 0.35;
      c2.set(0xeef1f4).lerp(col, Math.min(1, bed + smooth(0.55, 0.85, slope) * 0.6 + under));
      snowC.set([c2.r, c2.g, c2.b], v * 3);
    }
    cur.set(base);
    geo.setAttribute('color', new THREE.BufferAttribute(cur, 3));
    terrains.push({ geo, base, snow: snowC, cur });
  }
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const addTerrain = (geo) => {
    colorize(geo);
    const m = new THREE.Mesh(geo, groundMat);
    m.receiveShadow = true;
    scene.add(m);
  };

  // ------------------------------------------------------------------ relief : tuiles fines sur la zone (dessinées si visibles)
  const ST = mobile ? 1.5 : 1.0, TS = 48, NC = Math.round(TS / ST);
  for (let tz = -IN; tz < IN; tz += TS) for (let tx = -IN; tx < IN; tx += TS) {
    const pos = new Float32Array((NC + 1) * (NC + 1) * 3);
    for (let j = 0; j <= NC; j++) for (let i = 0; i <= NC; i++) {
      const x = tx + i * ST, z = tz + j * ST, k = (j * (NC + 1) + i) * 3;
      pos[k] = x; pos[k + 1] = height(x, z); pos[k + 2] = z;
    }
    const idx = new Uint32Array(NC * NC * 6);
    let o = 0;
    for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) {
      const a = j * (NC + 1) + i, b = a + 1, c = a + NC + 1, d = c + 1;
      if ((i + j) % 2) idx.set([a, c, b, b, c, d], o); else idx.set([a, c, d, a, d, b], o);
      o += 6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    addTerrain(g);
  }
  // au-delà : grille de plus en plus large jusqu'à l'horizon (trou au centre, bords raccordés aux tuiles)
  {
    const fine = [];
    for (let v = -IN; v <= IN + 1e-6; v += ST) fine.push(Math.round(v * 1000) / 1000);
    const coarse = [];
    let v = IN, s = ST;
    while (v < 3600) { s *= 1.16; v += s; coarse.push(v); }
    const L = [...coarse.slice().reverse().map((x) => -x), ...fine, ...coarse];
    const n = L.length;
    const map = new Map(), pos = [], idx = [];
    const vert = (i, j) => {
      const k = j * n + i;
      let id = map.get(k);
      if (id === undefined) { id = pos.length / 3; map.set(k, id); pos.push(L[i], height(L[i], L[j]), L[j]); }
      return id;
    };
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      if (L[i] >= -IN && L[i + 1] <= IN && L[j] >= -IN && L[j + 1] <= IN) continue;
      const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
      if ((i + j) % 2) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    addTerrain(g);
  }

  // ------------------------------------------------------------------ eau du ruisseau
  const WS = mobile ? 0.8 : 0.5, COLS = 4;
  const wpos = [], widx = [];
  let rows = 0;
  for (let z = -340; z <= 340; z += WS, rows++) {
    const sx = streamX(z), y = waterY(z);
    for (let c = 0; c < COLS; c++) wpos.push(sx + (-1 + (2 * c) / (COLS - 1)) * 1.5, y, z);
  }
  for (let rI = 0; rI < rows - 1; rI++) for (let c = 0; c < COLS - 1; c++) {
    const a = rI * COLS + c, b = a + 1, cc = a + COLS, d = cc + 1;
    widx.push(a, cc, b, b, cc, d);
  }
  const wgeo = new THREE.BufferGeometry();
  wgeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  wgeo.setIndex(widx);
  wgeo.computeVertexNormals();
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x3d6a5f, roughness: 0.12, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.86 });
  const wU = { uTime: uniforms.uTime, uSky: { value: new THREE.Color(0xcfe2ee) } };
  waterMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, wU);
    sh.fragmentShader = 'uniform vec3 uSky;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      float fres = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 3.0);
      outgoingLight = mix(outgoingLight, uSky, clamp(fres * 0.42, 0.0, 0.42));
      #include <opaque_fragment>`);
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.y += sin(position.z * 1.9 - uTime * 2.6 + position.x * 2.3) * 0.014 + sin(position.z * 3.7 - uTime * 3.4 - position.x * 1.7) * 0.008;`);
  };
  waterMat.customProgramCacheKey = () => 'ruisseau';
  const water = new THREE.Mesh(wgeo, waterMat);
  water.receiveShadow = true;
  scene.add(water);

  // ------------------------------------------------------------------ matériaux (balancement au vent, neige posée)
  const sway = (mat, k) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.uTime;
      sh.uniforms.uWind = uniforms.uWind;
      sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float sw = sin(uTime * 1.3 + ip.x * 0.17 + ip.z * 0.13) + 0.45 * sin(uTime * 2.7 + ip.z * 0.31 + ip.x * 0.07);
        float hh = max(transformed.y, 0.0);
        transformed.x += (sw * uWind + uWind * 0.6) * hh * ${k.toFixed(4)};
        transformed.z += cos(uTime * 1.1 + ip.x * 0.2) * uWind * hh * ${(k * 0.5).toFixed(4)};`);
    };
    mat.customProgramCacheKey = () => 'sway' + k;
    return mat;
  };
  const snowy = (mat, key) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSnowAmt = snowAmt;
      sh.fragmentShader = 'uniform float uSnowAmt;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.97), uSnowAmt * smoothstep(0.35, 0.7, wn.y)); }`);
    };
    mat.customProgramCacheKey = () => 'snowy' + key;
    return mat;
  };
  const treeMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.01);
  const leafMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.016);
  const snowCapMat = sway(new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.9, flatShading: true }), 0.0101);
  const grassMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.12);
  const fernMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide }), 0.07);

  // ------------------------------------------------------------------ modèles d'arbres (comme dans Détente), version détaillée et version lointaine
  const spruceColors = [0x2c4a33, 0x31523a, 0x2a4631, 0x355a3d, 0x2f4e36, 0x36593e, 0x2e4c35];
  const spruceModel = ({ trunkH, y0, tiers, r0, dr, h0, dh, dy, seg, tseg }) => {
    const parts = [[new THREE.CylinderGeometry(0.11, 0.21, trunkH, tseg).translate(0, trunkH / 2, 0), 0x4e3828]];
    const caps = [];
    for (let k = 0; k < tiers; k++) {
      const r = r0 - k * dr, h = h0 - k * dh, y = y0 + k * dy;
      parts.push([new THREE.ConeGeometry(r, h, seg).translate(0, y + h / 2, 0), spruceColors[k % 7]]);
      const ch = h * 0.5 + 0.05;
      caps.push([new THREE.ConeGeometry(r * 0.52 * 1.08, ch, seg).translate(0, y + h * 0.5 + ch / 2, 0), 0xffffff]);
    }
    return [mergeColored(parts), mergeColored(caps)];
  };
  // épicéa de forêt : tronc dégagé (on passe dessous) ; au loin, 4 étages seulement
  const [fSpruceGeo, fCapGeo] = spruceModel({ trunkH: 2.6, y0: 2.0, tiers: 7, r0: 1.5, dr: 0.19, h0: 1.5, dh: 0.08, dy: 0.8, seg: 7, tseg: 6 });
  const [fSpruceLow, fCapLow] = spruceModel({ trunkH: 2.6, y0: 2.0, tiers: 4, r0: 1.5, dr: 0.33, h0: 2.0, dh: 0.15, dy: 1.4, seg: 5, tseg: 4 });
  // épicéa de Détente : branches jusqu'au sol (au-delà des murs)
  const [spruceGeo, capGeo] = spruceModel({ trunkH: 1.2, y0: 0.9, tiers: 6, r0: 1.35, dr: 0.2, h0: 1.5, dh: 0.1, dy: 0.85, seg: 7, tseg: 6 });
  const [spruceLow, capLow] = spruceModel({ trunkH: 1.2, y0: 0.9, tiers: 3, r0: 1.35, dr: 0.38, h0: 2.2, dh: 0.2, dy: 1.6, seg: 5, tseg: 4 });
  // bouleau : tronc blanc tacheté, houppier léger
  const birchParts = [];
  for (let k = 0; k < 5; k++) birchParts.push([new THREE.CylinderGeometry(0.09 - k * 0.012, 0.1 - k * 0.012, 0.85, 6).translate(0, 0.42 + k * 0.85, 0), k % 2 ? 0xe9e6dd : 0xdedad0]);
  for (let k = 0; k < 6; k++) birchParts.push([new THREE.BoxGeometry(0.06, 0.05, 0.2).translate(0, 0.5 + k * 0.6, 0).rotateY(k * 1.3), 0x2c2a28]);
  for (const [a, t] of [[0.6, 0.55], [2.6, -0.6], [4.4, 0.5]]) {
    const b = new THREE.CylinderGeometry(0.025, 0.05, 1.3, 5).translate(0, 0.65, 0);
    b.rotateZ(t); b.rotateY(a); b.translate(0, 2.6, 0);
    birchParts.push([b, 0xdedad0]);
  }
  const birchGeo = mergeColored(birchParts);
  const birchLow = mergeColored([[new THREE.CylinderGeometry(0.05, 0.1, 4.25, 4).translate(0, 2.12, 0), 0xe4e0d6]]);
  const crownParts = [];
  for (const [x, y, z, s] of [[0, 4.0, 0, 1.1], [0.7, 3.4, 0.3, 0.8], [-0.65, 3.5, -0.2, 0.85], [0.1, 4.8, -0.2, 0.75], [-0.2, 3.1, 0.6, 0.7]]) {
    const g = new THREE.IcosahedronGeometry(s, 0).translate(x, y, z);
    g.scale(1, 1.15, 1);
    crownParts.push([g, 0xffffff]);
  }
  const crownGeo = mergeColored(crownParts);
  const crownLow = mergeColored([[new THREE.IcosahedronGeometry(1.25, 0).scale(1, 1.2, 1).translate(0, 4.2, 0), 0xffffff], [new THREE.IcosahedronGeometry(0.85, 0).scale(1, 1.15, 1).translate(0.3, 3.3, 0.2), 0xffffff]]);

  // ------------------------------------------------------------------ grille pour espacer arbres, rochers, troncs
  const GRID = new Map(), GC = 4;
  const gk = (i, j) => (i + 1000) * 4000 + (j + 1000);
  const gAdd = (x, z, pad) => {
    const k = gk(Math.floor(x / GC), Math.floor(z / GC));
    if (!GRID.has(k)) GRID.set(k, []);
    GRID.get(k).push({ x, z, pad });
  };
  const gClear = (x, z, dist) => {
    const R = dist + 2;
    for (let i = Math.floor((x - R) / GC); i <= Math.floor((x + R) / GC); i++) for (let j = Math.floor((z - R) / GC); j <= Math.floor((z + R) / GC); j++) {
      const c = GRID.get(gk(i, j));
      if (c) for (const p of c) if (Math.hypot(p.x - x, p.z - z) < dist + p.pad) return false;
    }
    return true;
  };
  const nearSpawn = (x, z, r) => Math.hypot(x - SPAWN.x, z - SPAWN.z) < r;
  const inWalk = (x, z, m = 1) => Math.abs(x) < WALL + m && Math.abs(z) < WALL + m;
  // collisions : rectangles rangés par carré de 8 m (pour les tests rapides du feu de camp)
  const CG = new Map();
  const box = (x, z, hx, hz = hx) => {
    const c = { x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz };
    colliders.push(c);
    const k = gk(Math.floor(x / 8), Math.floor(z / 8));
    if (!CG.has(k)) CG.set(k, []);
    CG.get(k).push(c);
  };
  // y a-t-il un obstacle (arbre, rocher, tronc) dans ce disque ?
  function blocked(x, z, r) {
    for (let i = Math.floor((x - r - 2) / 8); i <= Math.floor((x + r + 2) / 8); i++) for (let j = Math.floor((z - r - 2) / 8); j <= Math.floor((z + r + 2) / 8); j++) {
      const L = CG.get(gk(i, j));
      if (L) for (const c of L) if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true;
    }
    return false;
  }

  // abords des gués dégagés
  for (const zc of CROSSINGS) for (let k = -5; k <= 5; k++) gAdd(streamX(zc) + k, zc, 1.2);

  // ------------------------------------------------------------------ arbres
  const inner = { spruce: [], birch: [] }, outer = { spruce: [], birch: [] };
  {
    const nIn = Math.round((2 * IN) * (2 * IN) / (mobile ? 26 : 19));
    let count = 0, guard = 0;
    while (count < nIn && guard++ < nIn * 40) {
      const x = (rnd() * 2 - 1) * IN, z = (rnd() * 2 - 1) * IN;
      const cl = clearingAt(x, z);
      if (cl > 0.3 && rnd() > 0.015) continue;
      const d = streamD(x, z);
      if (d < 2.4 || (d < 3.8 && rnd() < 0.7)) continue;
      if (nearSpawn(x, z, 6)) continue;
      if (NZ.fbm(x * 0.03 + 11, z * 0.03, 2) < -0.25 && rnd() < 0.55) continue;
      const isBirch = rnd() < (birchZone(x, z) > 0.05 ? 0.5 : 0.12) + (cl > 0.02 || d < 9 ? 0.25 : 0);
      if (!gClear(x, z, isBirch ? 1.2 : 1.5)) continue;
      const s = isBirch ? 1.0 + rnd() * 0.6 : 1.15 + rnd() * 0.9;
      (isBirch ? inner.birch : inner.spruce).push({ x, z, y: height(x, z) - 0.15, s, rot: rnd() * 6.28 });
      gAdd(x, z, isBirch ? 1.0 : 1.3);
      count++;
      if (inWalk(x, z)) box(x, z, (isBirch ? 0.1 : 0.2) * s + 0.02);
    }
    const OUT = 340;
    const nOut = mobile ? 2600 : 4200;
    count = 0; guard = 0;
    while (count < nOut && guard++ < nOut * 20) {
      const x = (rnd() * 2 - 1) * OUT, z = (rnd() * 2 - 1) * OUT;
      if (Math.abs(x) < IN && Math.abs(z) < IN) continue;
      if (streamD(x, z) < 2.5) continue;
      if (!gClear(x, z, 1.6)) continue;
      const isBirch = rnd() < (birchZone(x, z) > 0.05 ? 0.45 : 0.1);
      (isBirch ? outer.birch : outer.spruce).push({ x, z, y: height(x, z) - 0.15, s: isBirch ? 1.2 + rnd() * 0.7 : 1.4 + rnd() * 1.0, rot: rnd() * 6.28 });
      gAdd(x, z, 1.4);
      count++;
    }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  const setM = (s) => m4.compose(v3.set(s.x, s.y, s.z), q.setFromEuler(e3.set(s.tx || 0, s.rot || 0, s.tz || 0)), sc.set(s.sx ?? s.s, s.sy ?? s.s, s.sz ?? s.s));
  // instances regroupées par carrés, dessinées seulement entre near et far (distance au joueur)
  const chunked = (geo, mat, list, { cast = false, size = 54, color, near = 0, far = 1e9, group = null } = {}) => {
    const cells = new Map();
    for (const s of list) {
      const k = Math.floor(s.x / size) + ',' + Math.floor(s.z / size);
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(s);
    }
    const out = [];
    for (const [k, Ls] of cells) {
      const [ci, cj] = k.split(',').map(Number);
      const m = new THREE.InstancedMesh(geo, mat, Ls.length);
      Ls.forEach((s, i) => { setM(s); m.setMatrixAt(i, m4); if (color) m.setColorAt(i, color(s, i)); s.mesh = m; s.idx = i; });
      m.castShadow = shadows && cast;
      m.receiveShadow = true;
      m.computeBoundingSphere();
      scene.add(m);
      addLod(m, ci * size, cj * size, (ci + 1) * size, (cj + 1) * size, near, far, group);
      out.push(m);
    }
    return out;
  };
  const NEAR = 62; // en deçà : arbres détaillés (et ombres) ; au-delà : arbres simplifiés
  const trunkTint = () => tint.setHSL(0, 0, 0.85 + rnd() * 0.25);
  const crownTint = () => tint.set(pick(P.leaves)).multiplyScalar(0.85 + rnd() * 0.3);
  const tints = new Map();
  const tintOf = (fn) => (s) => { if (!tints.has(s)) tints.set(s, fn().clone()); return tints.get(s); };
  const sTint = tintOf(trunkTint), cTint = tintOf(crownTint);
  chunked(fSpruceGeo, treeMat, inner.spruce, { cast: true, color: sTint, far: NEAR });
  chunked(fSpruceLow, treeMat, inner.spruce, { color: sTint, near: NEAR });
  chunked(birchGeo, treeMat, inner.birch, { cast: true, far: NEAR });
  chunked(birchLow, treeMat, inner.birch, { near: NEAR });
  chunked(spruceGeo, treeMat, outer.spruce, { color: sTint, far: NEAR });
  chunked(spruceLow, treeMat, outer.spruce, { color: sTint, near: NEAR });
  chunked(birchGeo, treeMat, outer.birch, { far: NEAR });
  chunked(birchLow, treeMat, outer.birch, { near: NEAR });
  chunked(fCapGeo, snowCapMat, inner.spruce, { far: NEAR, group: 'caps' });
  chunked(fCapLow, snowCapMat, inner.spruce, { near: NEAR, group: 'caps' });
  chunked(capGeo, snowCapMat, outer.spruce, { far: NEAR, group: 'caps' });
  chunked(capLow, snowCapMat, outer.spruce, { near: NEAR, group: 'caps' });
  if (season.name !== 'hiver') {
    const keep = () => rnd() >= season.autumnBare * 0.9;
    const cIn = inner.birch.filter(keep), cOut = outer.birch.filter(keep);
    chunked(crownGeo, leafMat, cIn, { cast: true, color: cTint, far: NEAR });
    chunked(crownLow, leafMat, cIn, { color: cTint, near: NEAR });
    chunked(crownGeo, leafMat, cOut, { color: cTint, far: NEAR });
    chunked(crownLow, leafMat, cOut, { color: cTint, near: NEAR });
  }

  // ------------------------------------------------------------------ troncs couchés, gués (fusionnés)
  const B = new Builder();
  B.defineMaterial('plain', snowy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), 'bois'));
  {
    let made = 0, guard = 0;
    const nLogs = 64;
    while (made < nLogs && guard++ < 12000) {
      const x = (rnd() * 2 - 1) * (WALL - 8), z = (rnd() * 2 - 1) * (WALL - 8);
      const len = 4 + rnd() * 5, r = 0.2 + rnd() * 0.16, a = rnd() * Math.PI;
      const ca = Math.cos(a), sa = Math.sin(a);
      const pts = [];
      for (let t = -len / 2 - 0.4; t <= len / 2 + 0.41; t += 0.7) pts.push([x + ca * t, z - sa * t]);
      if (pts.some(([px, pz]) => clearingAt(px, pz) > 0.4 || streamD(px, pz) < 2.9 || nearSpawn(px, pz, 7) || !gClear(px, pz, r + 0.6))) continue;
      const h0 = height(x - ca * len / 2, z + sa * len / 2), h1 = height(x + ca * len / 2, z - sa * len / 2);
      const tilt = Math.atan2(h1 - h0, len);
      const y = (h0 + h1) / 2 + r * 0.55;
      B.push(x, y, z, a);
      const part = (g, color) => { g.rotateZ(tilt); B.add(g, color); };
      const bark = pick([0x5e4a3a, 0x67513e, 0x574536]);
      part(new THREE.CylinderGeometry(r * 0.9, r, len, 8).rotateZ(-Math.PI / 2), bark);
      // bout cassé, bois clair
      part(new THREE.CylinderGeometry(r * 0.82, r * 0.82, 0.05, 8).rotateZ(-Math.PI / 2).translate(len / 2 + 0.01, 0, 0), 0xb08a5c);
      // galette de racines, ou bout scié
      if (rnd() < 0.55) {
        const R = r * 2.4;
        part(new THREE.CylinderGeometry(R, R * 1.05, 0.32, 9).rotateZ(-Math.PI / 2).translate(-len / 2 - 0.12, R * 0.45, 0), 0x5a4532);
        for (let k = 0; k < 5; k++) {
          const ang = (k / 5) * Math.PI * 2 + rnd();
          part(new THREE.CylinderGeometry(0.03, 0.07, R * 0.9, 5).rotateZ(-Math.PI / 2 + Math.cos(ang) * 0.6).rotateY(Math.sin(ang) * 0.9).translate(-len / 2 - 0.35, R * 0.45 + Math.cos(ang) * R * 0.6, Math.sin(ang) * R * 0.6), 0x4d3a2a);
        }
        if (inWalk(x, z, 3)) box(x - ca * (len / 2 + 0.12), z + sa * (len / 2 + 0.12), R * 0.75);
      } else {
        part(new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.05, 8).rotateZ(-Math.PI / 2).translate(-len / 2 - 0.01, 0, 0), 0xc39a68);
      }
      // mousse sur le dessus
      const nm = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < nm; k++) {
        const g = new THREE.IcosahedronGeometry(1, 0);
        g.scale(0.35 + rnd() * 0.6, 0.08, r * 0.85);
        g.translate((rnd() - 0.5) * len * 0.8, r * 0.82, (rnd() - 0.5) * r * 0.4);
        part(g, P.moss);
      }
      // moignons de branches
      for (let k = 0; k < 2; k++) {
        part(new THREE.CylinderGeometry(0.025, 0.05, 0.5, 5).rotateX((rnd() - 0.5) * 1.2).translate((rnd() - 0.4) * len * 0.7, r + 0.18, 0), bark);
      }
      B.pop();
      for (const [px, pz] of pts.slice(1, -1)) {
        gAdd(px, pz, r + 0.3);
        if (inWalk(px, pz)) box(px, pz, r + 0.06);
      }
      made++;
    }
  }
  // gués : pierres plates pour traverser le ruisseau
  for (const zc of CROSSINGS) {
    for (let k = -3; k <= 3; k++) {
      const z = zc + (rnd() - 0.5) * 0.3, x = streamX(z) + k * 0.6;
      const top = waterY(z) + 0.12;
      const g = new THREE.CylinderGeometry(0.3 + rnd() * 0.06, 0.36 + rnd() * 0.06, 0.5, 7);
      g.scale(1, 1, 0.85 + rnd() * 0.3);
      g.rotateY(rnd() * 3);
      g.translate(x, top - 0.25, z);
      B.add(g, pick([0x8d8a80, 0x9a968b, 0x83807a]));
    }
  }
  B.build(scene, { shadows });

  // ------------------------------------------------------------------ rochers moussus
  const rockGeos = [0, 1, 2].map((v) => {
    const g = new THREE.IcosahedronGeometry(0.5, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const f = 1 + 0.2 * NZ.noise(x * 2.7 + v * 5, z * 2.7 + y * 1.9 - v * 3);
      p.setXYZ(i, x * f, (y < 0 ? y * 0.7 : y) * f, z * f);
    }
    g.computeVertexNormals();
    const nrmR = g.attributes.normal, cc = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i += 3) {
      const ny = nrmR.getY(i), cx = p.getX(i), cz = p.getZ(i);
      const mossy = ny > 0.3 + 0.25 * NZ.noise(cx * 4 + v, cz * 4);
      col.set(mossy ? P.moss : (i % 2 ? 0x8a877f : 0x7d7a74));
      if (mossy) col.multiplyScalar(0.9 + 0.2 * ((i * 7) % 3) / 2);
      for (let k = 0; k < 3; k++) cc.set([col.r, col.g, col.b], (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    return g;
  });
  const rockMat = snowy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 'roche');
  const rocks = [[], [], []];
  const addRock = (x, z, s) => {
    if (nearSpawn(x, z, 4.5) || streamD(x, z) < 1.75 || !gClear(x, z, 0.45 * s + 0.2)) return false;
    const sx = s * (0.8 + rnd() * 0.5), sy = s * (0.55 + rnd() * 0.35);
    rocks[Math.floor(rnd() * 3)].push({ x, z, y: height(x, z) - 0.12 * sy, sx, sy, sz: s, rot: rnd() * 6.28, tx: (rnd() - 0.5) * 0.3, tz: (rnd() - 0.5) * 0.3 });
    gAdd(x, z, 0.45 * Math.max(sx, s));
    if (s > 0.55 && inWalk(x, z)) box(x, z, 0.4 * Math.max(sx, s));
    return true;
  };
  for (let c = 0; c < 64; c++) {
    const cx = (rnd() * 2 - 1) * (IN - 6), cz = (rnd() * 2 - 1) * (IN - 6);
    const k = 2 + Math.floor(rnd() * 4);
    for (let i = 0; i < k; i++) addRock(cx + (rnd() - 0.5) * 6, cz + (rnd() - 0.5) * 6, 0.6 + rnd() * 1.3);
  }
  for (let i = 0; i < (mobile ? 480 : 720); i++) addRock((rnd() * 2 - 1) * (IN - 6), (rnd() * 2 - 1) * (IN - 6), 0.3 + Math.pow(rnd(), 2) * 1.1);
  for (let i = 0; i < 240; i++) {
    const z = (rnd() * 2 - 1) * IN;
    if (CROSSINGS.some((c) => Math.abs(z - c) < 2.5)) continue;
    addRock(streamX(z) + (rnd() < 0.5 ? -1 : 1) * (1.8 + rnd() * 0.6), z, 0.3 + rnd() * 0.45);
  }
  rocks.forEach((list, i) => chunked(rockGeos[i], rockMat, list, { cast: true, color: () => tint.setHSL(0, 0, 0.88 + rnd() * 0.22), far: 120 }));

  // ------------------------------------------------------------------ sol : herbe, fleurs, fougères, feuilles (dessinés près du joueur)
  const scatter = (count, want, R = IN - 6) => {
    const out = [];
    let g2 = 0;
    while (out.length < count && g2++ < count * 30) {
      const x = (rnd() * 2 - 1) * R, z = (rnd() * 2 - 1) * R;
      const d = streamD(x, z);
      if (d < 1.6) continue;
      const cl = clearingAt(x, z);
      if (rnd() > want(x, z, d, cl)) continue;
      out.push({ x, z, h: height(x, z), d, cl });
    }
    return out;
  };
  const AREA = ((IN - 6) * 2) ** 2 / (190 * 190); // densités de la première version (190 m de côté)
  const GROUND_FAR = 48;
  const tuftGeo = mergeColored([0, 1, 2, 3].map((k) => {
    const b = new THREE.ConeGeometry(0.035, 0.42, 3).translate(0, 0.21, 0);
    b.rotateZ((k - 1.5) * 0.28);
    b.rotateY(k * 1.7);
    return [b, 0xffffff];
  }));
  const tufts = scatter(Math.round((mobile ? 3000 : 5500) * AREA), (x, z, d, cl) => Math.max(cl, smooth(5, 1.6, d) * 0.8, 0.06));
  chunked(tuftGeo, grassMat, tufts.map((t) => ({ x: t.x, y: t.h - 0.1, z: t.z, sx: 1, sy: P.grassH * (0.7 + rnd() * 0.7), sz: 1, rot: rnd() * 6.28 })), { color: () => tint.set(pick(P.grass)).multiplyScalar(1.05 + rnd() * 0.25), size: 27, far: GROUND_FAR, group: 'grass' });
  if (P.flowers.length) {
    const fl = scatter(Math.round((mobile ? 500 : 1000) * AREA), (x, z, d, cl) => cl * 0.9 + smooth(4, 1.8, d) * 0.15);
    const fGeo = mergeColored([
      [new THREE.CylinderGeometry(0.008, 0.01, 0.3, 3).translate(0, 0.15, 0), 0x5d8a3e],
      [new THREE.IcosahedronGeometry(0.06, 0).translate(0, 0.32, 0), 0xffffff],
    ]);
    chunked(fGeo, grassMat, fl.map((t) => ({ x: t.x, y: t.h - 0.1, z: t.z, s: 0.8 + rnd() * 0.6, rot: 0 })), { color: () => tint.set(pick(P.flowers)), size: 27, far: GROUND_FAR, group: 'flowers' });
  }
  // fougère : 7 frondes arquées, plus claires au bout
  const fernGeo = (() => {
    const parts = [];
    for (let f = 0; f < 7; f++) {
      const g = new THREE.PlaneGeometry(0.24, 1, 1, 5);
      const p = g.attributes.position, cc = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const t = p.getY(i) + 0.5, w = p.getX(i) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.02)), 0.7);
        p.setXYZ(i, w, 0.9 * (1.1 * t - 0.75 * t * t), 0.9 * (0.3 * t + 0.55 * t * t));
        const l = 0.55 + 0.45 * t;
        cc.set([l, l, l], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      g.rotateX((f % 2 ? 0.12 : -0.1));
      g.rotateY((f / 7) * Math.PI * 2 + (f % 3) * 0.2);
      g.computeVertexNormals();
      parts.push(g.toNonIndexed());
    }
    return merge(parts);
  })();
  const fernSpots = scatter(Math.round((mobile ? 1100 : 2200) * AREA), (x, z, d, cl) => (1 - cl) * (0.3 + 0.7 * smooth(10, 2, d)) * (NZ.fbm(x * 0.05 - 7, z * 0.05 + 3, 2) > -0.1 ? 1 : 0.25) * (season.name === 'hiver' ? 0.5 : 1))
    .filter((t) => !nearSpawn(t.x, t.z, 3) && gClear(t.x, t.z, 0.35));
  chunked(fernGeo, fernMat, fernSpots.map((t) => ({ x: t.x, y: t.h - 0.08, z: t.z, s: (1.1 + rnd() * 0.8) * (season.name === 'hiver' ? 0.8 : 1), rot: rnd() * 6.28 })), { color: () => tint.set(pick(P.fern)).multiplyScalar(0.9 + rnd() * 0.25), size: 27, far: 64, group: 'ferns' });
  if (season.name === 'automne') {
    const lv = scatter(Math.round((mobile ? 1600 : 3200) * AREA), (x, z, d, cl) => (leafy(x, z) ? 1 : 0.15) * (1 - cl * 0.7));
    const lGeo = new THREE.CircleGeometry(0.08, 4).rotateX(-Math.PI / 2);
    const lMat = new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide });
    chunked(lGeo, lMat, lv.map((t) => ({ x: t.x, y: t.h - 0.04 + rnd() * 0.02, z: t.z, sx: 1 + rnd(), sy: 1, sz: 0.6 + rnd() * 0.6, rot: rnd() * 6.28 })), { color: () => tint.set(pick(P.leaves)), size: 27, far: GROUND_FAR, group: 'leaves' });
  }

  // ------------------------------------------------------------------ nuages (3 couches)
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000, flatShading: true, fog: false, transparent: true, opacity: 0 });
  const clouds = new THREE.Group();
  const layers = [];
  for (let Ly = 0; Ly < 3; Ly++) {
    const parts = [];
    const nC = [10, 14, 20][Ly];
    for (let i = 0; i < nC; i++) {
      const a = rnd() * Math.PI * 2, r = 200 + rnd() * 1800, y = 260 + rnd() * 200 + Ly * 40;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r, size = 30 + rnd() * 45;
      const puffs = 5 + Math.floor(rnd() * 5);
      for (let k = 0; k < puffs; k++) {
        const g = new THREE.IcosahedronGeometry(size * (0.55 + rnd() * 0.5), 1);
        g.scale(1.3, 0.55, 1);
        g.translate(cx + (k - puffs / 2) * size * 0.75 + rnd() * 10, y + rnd() * size * 0.3, cz + (rnd() - 0.5) * size);
        parts.push([g, 0xffffff]);
      }
    }
    const mesh = new THREE.Mesh(mergeColored(parts), cloudMat.clone());
    mesh.material.vertexColors = true;
    clouds.add(mesh);
    layers.push(mesh);
  }
  scene.add(clouds);

  // ------------------------------------------------------------------ pluie et neige : autour de toi
  const NRAIN = mobile ? 7000 : 14000, BOX = 22;
  const rs = new Float32Array(NRAIN * 2 * 4), tip = new Float32Array(NRAIN * 2);
  for (let i = 0; i < NRAIN; i++) {
    const sx = (rnd() * 2 - 1) * BOX, sz = (rnd() * 2 - 1) * BOX, sy = rnd() * 30, w = rnd();
    for (let e = 0; e < 2; e++) { rs.set([sx, sz, sy, w], (i * 2 + e) * 4); tip[i * 2 + e] = e; }
  }
  const rgeo = new THREE.BufferGeometry();
  rgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NRAIN * 6), 3));
  rgeo.setAttribute('seed', new THREE.BufferAttribute(rs, 4));
  rgeo.setAttribute('tip', new THREE.BufferAttribute(tip, 1));
  const camU = { value: new THREE.Vector3() };
  const rainU = { uTime: uniforms.uTime, uCam: camU, uAmount: { value: 0 }, uWindXZ: { value: new THREE.Vector2(1.5, 0.5) }, uColor: { value: new THREE.Color(0xdde4ec) } };
  const wrapXZ = `vec2 c = uCam.xz; vec2 q = c + mod(seed.xy - c + ${BOX.toFixed(1)}, ${(2 * BOX).toFixed(1)}) - ${BOX.toFixed(1)};`;
  const rain = new THREE.LineSegments(rgeo, new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false,
    vertexShader: `uniform float uTime; uniform float uAmount; uniform vec2 uWindXZ; uniform vec3 uCam; attribute vec4 seed; attribute float tip; varying float vA;
      void main(){ ${wrapXZ} float y = uCam.y - 8.0 + mod(seed.z - uTime * 9.0, 30.0);
        vec3 p = vec3(q.x, y, q.y) + vec3(uWindXZ.x, 0.0, uWindXZ.y) * ((y - uCam.y) * 0.06);
        p += vec3(uWindXZ.x * 0.07, 0.85, uWindXZ.y * 0.07) * tip;
        vA = step(seed.w, uAmount);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main(){ if (vA < 0.5) discard; gl_FragColor = vec4(uColor, 0.5); }`,
  }));
  rain.frustumCulled = false;
  scene.add(rain);
  const NSNOW = mobile ? 3000 : 6000;
  const ss = new Float32Array(NSNOW * 4);
  for (let i = 0; i < NSNOW; i++) ss.set([(rnd() * 2 - 1) * BOX, (rnd() * 2 - 1) * BOX, rnd() * 24, rnd()], i * 4);
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NSNOW * 3), 3));
  sgeo.setAttribute('seed', new THREE.BufferAttribute(ss, 4));
  const snowU = { uTime: uniforms.uTime, uCam: camU, uAmount: { value: 0 }, uWindXZ: rainU.uWindXZ, uScale: { value: innerHeight * 0.5 } };
  const snow = new THREE.Points(sgeo, new THREE.ShaderMaterial({
    uniforms: snowU, transparent: true, depthWrite: false,
    vertexShader: `uniform float uTime; uniform float uAmount; uniform vec2 uWindXZ; uniform float uScale; uniform vec3 uCam; attribute vec4 seed; varying float vA;
      void main(){ ${wrapXZ} float t = uTime * (0.9 + seed.w * 0.6); float y = uCam.y - 6.0 + mod(seed.z - t, 24.0);
        vec3 p = vec3(q.x + sin(t * 0.7 + seed.w * 20.0) * 0.6, y, q.y + cos(t * 0.5 + seed.w * 13.0) * 0.6) + vec3(uWindXZ.x, 0.0, uWindXZ.y) * ((y - uCam.y) * 0.08);
        vA = step(seed.w, uAmount);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_PointSize = (0.11 + seed.w * 0.09) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA;
      void main(){ if (vA < 0.5) discard; float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.0, 0.85 * (1.0 - d * 1.6)); }`,
  }));
  snow.frustumCulled = false;
  scene.add(snow);

  // ------------------------------------------------------------------ où l'on peut marcher (murs invisibles, ruisseau, gués)
  const atCrossing = (z) => CROSSINGS.some((c) => Math.abs(z - c) < 1.0);
  const HW = 1.3; // demi-largeur du ruisseau qu'on ne traverse qu'aux gués
  function groundAt(x, z) {
    const h = height(x, z) - 0.06;
    if (streamD(x, z) < 2.0 && atCrossing(z)) return Math.max(h, waterY(z) + 0.12);
    return h;
  }
  function clamp(p) {
    p.x = Math.min(WALL, Math.max(-WALL, p.x));
    p.z = Math.min(WALL, Math.max(-WALL, p.z));
    const dx = p.x - streamX(p.z);
    if (Math.abs(dx) < HW && !atCrossing(p.z)) p.x = streamX(p.z) + (dx < 0 ? -HW : HW);
    return p;
  }
  // sol sous les pieds, pour les bruits de pas
  function surfaceAt(x, z, snowCover) {
    if (snowCover > 0.4) return 'neige';
    const d = streamD(x, z);
    if (d < 1.6) return 'terre';
    if (clearingAt(x, z) > 0.45 || d < 4) return 'herbe';
    if (leafy(x, z)) return 'feuilles';
    return 'terre';
  }

  // ------------------------------------------------------------------ mise à jour
  let snowShown = -1, lodTimer = 0;
  const deep = new THREE.Color(), tmp = new THREE.Color();
  function updateLods(cam) {
    for (const L of lods) {
      const dx = Math.max(L.x0 - cam.x, 0, cam.x - L.x1), dz = Math.max(L.z0 - cam.z, 0, cam.z - L.z1);
      const d = Math.hypot(dx, dz);
      L.mesh.visible = d >= L.near && d < L.far && !(L.group && hiddenGroups.has(L.group));
    }
  }
  function update(t, dt, w, sky, cam) {
    uniforms.uTime.value = t;
    uniforms.uWind.value = 0.1 + w.wind * 0.9;
    camU.value.copy(cam);
    rainU.uAmount.value = w.rain;
    rainU.uWindXZ.value.set(0.6 + w.wind * 6, 0.3 + w.wind * 2);
    snowU.uAmount.value = w.snow;
    snowU.uScale.value = innerHeight * Math.min(devicePixelRatio, 2) * 0.5;
    const sAmt = Math.max(smooth(0.0, 0.06, w.snowDepth || 0), w.snow * 0.5);
    if (Math.abs(sAmt - snowShown) > 0.02) {
      snowShown = sAmt;
      for (const T of terrains) {
        for (let i = 0; i < T.cur.length; i++) T.cur[i] = lerp(T.base[i], T.snow[i], sAmt);
        T.geo.attributes.color.needsUpdate = true;
      }
      const hide = (g, on) => (on ? hiddenGroups.add(g) : hiddenGroups.delete(g));
      hide('caps', sAmt <= 0.25);
      hide('grass', sAmt >= 0.6);
      hide('flowers', sAmt >= 0.4);
      hide('leaves', sAmt >= 0.5);
      hide('ferns', sAmt >= 0.7);
      snowAmt.value = smooth(0.15, 0.8, sAmt);
      lodTimer = 0;
    }
    lodTimer -= dt;
    if (lodTimer <= 0) { lodTimer = 0.25; updateLods(cam); }
    // nuages
    clouds.rotation.y += dt * (0.0008 + w.wind * 0.003);
    const cov = w.cloud;
    const grey = Math.min(1, w.rain * 0.8 + w.snow * 0.5 + smooth(0.7, 1, cov) * 0.4);
    tmp.set(0xffffff).lerp(deep.set(0x8a929c), grey);
    layers.forEach((m, i) => {
      m.material.opacity = [smooth(0.05, 0.3, cov), smooth(0.3, 0.6, cov), smooth(0.6, 0.9, cov)][i] * (1 - w.fog * 0.6);
      m.visible = m.material.opacity > 0.01;
      m.material.color.copy(tmp);
      m.material.emissive.copy(sky.horizon).multiplyScalar(0.55 + grey * 0.3);
    });
    // ruisseau : eau claire qui reflète le ciel
    const day = sky.day;
    deep.set(0x0a1214).lerp(tmp.set(0x2f5a54), day).lerp(tmp.set(0x5a6a66), Math.min(1, cov * 0.4 + w.rain * 0.4) * day);
    waterMat.color.copy(deep);
    wU.uSky.value.copy(sky.horizon);
    waterMat.roughness = 0.1 + w.rain * 0.3;
  }

  return {
    update, groundAt, clamp, surfaceAt, colliders, streamDist: streamD, spawn: SPAWN,
    // pour les objets au sol et le feu de camp
    clearingAt, leafy, blocked, isFree: gClear, addLod, chunked, inWalk,
    snowShown: () => snowShown, _lods: lods, _hidden: hiddenGroups,
  };
}
