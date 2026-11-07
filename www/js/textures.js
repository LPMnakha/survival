// Textures procédurales (canvas) : aucun fichier image à charger.
import * as THREE from '../vendor/three.module.min.js';

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finish(canvas, anisotropy = 4) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}

// teinte sRGB (couleurs CSS du canvas) multipliée par f
function shade(hex, f) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  return `rgb(${Math.min(255, r * f) | 0},${Math.min(255, g * f) | 0},${Math.min(255, b * f) | 0})`;
}

// Planches de parquet (posées dans le sens U)
export function planks({ base = 0x9a6a45, count = 6, seed = 1, gap = 0.035 } = {}) {
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d'), r = rand(seed);
  const h = S / count;
  for (let i = 0; i < count; i++) {
    let x = -r() * S;
    while (x < S) {
      const len = S * (0.45 + r() * 0.6);
      g.fillStyle = shade(base, 0.82 + r() * 0.3);
      g.fillRect(x, i * h, len, h);
      // veines du bois
      g.globalAlpha = 0.08;
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = r() > 0.5 ? '#000' : '#fff';
        g.lineWidth = 1 + r() * 1.5;
        g.beginPath();
        const y = i * h + r() * h;
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 6, x + len * 0.6, y + (r() - 0.5) * 6, x + len, y + (r() - 0.5) * 4);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(30,18,10,0.55)';
      g.fillRect(x, i * h, 2, h);
      x += len;
    }
    g.fillStyle = 'rgba(30,18,10,0.6)';
    g.fillRect(0, i * h, S, Math.max(2, h * gap));
  }
  return finish(cv);
}

// Rondins horizontaux pour les murs
export function logs({ base = 0xc0915f, count = 5, seed = 7 } = {}) {
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d'), r = rand(seed);
  const h = S / count;
  for (let i = 0; i < count; i++) {
    const tone = 0.88 + r() * 0.2;
    const grad = g.createLinearGradient(0, i * h, 0, (i + 1) * h);
    grad.addColorStop(0, shade(base, tone * 0.72));
    grad.addColorStop(0.18, shade(base, tone * 1.0));
    grad.addColorStop(0.55, shade(base, tone * 1.07));
    grad.addColorStop(0.88, shade(base, tone * 0.86));
    grad.addColorStop(1, shade(base, tone * 0.55));
    g.fillStyle = grad;
    g.fillRect(0, i * h, S, h);
    g.globalAlpha = 0.07;
    for (let k = 0; k < 10; k++) {
      g.strokeStyle = r() > 0.4 ? '#3a2412' : '#fff3e0';
      g.lineWidth = 1 + r() * 2;
      g.beginPath();
      const y = i * h + h * (0.2 + r() * 0.6);
      g.moveTo(0, y);
      g.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 8, S * 0.7, y + (r() - 0.5) * 8, S, y);
      g.stroke();
    }
    g.globalAlpha = 1;
    // nœuds
    for (let k = 0; k < 2; k++) {
      if (r() < 0.5) continue;
      g.fillStyle = 'rgba(70,40,20,0.35)';
      g.beginPath();
      g.ellipse(r() * S, i * h + h * (0.3 + r() * 0.4), 6 + r() * 6, 3 + r() * 3, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  return finish(cv);
}

// Carrelage (tomettes, faïence)
export function tiles({ base = 0xb5654a, n = 4, seed = 3, grout = '#d8cbb8', jitter = 0.14 } = {}) {
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d'), r = rand(seed);
  g.fillStyle = grout;
  g.fillRect(0, 0, S, S);
  const t = S / n, gp = 5;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      g.fillStyle = shade(base, 1 - jitter / 2 + r() * jitter);
      g.fillRect(i * t + gp / 2, j * t + gp / 2, t - gp, t - gp);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(i * t + gp / 2, j * t + gp / 2, t - gp, (t - gp) * 0.35);
    }
  return finish(cv);
}

// Tapis à motifs doux
export function rug({ a = 0xb8664b, b = 0xe9dcc4, c = 0x6f8a78, seed = 11, round = false } = {}) {
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d'), r = rand(seed);
  const col = (h) => '#' + new THREE.Color(h).getHexString();
  g.fillStyle = col(a);
  g.fillRect(0, 0, S, S);
  if (round) {
    for (let k = 9; k > 0; k--) {
      g.fillStyle = col([a, b, c][k % 3]);
      g.beginPath();
      g.arc(S / 2, S / 2, (S / 2) * (k / 9), 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.fillStyle = col(b);
    g.fillRect(28, 28, S - 56, S - 56);
    g.fillStyle = col(a);
    g.fillRect(44, 44, S - 88, S - 88);
    g.fillStyle = col(c);
    for (let y = 70; y < S - 70; y += 52)
      for (let x = 70; x < S - 70; x += 52) {
        g.beginPath();
        g.moveTo(x + 18, y);
        g.lineTo(x + 36, y + 18);
        g.lineTo(x + 18, y + 36);
        g.lineTo(x, y + 18);
        g.closePath();
        g.fill();
      }
  }
  // grain de laine
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 18;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return finish(cv);
}

// Halo radial pour lueurs
export function glow(inner = 'rgba(255,190,110,1)', outer = 'rgba(255,120,40,0)') {
  const S = 128, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
