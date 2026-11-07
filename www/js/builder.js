// Outil de construction : toutes les pièces statiques sont « cuites » en
// coordonnées monde puis fusionnées par matériau (peu d'appels de dessin,
// important sur mobile). Les couleurs sont portées par les sommets.
import * as THREE from '../vendor/three.module.min.js';

const tmpColor = new THREE.Color();

export class Builder {
  constructor() {
    this.groups = new Map(); // clé matériau -> [geometries]
    this.materials = new Map();
    this.colliders = []; // {x0,z0,x1,z1}
    this.stack = [new THREE.Matrix4()];
  }

  defineMaterial(key, material) {
    this.materials.set(key, material);
  }

  get matrix() {
    return this.stack[this.stack.length - 1];
  }

  // Ouvre un repère local (x, y, z, rotation Y en radians)
  push(x = 0, y = 0, z = 0, rotY = 0, scale = 1) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
      new THREE.Vector3(scale, scale, scale)
    );
    this.stack.push(this.matrix.clone().multiply(m));
    return this;
  }

  pop() {
    this.stack.pop();
    return this;
  }

  // Ajoute une géométrie (repère local courant) avec une couleur
  add(geo, color = 0xffffff, mat = 'plain', { uv = 0, local } = {}) {
    let g = geo.index ? geo : geo; // indexé ou non, géré au merge
    if (local) g.applyMatrix4(local);
    g.applyMatrix4(this.matrix);
    if (uv > 0) worldUV(g, uv);
    tmpColor.set(color);
    // espace linéaire pour vertexColors
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = tmpColor.r;
      arr[i * 3 + 1] = tmpColor.g;
      arr[i * 3 + 2] = tmpColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!this.groups.has(mat)) this.groups.set(mat, []);
    this.groups.get(mat).push(g);
    return g;
  }

  // Boîte définie par ses coins (repère local)
  box(x0, y0, z0, x1, y1, z1, color, mat = 'plain', opts = {}) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.add(g, color, mat, opts);
    if (opts.collide) this.collideLocal(x0, z0, x1, z1);
    return g;
  }

  cyl(x, y0, z, rTop, rBot, h, color, seg = 8, mat = 'plain', opts = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
    g.translate(x, y0 + h / 2, z);
    this.add(g, color, mat, opts);
    if (opts.collide) {
      const r = Math.max(rTop, rBot);
      this.collideLocal(x - r, z - r, x + r, z + r);
    }
    return g;
  }

  // Forme « douce » (coussin, feuillage, pierre) : icosaèdre étiré
  blob(x, y, z, sx, sy, sz, color, detail = 1, mat = 'plain', rot = 0) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    g.scale(sx, sy, sz);
    if (rot) g.rotateY(rot);
    g.translate(x, y, z);
    this.add(g, color, mat);
    return g;
  }

  // Collision : rectangle local -> AABB monde (au sol)
  collideLocal(x0, z0, x1, z1) {
    const pts = [
      new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, 0, z0),
      new THREE.Vector3(x0, 0, z1), new THREE.Vector3(x1, 0, z1),
    ].map((p) => p.applyMatrix4(this.matrix));
    this.colliders.push({
      x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)),
      z0: Math.min(...pts.map((p) => p.z)), z1: Math.max(...pts.map((p) => p.z)),
    });
  }

  build(scene, { shadows = true } = {}) {
    const meshes = [];
    for (const [key, list] of this.groups) {
      const geo = merge(list);
      const mesh = new THREE.Mesh(geo, this.materials.get(key));
      const noShadow = key === 'glass' || key === 'glow' || key === 'candle';
      mesh.castShadow = shadows && !noShadow;
      mesh.receiveShadow = !noShadow;
      if (key === 'glass') mesh.renderOrder = 2;
      scene.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }
}

// UV en coordonnées monde (projection par face) pour des textures continues
function worldUV(g, tile) {
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export function merge(list) {
  let vCount = 0, iCount = 0;
  const parts = list.map((g) => {
    const ng = g.index ? g : g;
    vCount += ng.attributes.position.count;
    iCount += ng.index ? ng.index.count : ng.attributes.position.count;
    return ng;
  });
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2), col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const g of parts) {
    const c = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    col.set(g.attributes.color.array, vo * 3);
    if (g.index) {
      const a = g.index.array;
      for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo;
      io += a.length;
    } else {
      for (let i = 0; i < c; i++) idx[io + i] = vo + i;
      io += c;
    }
    vo += c;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

// Géométrie à couleurs de sommets fusionnée : parts = [[geometry, couleur], ...]
export function mergeColored(parts) {
  const c = new THREE.Color();
  return merge(parts.map(([g, color]) => {
    c.set(color);
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  }));
}
