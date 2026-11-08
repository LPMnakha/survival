// Modèles des objets (low poly, couleurs portées par les sommets), partagés
// entre le sol, la main du joueur et le feu de camp.
import * as THREE from '../vendor/three.module.min.js';
import { mergeColored } from './builder.js';

export const ITEMS = {
  caillou: { one: 'caillou', many: 'cailloux', stack: 10 },
  brindille: { one: 'brindille', many: 'brindilles', stack: 10 },
  baton: { one: 'bâton', many: 'bâtons', stack: 10 },
  'pierre-a-feu': { one: 'pierre à feu', many: 'pierres à feu', stack: 1 },
  bache: { one: 'bâche', many: 'bâches', stack: 1 },
  bouteille: { one: 'bouteille', many: 'bouteilles', stack: 1 },
  sacoche: { one: 'sacoche', many: 'sacoches', stack: 1, wear: 'sac' },
  baies: { one: 'poignée de baies', many: 'poignées de baies', stack: 10 },
  silex: { one: 'silex', many: 'silex', stack: 10 },
  feuille: { one: 'feuille', many: 'feuilles', stack: 10 },
  fibre: { one: 'fibre', many: 'fibres', stack: 10 },
  corde: { one: 'corde', many: 'cordes', stack: 10 },
  couteau: { one: 'couteau artisanal', many: 'couteaux artisanaux', stack: 1 },
  lance: { one: 'lance', many: 'lances', stack: 1 },
  carte: { one: 'carte', many: 'cartes', stack: 1 },
};
// « un caillou », « une bâche »…
const FEM = new Set(['brindille', 'pierre-a-feu', 'bache', 'bouteille', 'sacoche', 'baies', 'feuille', 'fibre', 'corde', 'lance', 'carte']);
export const anItem = (type) => (FEM.has(type) ? 'une ' : 'un ') + ITEMS[type].one;
export const theItem = (type) => (FEM.has(type) ? 'cette ' : type === 'baies' ? 'ces ' : 'ce ') + ITEMS[type].one;
export const itemName = (type, n = 1) => (n > 1 ? ITEMS[type].many : ITEMS[type].one);

// géométries posées à plat, centrées, axe long selon x
const cache = {};
export function itemGeometry(type, variant = 0) {
  const key = type + variant;
  if (cache[key]) return cache[key];
  if ((type === 'couteau' || type === 'lance') && variant === 1) {
    const lying = itemGeometry(type, 0).clone().rotateZ(-Math.PI / 2).translate(type === 'lance' ? -0.85 : -0.07, 0.022, 0);
    cache[key] = lying;
    return lying;
  }
  let g;
  if (type === 'caillou') {
    const s = [1, 1.12, 0.92][variant % 3];
    const b = new THREE.IcosahedronGeometry(0.065 * s, 0);
    b.scale(1.25, 0.72, 1);
    b.translate(0, 0.03 * s, 0);
    g = mergeColored([[b, [0x9a968e, 0x8d8a84, 0xa29d93][variant % 3]]]);
  } else if (type === 'brindille') {
    const main = new THREE.CylinderGeometry(0.007, 0.011, 0.34, 4).rotateZ(Math.PI / 2);
    const s1 = new THREE.CylinderGeometry(0.004, 0.006, 0.11, 3).translate(0, 0.055, 0).rotateZ(-0.9).rotateY(0.5).translate(0.05, 0, 0);
    const s2 = new THREE.CylinderGeometry(0.004, 0.006, 0.09, 3).translate(0, 0.045, 0).rotateZ(0.9).rotateY(-0.6).translate(-0.07, 0, 0);
    const s3 = new THREE.CylinderGeometry(0.003, 0.005, 0.07, 3).translate(0, 0.035, 0).rotateZ(-0.8).rotateY(2.4).translate(-0.01, 0, 0);
    g = mergeColored([[main, 0x8a6c4c], [s1, 0x947454], [s2, 0x7f6446], [s3, 0x947454]]);
    g.translate(0, 0.011, 0);
  } else if (type === 'baton') {
    const L = 0.72;
    const main = new THREE.CylinderGeometry(0.022, 0.028, L, 6).rotateZ(Math.PI / 2);
    const e1 = new THREE.CylinderGeometry(0.021, 0.021, 0.006, 6).rotateZ(Math.PI / 2).translate(L / 2 + 0.002, 0, 0);
    const e2 = new THREE.CylinderGeometry(0.027, 0.027, 0.006, 6).rotateZ(Math.PI / 2).translate(-L / 2 - 0.002, 0, 0);
    const stub = new THREE.CylinderGeometry(0.008, 0.012, 0.07, 4).translate(0, 0.035, 0).rotateZ(-0.7).translate(0.12, 0.015, 0);
    g = mergeColored([[main, 0x5f4a38], [e1, 0xb59066], [e2, 0xa9845c], [stub, 0x5a4636]]);
    g.translate(0, 0.028, 0);
  } else if (type === 'pierre-a-feu') {
    // tige de ferrocérium (métal sombre) dans un manche en bois, axe selon +y
    const handle = new THREE.CylinderGeometry(0.012, 0.013, 0.07, 7).translate(0, 0.035, 0);
    const ring = new THREE.CylinderGeometry(0.0135, 0.0135, 0.006, 7).translate(0, 0.072, 0);
    const rod = new THREE.CylinderGeometry(0.0075, 0.0075, 0.11, 6).translate(0, 0.075 + 0.055, 0);
    const hole = new THREE.TorusGeometry(0.007, 0.0025, 4, 6).rotateY(Math.PI / 2).translate(0, -0.004, 0);
    g = mergeColored([[handle, 0x8a5a36], [ring, 0x6b6f74], [rod, 0x3c3d42], [hole, 0x6b6f74]]);
  } else if (type === 'bache') {
    // bâche bleue pliée, avec ses œillets
    const b = new THREE.BoxGeometry(0.34, 0.07, 0.26, 2, 1, 2);
    const p = b.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, p.getY(i) - Math.abs(p.getX(i)) * 0.08);
    b.computeVertexNormals();
    b.translate(0, 0.035, 0);
    const fold = new THREE.BoxGeometry(0.34, 0.012, 0.03).translate(0, 0.065, 0.06);
    const e1 = new THREE.CylinderGeometry(0.012, 0.012, 0.008, 6).translate(0.15, 0.072, 0.11);
    const e2 = new THREE.CylinderGeometry(0.012, 0.012, 0.008, 6).translate(-0.15, 0.072, 0.11);
    g = mergeColored([[b, 0x3f7fb8], [fold, 0x356fa3], [e1, 0xc8ccd0], [e2, 0xc8ccd0]]);
  } else if (type === 'bouteille') {
    // bouteille en plastique (axe selon +y), bouchon bleu
    const body = new THREE.CylinderGeometry(0.036, 0.036, 0.2, 8).translate(0, 0.1, 0);
    const shoulder = new THREE.CylinderGeometry(0.014, 0.036, 0.05, 8).translate(0, 0.225, 0);
    const neck = new THREE.CylinderGeometry(0.014, 0.014, 0.02, 8).translate(0, 0.26, 0);
    const cap = new THREE.CylinderGeometry(0.016, 0.016, 0.018, 8).translate(0, 0.278, 0);
    const label = new THREE.CylinderGeometry(0.0365, 0.0365, 0.07, 8).translate(0, 0.11, 0);
    g = mergeColored([[body, 0xbfd8e2], [shoulder, 0xbfd8e2], [neck, 0xbfd8e2], [cap, 0x2d6fb3], [label, 0xe9e3d3]]);
  } else if (type === 'sacoche') {
    // petite sacoche en toile, rabat et bandoulière
    const bag = new THREE.BoxGeometry(0.26, 0.18, 0.09).translate(0, 0.09, 0);
    const flap = new THREE.BoxGeometry(0.265, 0.09, 0.095).translate(0, 0.15, 0.003);
    const buckle = new THREE.BoxGeometry(0.03, 0.03, 0.01).translate(0, 0.11, 0.05);
    const strap = new THREE.TorusGeometry(0.15, 0.008, 4, 10, Math.PI).translate(0, 0.18, 0);
    g = mergeColored([[bag, 0x6b5a3e], [flap, 0x5e4e35], [buckle, 0xb8a170], [strap, 0x4d3f2b]]);
  } else if (type === 'baies') {
    // une poignée de baies rouges sur leurs feuilles
    const parts = [[new THREE.IcosahedronGeometry(0.05, 0).scale(1.3, 0.25, 1).translate(0, 0.01, 0), 0x4f7a37]];
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4, r = 0.012 + (k % 3) * 0.012;
      parts.push([new THREE.IcosahedronGeometry(0.011, 0).translate(Math.cos(a) * r, 0.024 + (k % 2) * 0.01, Math.sin(a) * r), k % 4 ? 0xb3263a : 0x8e1c34]);
    }
    g = mergeColored(parts);
  } else if (type === 'silex') {
    // rognon de silex : noir bleuté, éclats nets, un reste de cortex crayeux
    const b = new THREE.IcosahedronGeometry(0.055, 0);
    const p = b.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1.3 + 0.25 * Math.sin(i * 1.7 + variant)), p.getY(i) * 0.7, p.getZ(i) * (0.95 + 0.2 * Math.cos(i * 2.3)));
    b.computeVertexNormals();
    b.translate(0, 0.035, 0);
    const n = b.attributes.position.count, cc = new Float32Array(n * 3), c = new THREE.Color();
    for (let i = 0; i < n; i += 3) {
      const cortex = b.attributes.position.getY(i) > 0.05 && i % 4 === 0;
      c.set(cortex ? 0xd8d2c4 : [0x3a3c45, 0x2f3139, 0x464955][(i / 3) % 3]);
      for (let k = 0; k < 3; k++) cc.set([c.r, c.g, c.b], (i + k) * 3);
    }
    b.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    g = b;
  } else if (type === 'couteau') {
    // lame de silex taillée (axe +y), retouchée sur les bords, talon gainé de fibres
    const blade = new THREE.BufferGeometry();
    const P = [[0, 0.17, 0], [0.022, 0.06, 0.006], [0.018, 0.0, 0], [-0.018, 0.0, 0], [-0.016, 0.07, 0.004], [0, 0.08, 0.012], [0, 0.08, -0.008]];
    const tri = [[0, 1, 5], [0, 5, 4], [1, 2, 5], [2, 3, 5], [3, 4, 5], [0, 4, 6], [0, 6, 1], [1, 6, 2], [2, 6, 3], [3, 6, 4]];
    const pos = [];
    for (const t of tri) for (const k of t) pos.push(...P[k]);
    blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    blade.computeVertexNormals();
    const wrap = new THREE.CylinderGeometry(0.02, 0.021, 0.06, 7).scale(1, 1, 0.55).translate(0, -0.02, 0);
    const knot = new THREE.TorusGeometry(0.02, 0.004, 4, 8).rotateX(Math.PI / 2).scale(1, 1, 0.6).translate(0, 0.008, 0);
    g = mergeColored([[blade, 0x3a3c45], [wrap, 0xa89268], [knot, 0x8a7550]]);
  } else if (type === 'lance') {
    // bâton droit (axe +y, 1,7 m) avec la lame de silex ligaturée au bout
    const shaft = new THREE.CylinderGeometry(0.016, 0.02, 1.62, 6).translate(0, 0.81, 0);
    const tip = new THREE.ConeGeometry(0.022, 0.13, 4).scale(1, 1, 0.4).translate(0, 1.68, 0);
    const lash = new THREE.CylinderGeometry(0.021, 0.021, 0.07, 6).translate(0, 1.6, 0);
    const lash2 = new THREE.TorusGeometry(0.02, 0.004, 4, 8).rotateX(Math.PI / 2).translate(0, 1.57, 0);
    g = mergeColored([[shaft, 0x6a5240], [tip, 0x3a3c45], [lash, 0xa89268], [lash2, 0x8a7550]]);
  } else if (type === 'feuille') {
    // grande fronde de fougère posée à plat (axe long selon x)
    const parts = [[new THREE.BoxGeometry(0.36, 0.004, 0.008).translate(0, 0.006, 0), 0x5f8a3e]];
    for (let k = 0; k < 9; k++) {
      const x = -0.15 + k * 0.035, L = 0.075 * Math.sin(Math.PI * (k + 1) / 10);
      for (const s of [-1, 1]) {
        const pin = new THREE.BoxGeometry(0.016, 0.003, L).translate(0, 0.006, s * L / 2).rotateY(s * 0.35).translate(x, 0, 0);
        parts.push([pin, k % 2 ? 0x77a84e : 0x6a9a46]);
      }
    }
    g = mergeColored(parts);
  } else if (type === 'fibre') {
    // botte de fibres végétales, nouée au milieu
    const parts = [];
    for (let k = 0; k < 7; k++) {
      const f = new THREE.CylinderGeometry(0.0025, 0.0025, 0.3, 3).rotateZ(Math.PI / 2 + (k - 3) * 0.04).translate(0, 0.006 + (k % 3) * 0.003, (k - 3) * 0.004);
      parts.push([f, k % 2 ? 0xb9b07a : 0xa59c66]);
    }
    parts.push([new THREE.TorusGeometry(0.012, 0.003, 4, 8).rotateY(Math.PI / 2).translate(0, 0.009, 0), 0x7f774c]);
    g = mergeColored(parts);
  } else if (type === 'corde') {
    // corde enroulée (bobine plate)
    const parts = [];
    for (let k = 0; k < 3; k++) parts.push([new THREE.TorusGeometry(0.05 - k * 0.012, 0.008, 5, 14).rotateX(Math.PI / 2).translate(0, 0.009 + k * 0.004, 0), k % 2 ? 0xa48d62 : 0xb59e70]);
    parts.push([new THREE.CylinderGeometry(0.006, 0.006, 0.06, 4).rotateZ(Math.PI / 2).translate(0.07, 0.008, 0.02), 0xa48d62]);
    g = mergeColored(parts);
  } else if (type === 'carte') {
    // carte pliée en trois, papier jauni, quelques traits à l'encre
    const parts = [];
    for (let k = 0; k < 3; k++) {
      const p = new THREE.BoxGeometry(0.055, 0.004, 0.13).rotateZ((k - 1) * 0.08).translate((k - 1) * 0.054, 0.004 + (k === 1 ? 0.001 : 0), 0);
      parts.push([p, k === 1 ? 0xe6d8b6 : 0xdccca6]);
    }
    for (let k = 0; k < 4; k++) parts.push([new THREE.BoxGeometry(0.03 + (k % 2) * 0.02, 0.0012, 0.003).translate(-0.04 + k * 0.028, 0.0068, -0.03 + (k % 3) * 0.025), 0x6a5038]);
    parts.push([new THREE.BoxGeometry(0.004, 0.0012, 0.09).rotateY(0.4).translate(0.01, 0.0068, 0.005), 0x3d6b86]);
    g = mergeColored(parts);
  } else if (type === 'grattoir') {
    const plate = new THREE.BoxGeometry(0.06, 0.03, 0.004);
    const edge = new THREE.BoxGeometry(0.06, 0.005, 0.0045).translate(0, 0.015, 0);
    g = mergeColored([[plate, 0x8f959b], [edge, 0xc9ced3]]);
  }
  cache[key] = g;
  return g;
}

export const itemMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
export const metalMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.5, flatShading: true });
export const plasticMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, flatShading: true });
export const matFor = (type) => (type === 'pierre-a-feu' || type === 'grattoir' ? metalMaterial : type === 'bouteille' || type === 'bache' || type === 'silex' || type === 'couteau' ? plasticMaterial : itemMaterial);

// petites icônes (SVG en ligne) pour l'inventaire
export const ICONS = {
  caillou: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 21.5 9 13l7-4 8 2.5 3.5 7-2.5 5.5H10z" fill="#a39e95"/><path d="M9 13l7-4 8 2.5-6 3.5z" fill="#c4bfb5"/><path d="M18 14.5l9.5 4L25 24h-7z" fill="#857f77"/></svg>',
  brindille: '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="#b08a62" stroke-linecap="round"><path d="M5 25 27 8" stroke-width="2.2"/><path d="M13 19l-2-6M19 14.5l5 1.5M9 22.5l-4.5-1" stroke-width="1.5"/></g></svg>',
  baton: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4.5 25.5 25 5" stroke="#7a5e45" stroke-width="5" stroke-linecap="round"/><circle cx="25" cy="5" r="2.2" fill="#c49c6e"/><path d="M14 15.5l3.5 3" stroke="#6a5038" stroke-width="2" stroke-linecap="round"/></svg>',
  bache: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 11.5 16 8l11 3.5v9L16 24 5 20.5z" fill="#3f7fb8"/><path d="M5 11.5 16 8l11 3.5L16 15z" fill="#5a98cc"/><circle cx="7.5" cy="13" r="1.1" fill="#d6dade"/><circle cx="24.5" cy="13" r="1.1" fill="#d6dade"/></svg>',
  sacoche: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 12a7 7 0 0 1 14 0" fill="none" stroke="#5e4e35" stroke-width="2"/><rect x="6" y="12" width="20" height="14" rx="3" fill="#7a6747"/><path d="M6 15a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3H6z" fill="#665538"/><rect x="14.5" y="16.5" width="3" height="3" rx=".6" fill="#c9b27e"/></svg>',
  baies: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 22c3-8 9-12 18-13-3 7-9 11-18 13z" fill="#5f8f42"/><g fill="#c2304a"><circle cx="11" cy="19" r="3.2"/><circle cx="16.5" cy="21.5" r="3"/><circle cx="14" cy="15" r="2.8"/><circle cx="19.5" cy="16.5" r="2.6"/></g><g fill="#f4b3bd"><circle cx="10" cy="18" r=".8"/><circle cx="15.6" cy="20.6" r=".7"/><circle cx="13.2" cy="14.2" r=".7"/></g></svg>',
  silex: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 19 10 10l9-3 7 6-2 9-11 3z" fill="#3a3c45"/><path d="M10 10l9-3 7 6-9 2z" fill="#5a5d6a"/><path d="M6 19l4-9 7 5-4 10z" fill="#2c2e35"/><path d="M19 7l4 1-2 3z" fill="#ddd6c6"/></svg>',
  couteau: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M23 4 26.5 7 14 20l-3-1z" fill="#4a4d58"/><path d="M23 4l3.5 3-6 6z" fill="#6b6f7c"/><path d="M11 19l3 1-4 6.5c-.8 1.2-2.6.6-2.5-.8z" fill="#b39d72"/><path d="M9.3 21.5l3 1.5M8.5 23.5l2.7 1.4" stroke="#8a7550" stroke-width="1.1"/></svg>',
  lance: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 28 22 10" stroke="#7a5e45" stroke-width="2.6" stroke-linecap="round"/><path d="M27.5 4.5 21 8l3 3z" fill="#4a4d58"/><path d="M20 10.5l2.5 2.5" stroke="#b39d72" stroke-width="3.2"/></svg>',
  feuille: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 27C8 15 15 8 27 5" fill="none" stroke="#5f8a3e" stroke-width="1.6" stroke-linecap="round"/><g fill="#79aa50"><path d="M9 21l-4.5-1 2.5 3.5zM9 21l1.5 4.5 1.5-4zM13 16l-4.5-1.5 2.8 3.7zM13 16l1.8 4.6 1.2-4.3zM17.5 12l-4.2-1.8 2.8 3.5zM17.5 12l2 4.2 1-4zM22 8.5l-3.6-1.8 2.4 3zM22 8.5l1.7 3.6.9-3.4z"/></g></svg>',
  fibre: '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-width="1.4"><path d="M4 20c8-3 16-5 24-9" stroke="#b9b07a"/><path d="M4 22c8-2 16-5 24-8" stroke="#a59c66"/><path d="M5 24c8-3 15-6 23-10" stroke="#c6be8a"/></g><path d="M14.5 15.5l2.5 6" stroke="#7f774c" stroke-width="2.4" stroke-linecap="round"/></svg>',
  corde: '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke-width="2.6"><circle cx="16" cy="16" r="10" stroke="#b59e70"/><circle cx="16" cy="16" r="6.2" stroke="#a48d62"/><circle cx="16" cy="16" r="2.6" stroke="#b59e70"/></g><path d="M25 19c2 1 3 3 3.5 6" fill="none" stroke="#a48d62" stroke-width="2.4" stroke-linecap="round"/></svg>',
  carte: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 8l8-3 8 3 8-3v19l-8 3-8-3-8 3z" fill="#e6d8b6"/><path d="M12 5v19M20 8v19" stroke="#bfae86" stroke-width="1"/><path d="M6 14c3-2 5 1 8-1s5-3 8-1 3 1 4 0" fill="none" stroke="#3d6b86" stroke-width="1.4" stroke-linecap="round"/><path d="M15 19l2 2m0-2-2 2" stroke="#8a3a2a" stroke-width="1.4" stroke-linecap="round"/></svg>',
  'pierre-a-feu': '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="13" y="16" width="6.5" height="12" rx="2.5" fill="#9a6a42"/><rect x="14.6" y="3.5" width="3.3" height="13" rx="1.2" fill="#55575e"/><g fill="#f0b46a"><circle cx="23" cy="6" r="1.1"/><circle cx="25.5" cy="10" r="0.8"/><circle cx="22" cy="11" r="0.7"/></g></svg>',
};

// bouteille : icône avec le niveau d'eau (0..1000 ml)
export function bottleIcon(ml = 0) {
  const k = Math.max(0, Math.min(1, ml / 1000)), top = 27 - 16 * k;
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><defs><clipPath id="bt"><path d="M12 11c0-1.5 1.5-2.5 2.5-3V6h3v2c1 .5 2.5 1.5 2.5 3v15a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/></clipPath></defs><path d="M12 11c0-1.5 1.5-2.5 2.5-3V6h3v2c1 .5 2.5 1.5 2.5 3v15a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" fill="#cfe3ea" opacity=".55"/><rect x="11" y="${top.toFixed(1)}" width="10" height="${(28 - top).toFixed(1)}" fill="#5aa9d6" clip-path="url(#bt)"/><rect x="14" y="3.5" width="4" height="3" rx=".8" fill="#2d6fb3"/><path d="M12 11c0-1.5 1.5-2.5 2.5-3V6h3v2c1 .5 2.5 1.5 2.5 3v15a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" fill="none" stroke="#e6f1f5" stroke-width="1"/></svg>`;
}
export const fmtWater = (ml) => (ml >= 1000 ? '1 L' : ml <= 0 ? 'vide' : `${Math.round(ml / 10)} cl`);

// cases d'équipement (icônes au trait quand la case est vide)
export const EQUIP_SLOTS = [
  { id: 'tete', name: 'Tête', icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 20a8 8 0 0 1 16 0z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 20h20v3H6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="10" r="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>' },
  { id: 'haut', name: 'Haut', icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 6 6 9.5l2.5 5L11 13v13h10V13l2.5 1.5 2.5-5L20 6a4 4 0 0 1-8 0z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' },
  { id: 'bas', name: 'Bas', icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 6h12l1.5 20h-4.5L16 13l-3 13H8.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' },
  { id: 'chaussures', name: 'Chaussures', icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 12h7l1 5 9 2.5c2 .6 3 2 3 3.5v1H6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 21h20" stroke="currentColor" stroke-width="1.4"/></svg>' },
  { id: 'sac', name: 'Sac', icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 10V8.5a5 5 0 0 1 10 0V10" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="8" y="10" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 17h10" stroke="currentColor" stroke-width="1.4"/></svg>' },
];
