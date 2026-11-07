// Bruit de simplex 2D (seedé) + fBm, pour le relief et la variété du paysage.
export function makeNoise(seed = 1) {
  const p = new Uint8Array(512);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;

  function noise(x, y) {
    const sk = (x + y) * F2;
    const i = Math.floor(x + sk), j = Math.floor(y + sk);
    const t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    const c = (xx, yy, gi) => {
      let tt = 0.5 - xx * xx - yy * yy;
      if (tt < 0) return 0;
      const g = G[gi & 7];
      tt *= tt;
      return tt * tt * (g[0] * xx + g[1] * yy);
    };
    n += c(x0, y0, p[ii + p[jj]]);
    n += c(x1, y1, p[ii + i1 + p[jj + j1]]);
    n += c(x2, y2, p[ii + 1 + p[jj + 1]]);
    return 70 * n; // ~[-1, 1]
  }

  function fbm(x, y, oct = 4) {
    let a = 0.5, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) {
      sum += a * noise(x * f, y * f);
      norm += a;
      a *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  }

  // crêtes (montagnes)
  function ridge(x, y, oct = 4) {
    let a = 0.5, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) {
      const n = 1 - Math.abs(noise(x * f, y * f));
      sum += a * n * n;
      norm += a;
      a *= 0.5;
      f *= 2.1;
    }
    return sum / norm;
  }

  return { noise, fbm, ridge, rnd };
}
