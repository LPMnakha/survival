// Modèles des objets (low poly, couleurs portées par les sommets), partagés
// entre le sol, la main du joueur et le feu de camp.
import * as THREE from '../vendor/three.module.min.js';
import { mergeColored } from './builder.js';

export const ITEMS = {
  caillou: { one: 'caillou', many: 'cailloux', stack: 10 },
  brindille: { one: 'brindille', many: 'brindilles', stack: 10 },
  baton: { one: 'bâton', many: 'bâtons', stack: 10 },
  'pierre-a-feu': { one: 'pierre à feu', many: 'pierres à feu', stack: 1 },
};
export const itemName = (type, n = 1) => (n > 1 ? ITEMS[type].many : ITEMS[type].one);

// géométries posées à plat, centrées, axe long selon x
const cache = {};
export function itemGeometry(type, variant = 0) {
  const key = type + variant;
  if (cache[key]) return cache[key];
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
export const matFor = (type) => (type === 'pierre-a-feu' || type === 'grattoir' ? metalMaterial : itemMaterial);

// petites icônes (SVG en ligne) pour l'inventaire
export const ICONS = {
  caillou: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 21.5 9 13l7-4 8 2.5 3.5 7-2.5 5.5H10z" fill="#a39e95"/><path d="M9 13l7-4 8 2.5-6 3.5z" fill="#c4bfb5"/><path d="M18 14.5l9.5 4L25 24h-7z" fill="#857f77"/></svg>',
  brindille: '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="#b08a62" stroke-linecap="round"><path d="M5 25 27 8" stroke-width="2.2"/><path d="M13 19l-2-6M19 14.5l5 1.5M9 22.5l-4.5-1" stroke-width="1.5"/></g></svg>',
  baton: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4.5 25.5 25 5" stroke="#7a5e45" stroke-width="5" stroke-linecap="round"/><circle cx="25" cy="5" r="2.2" fill="#c49c6e"/><path d="M14 15.5l3.5 3" stroke="#6a5038" stroke-width="2" stroke-linecap="round"/></svg>',
  'pierre-a-feu': '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="13" y="16" width="6.5" height="12" rx="2.5" fill="#9a6a42"/><rect x="14.6" y="3.5" width="3.3" height="13" rx="1.2" fill="#55575e"/><g fill="#f0b46a"><circle cx="23" cy="6" r="1.1"/><circle cx="25.5" cy="10" r="0.8"/><circle cx="22" cy="11" r="0.7"/></g></svg>',
};
