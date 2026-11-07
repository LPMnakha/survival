// Lieux abandonnés : une vieille cabane en rondins (toit à moitié effondré),
// un campement abandonné (tente en lambeaux, inutilisable) et un mirador de chasse. Le butin
// (bâche, bouteille, sacoche…) ne se ramasse qu'une fois par partie.
import * as THREE from '../vendor/three.module.min.js';
import { Builder } from './builder.js';
import { SITES } from './forest.js';
import { makeNoise } from './noise.js';

export function createPlaces(scene, { forest, items, shadows = true }) {
  const R = makeNoise(77).rnd;
  const pick = (a) => a[Math.floor(R() * a.length)];
  const B = new Builder();
  // la neige se pose sur les toits et le dessus des rondins, comme sur les rochers
  const mat = forest.snowy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), 'lieux');
  B.defineMaterial('plain', mat);
  B.defineMaterial('cloth', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
  const site = (id) => SITES.find((s) => s.id === id);
  const loot = [];
  // un repère local par lieu : tourné par quarts de tour (collisions exactes)
  const at = (s, fn) => { B.push(s.x, s.y - 0.02, s.z, s.rot); fn(); B.pop(); };
  const toWorld = (s, x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, s.rot).add(new THREE.Vector3(s.x, s.y - 0.02, s.z));
  const LOG = [0x6e5d4b, 0x655443, 0x786654, 0x5f4f40];
  const logX = (x0, x1, y, z, r = 0.11) => { const g = new THREE.CylinderGeometry(r, r * 1.05, Math.abs(x1 - x0), 7); g.rotateZ(Math.PI / 2); g.translate((x0 + x1) / 2, y, z); B.add(g, pick(LOG)); };
  const logZ = (z0, z1, y, x, r = 0.11) => { const g = new THREE.CylinderGeometry(r, r * 1.05, Math.abs(z1 - z0), 7); g.rotateX(Math.PI / 2); g.translate(x, y, (z0 + z1) / 2); B.add(g, pick(LOG)); };

  // ------------------------------------------------------------------ la vieille cabane (5 x 4 m, porte au sud +z)
  const cab = site('cabane');
  at(cab, () => {
    const W = 2.5, D = 2.0, H = 2.1;
    // plancher de planches usées, quelques-unes manquantes
    for (let k = 0; k < 19; k++) {
      if (k === 5 || k === 13) continue;
      const x = -W + 0.13 + k * 0.26;
      B.box(x - 0.12, 0.0, -D + 0.05, x + 0.12, 0.06, D - 0.05, pick([0x7d6a55, 0x736150, 0x86735c]));
    }
    // murs en rondins empilés (ouvertures : porte au sud, fenêtre à l'est)
    for (let y = 0.12, row = 0; y < H; y += 0.21, row++) {
      logZ(-D - 0.15, D + 0.15, y, -W); // ouest
      if (!(y > 0.85 && y < 1.5)) logZ(-D - 0.15, D + 0.15, y, W); // est, avec fenêtre
      else { logZ(-D - 0.15, -0.5, y, W); logZ(0.5, D + 0.15, y, W); }
      logX(-W - 0.15, W + 0.15, y, -D); // nord
      if (y < 1.95) { logX(-W - 0.15, -0.55, y, D); logX(0.55, W + 0.15, y, D); } // sud, porte
      else logX(-W - 0.15, W + 0.15, y, D);
    }
    // collisions des murs (la porte reste libre)
    B.collideLocal(-W - 0.14, -D - 0.14, -W + 0.14, D + 0.14);
    B.collideLocal(W - 0.14, -D - 0.14, W + 0.14, D + 0.14);
    B.collideLocal(-W - 0.14, -D - 0.14, W + 0.14, -D + 0.14);
    B.collideLocal(-W - 0.14, D - 0.14, -0.56, D + 0.14);
    B.collideLocal(0.56, D - 0.14, W + 0.14, D + 0.14);
    // montants et linteau de porte
    B.box(-0.6, 0.06, D - 0.08, -0.5, 1.95, D + 0.08, 0x5a4a3b);
    B.box(0.5, 0.06, D - 0.08, 0.6, 1.95, D + 0.08, 0x5a4a3b);
    // vieille porte arrachée, appuyée contre le mur
    B.push(1.55, 0, D + 0.32, 0);
    const door = new THREE.BoxGeometry(0.9, 1.8, 0.05);
    door.rotateX(-0.22);
    door.translate(0, 0.88, 0);
    B.add(door, 0x6a5846);
    B.box(-0.4, 0.4, 0.06, 0.4, 0.48, 0.1, 0x5a4a3b);
    B.pop();
    // pignons
    for (const z of [-D, D]) {
      const sh = new THREE.Shape();
      sh.moveTo(-W - 0.15, 0); sh.lineTo(W + 0.15, 0); sh.lineTo(0, 1.25); sh.lineTo(-W - 0.15, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: false });
      g.translate(0, H, z - 0.08);
      B.add(g, 0x6b5a48);
    }
    // toit : poutre faîtière, chevrons, planches ; la moitié est (avant) s'est effondrée
    logZ(-D - 0.4, D + 0.4, H + 1.2, 0, 0.09);
    const slope = Math.atan2(1.25, W + 0.15), len = Math.hypot(W + 0.45, 1.25);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 9; k++) {
        const z = -D - 0.3 + k * 0.58;
        const broken = side === 1 && z > -0.2 && k % 3 !== 0; // trou dans le toit
        if (broken) continue;
        const g = new THREE.BoxGeometry(len, 0.05, 0.54);
        g.rotateZ(-side * slope);
        g.translate(side * (W + 0.15) / 2, H + 0.62 + 0.03, z);
        B.add(g, pick([0x5c5a45, 0x625f48, 0x57553f]));
      }
    }
    // poutre tombée à l'intérieur, et planches au sol
    const beam = new THREE.CylinderGeometry(0.08, 0.09, 3.0, 6);
    beam.rotateZ(Math.PI / 2 - 0.55);
    beam.rotateY(0.4);
    beam.translate(1.2, 0.75, 0.5);
    B.add(beam, 0x5f4f40);
    B.box(0.6, 0.06, 0.9, 1.9, 0.1, 1.1, 0x5c5a45);
    B.collideLocal(0.6, 0.05, 2.2, 1.0);
    // table, banc, étagère
    B.box(-2.25, 0.06, -1.7, -1.05, 0.78, -1.62, 0x7a6450);
    B.box(-2.3, 0.74, -1.85, -1.0, 0.8, -0.95, 0x86705a);
    for (const [x, z] of [[-2.2, -1.8], [-1.1, -1.8], [-2.2, -1.0], [-1.1, -1.0]]) B.box(x - 0.04, 0.06, z - 0.04, x + 0.04, 0.74, z + 0.04, 0x6a5644);
    B.collideLocal(-2.3, -1.85, -1.0, -0.95);
    B.box(-2.25, 0.06, -0.7, -1.2, 0.45, -0.45, 0x6a5644);
    B.box(0.4, 1.2, -D + 0.12, 1.8, 1.25, -D + 0.42, 0x7a6450);
    B.box(0.45, 0.06, -D + 0.12, 0.5, 1.2, -D + 0.4, 0x6a5644);
    B.box(1.7, 0.06, -D + 0.12, 1.75, 1.2, -D + 0.4, 0x6a5644);
    B.box(0.4, 1.7, -D + 0.12, 1.8, 1.75, -D + 0.42, 0x7a6450);
    B.collideLocal(0.4, -D, 1.8, -D + 0.45);
    // vieux poêle rouillé dans le coin nord-ouest
    B.cyl(-2.05, 0.06, 1.45, 0.28, 0.3, 0.7, 0x4a4442, 8);
    B.cyl(-2.05, 0.76, 1.45, 0.07, 0.07, 1.9, 0x3e3836, 6);
    B.collideLocal(-2.35, 1.15, -1.75, 1.75);
    // mousse sur les rondins du bas et sur le toit
    for (let k = 0; k < 14; k++) {
      const g = new THREE.IcosahedronGeometry(1, 0);
      g.scale(0.3 + R() * 0.4, 0.06, 0.18);
      const side = k % 4;
      const [x, z] = side === 0 ? [-W, -D + R() * 2 * D] : side === 1 ? [W, -D + R() * 2 * D] : side === 2 ? [-W + R() * 2 * W, -D] : [-W + R() * 2 * W, D];
      if (side < 2) g.rotateY(Math.PI / 2);
      g.translate(x, 0.24, z);
      B.add(g, 0x5e8738);
    }
  });
  // butin de la cabane : la bâche pliée sur la table, la bouteille sur l'étagère
  loot.push({ id: 'cab-bache', type: 'bache', p: toWorld(cab, -1.65, 0.81, -1.4), rot: cab.rot + 0.3 });
  loot.push({ id: 'cab-bouteille', type: 'bouteille', p: toWorld(cab, 1.1, 1.26, -D_SHELF), rot: 0 });

  // ------------------------------------------------------------------ le campement abandonné
  const camp = site('campement');
  at(camp, () => {
    // vieille tente effondrée, en lambeaux : toile délavée, trouée de partout, mâts cassés (inutilisable)
    const P = [
      [-1.2, 0.02, -1.0], [-1.2, 0.85, 0], [-1.2, 0.02, 1.0], // avant (mât cassé à mi-hauteur)
      [1.2, 0.02, -1.0], [1.1, 0.12, 0.1], [1.2, 0.02, 1.0], // arrière (affalé)
      [0.0, 0.52, 0.05],
    ];
    const V = P.map((p) => new THREE.Vector3(...p));
    const pos = [], col = [];
    const cA = new THREE.Color(0x8a8662), cB = new THREE.Color(0x6e6a4c), cS = new THREE.Color(0x4f4a3a), cc = new THREE.Color();
    // chaque pan de toile découpé en petits triangles ; on en retire beaucoup (trous, bords déchiquetés)
    const panel = (a, b, c) => {
      const N = 7;
      for (let i = 0; i < N; i++) for (let j = 0; j < N - i; j++) {
        for (const up of [0, 1]) {
          if (up && j >= N - i - 1) continue;
          const pts = up ? [[i + 1, j], [i, j + 1], [i + 1, j + 1]] : [[i, j], [i + 1, j], [i, j + 1]];
          const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3 / N, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3 / N;
          const hole = Math.sin(cx * 13 + a.x * 3) * Math.cos(cy * 11 + c.z * 2) > 0.35 || R() < 0.28;
          if (hole) continue;
          for (const [u, w] of pts) {
            const q = new THREE.Vector3().addScaledVector(a, 1 - u / N - w / N).addScaledVector(b, u / N).addScaledVector(c, w / N);
            q.y += (R() - 0.5) * 0.05 - 0.06 * Math.sin((u / N) * Math.PI) * Math.sin((w / N) * Math.PI);
            pos.push(q.x, q.y, q.z);
          }
          cc.copy(cA).lerp(cB, R()).lerp(cS, R() < 0.25 ? 0.6 : 0); // taches de moisissure
          for (let k = 0; k < 3; k++) col.push(cc.r, cc.g, cc.b);
        }
      }
    };
    panel(V[0], V[1], V[6]); panel(V[0], V[6], V[3]); panel(V[3], V[6], V[4]);
    panel(V[1], V[2], V[6]); panel(V[6], V[2], V[5]); panel(V[6], V[5], V[4]);
    const tent = new THREE.BufferGeometry();
    tent.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tent.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    tent.computeVertexNormals();
    B.groups.has('cloth') || B.groups.set('cloth', []);
    tent.applyMatrix4(B.matrix);
    B.groups.get('cloth').push(tent);
    // lambeaux qui pendent et morceaux de toile arrachés au sol
    for (let k = 0; k < 6; k++) {
      const x = -1.0 + k * 0.4, h = 0.2 + R() * 0.25;
      const g = new THREE.PlaneGeometry(0.08 + R() * 0.06, h, 1, 2);
      g.translate(0, -h / 2, 0);
      g.rotateZ((R() - 0.5) * 0.4); g.rotateY(R() * 3);
      g.translate(x, 0.55 - Math.abs(x) * 0.2, (R() - 0.5) * 0.5);
      B.add(g, R() < 0.5 ? 0x7a7656 : 0x625e44, 'cloth');
    }
    for (const [x, z, r] of [[1.9, -1.1, 0.5], [-1.7, 1.4, 1.9], [0.6, 1.6, 2.6]]) {
      const g = new THREE.CircleGeometry(0.22 + R() * 0.1, 5);
      g.rotateX(-Math.PI / 2); g.rotateY(r); g.translate(x, 0.025, z);
      B.add(g, 0x77734f, 'cloth');
    }
    // mâts cassés : un tronçon encore debout, l'autre brisé au sol
    B.cyl(-1.2, 0.0, 0, 0.02, 0.02, 0.85, 0x7d8288, 5);
    const pole = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5);
    pole.rotateZ(1.45); pole.translate(-1.55, 0.04, 0.35);
    B.add(pole, 0x7d8288);
    const pole2 = new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5);
    pole2.rotateZ(1.5); pole2.rotateY(0.7); pole2.translate(1.6, 0.04, 0.5);
    B.add(pole2, 0x7d8288);
    B.collideLocal(-1.25, -1.0, 1.25, 1.0);
    // deux sardines rouillées encore plantées
    for (const [x, z] of [[-1.6, -1.3], [1.6, 1.3]]) B.box(x - 0.015, 0, z - 0.015, x + 0.015, 0.1, z + 0.015, 0x6e5a48);
    // ancien foyer de pierres, cendres froides
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      B.blob(0.3 + Math.cos(a) * 0.38, 0.05, 2.4 + Math.sin(a) * 0.38, 0.11, 0.08, 0.1, pick([0x8d8a84, 0x7f7c76, 0x96928b]), 0);
    }
    B.blob(0.3, 0.02, 2.4, 0.26, 0.04, 0.26, 0x4a4643, 0);
    const charred = new THREE.CylinderGeometry(0.035, 0.04, 0.5, 6);
    charred.rotateZ(Math.PI / 2); charred.rotateY(0.6); charred.translate(0.3, 0.05, 2.4);
    B.add(charred, 0x2a221d);
    B.collideLocal(-0.15, 1.95, 0.75, 2.85);
    // caisse en bois et souche servant de siège
    B.push(-1.2, 0, 2.3, 0.4);
    B.box(-0.3, 0, -0.22, 0.3, 0.42, 0.22, 0x8a7258);
    for (const y of [0.13, 0.28]) B.box(-0.31, y, -0.23, 0.31, y + 0.02, 0.23, 0x6e5a45);
    B.collideLocal(-0.3, -0.22, 0.3, 0.22);
    B.pop();
    B.cyl(1.6, 0, 1.9, 0.2, 0.24, 0.4, 0x6a5540, 8, 'plain', { collide: true });
  });
  loot.push({ id: 'camp-sacoche', type: 'sacoche', p: toWorld(camp, -1.25, 0.43, 2.3), rot: camp.rot + 0.9 });

  // ------------------------------------------------------------------ le mirador de chasse (presque vide)
  const mir = site('mirador');
  at(mir, () => {
    const h = 3.4;
    for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
      const g = new THREE.CylinderGeometry(0.07, 0.09, h + 1.1, 6);
      g.rotateX(z * 0.06); g.rotateZ(-x * 0.06);
      g.translate(x, (h + 1.1) / 2, z);
      B.add(g, 0x6e5d4b);
      B.collideLocal(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
    }
    // croisillons
    for (const s of [-0.8, 0.8]) {
      const g = new THREE.CylinderGeometry(0.04, 0.04, 2.3, 5);
      g.rotateX(Math.PI / 2 - 0.0); g.rotateX(0.95); g.translate(s, 1.6, 0);
      B.add(g, 0x655443);
    }
    // plateforme, garde-corps, toit
    B.box(-0.95, h, -0.95, 0.95, h + 0.08, 0.95, 0x786654);
    for (const [x0, z0, x1, z1] of [[-0.95, -0.95, 0.95, -0.9], [-0.95, 0.9, -0.2, 0.95], [-0.95, -0.95, -0.9, 0.95], [0.9, -0.95, 0.95, 0.95]]) B.box(x0, h + 0.08, z0, x1, h + 0.95, z1, 0x6e5d4b);
    const roof = new THREE.ConeGeometry(1.45, 0.6, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(0, h + 1.45, 0);
    B.add(roof, 0x55533f);
    // échelle (un barreau manque)
    for (const s of [-0.18, 0.18]) {
      const g = new THREE.CylinderGeometry(0.035, 0.035, h + 0.6, 5);
      g.rotateX(-0.28); g.translate(0.55 + s, (h + 0.6) / 2, 1.35);
      B.add(g, 0x6e5d4b);
    }
    for (let k = 0; k < 11; k++) {
      if (k === 6) continue;
      const y = 0.3 + k * 0.32;
      B.box(0.37, y, 1.75 - y * 0.29 - 0.02, 0.73, y + 0.04, 1.75 - y * 0.29 + 0.02, 0x786654);
    }
    B.collideLocal(0.3, 0.9, 0.8, 1.8);
  });
  loot.push({ id: 'mir-brindille-1', type: 'brindille', p: toWorld(mir, -0.3, 0.03, 0.2), rot: 1.2 });
  loot.push({ id: 'mir-brindille-2', type: 'brindille', p: toWorld(mir, 0.1, 0.03, -0.35), rot: 2.6 });

  for (const m of B.build(scene, { shadows })) m.receiveShadow = true;
  // collisions des lieux (le joueur et les feux de camp en tiennent compte)
  for (const c of B.colliders) forest.addCollider(c);

  // le butin rejoint les objets ramassables (une seule fois par partie)
  for (const L of loot) items.addLoot(L);
  return { loot };
}
const D_SHELF = 1.73; // l'étagère est contre le mur nord (z = -2), planche à 1,73 m du centre
