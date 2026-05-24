// Document scanner image processing: perspective transform + filters

export type Pt = { x: number; y: number };
export type FilterMode = "original" | "grayscale";

export const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

export const fileToDataURL = (file: File | Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

// Solve 8x8 linear system via Gaussian elimination
const solve = (A: number[][], b: number[]): number[] => {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let max = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[max][i])) max = k;
    [M[i], M[max]] = [M[max], M[i]];
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
};

// Compute projective transform mapping src 4pts -> dst 4pts
const getTransform = (src: Pt[], dst: Pt[]): number[] => {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }
  const h = solve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
};

// Order 4 points: TL, TR, BR, BL
export const orderCorners = (pts: Pt[]): Pt[] => {
  const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
  const cy = pts.reduce((s, p) => s + p.y, 0) / 4;
  const sorted = [...pts].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
  let startIdx = 0;
  let min = Infinity;
  sorted.forEach((p, i) => {
    if (p.x + p.y < min) { min = p.x + p.y; startIdx = i; }
  });
  return [
    sorted[startIdx],
    sorted[(startIdx + 1) % 4],
    sorted[(startIdx + 2) % 4],
    sorted[(startIdx + 3) % 4],
  ];
};

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

// ---- Image enhancement helpers ----

/**
 * Light unsharp mask — kernel [0,-1,0,-1,5,-1,0,-1,0] (amount=1).
 * Safer than the 9-kernel; sharpens edges without blowing out pixels.
 */
const unsharpMask = (d: Uint8ClampedArray, w: number, h: number): void => {
  const copy = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const idx = (y * w + x) * 4 + c;
        const center = copy[idx] * 5;
        const top    = copy[((y - 1) * w + x) * 4 + c];
        const bot    = copy[((y + 1) * w + x) * 4 + c];
        const lft    = copy[(y * w + x - 1) * 4 + c];
        const rgt    = copy[(y * w + x + 1) * 4 + c];
        d[idx] = Math.max(0, Math.min(255, center - top - bot - lft - rgt));
      }
    }
  }
};

/**
 * Brightness + contrast adjustment.
 * contrast > 1 boosts contrast, brightness adds flat offset.
 */
const adjustBC = (
  d: Uint8ClampedArray,
  contrast: number,
  brightness: number,
): void => {
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      d[i + c] = Math.max(0, Math.min(255, (d[i + c] - 128) * contrast + 128 + brightness));
    }
  }
};

// Apply perspective transform via inverse mapping
export const warpPerspective = async (
  img: HTMLImageElement,
  corners: Pt[],
): Promise<HTMLCanvasElement> => {
  const [tl, tr, br, bl] = orderCorners(corners);
  const wA = dist(br, bl);
  const wB = dist(tr, tl);
  const hA = dist(tr, br);
  const hB = dist(tl, bl);
  const W = Math.max(50, Math.round(Math.max(wA, wB)));
  const H = Math.max(50, Math.round(Math.max(hA, hB)));

  const invH = getTransform(
    [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }],
    [tl, tr, br, bl],
  );

  // Draw source to off-screen canvas for pixel sampling
  const sc = document.createElement("canvas");
  sc.width = img.naturalWidth;
  sc.height = img.naturalHeight;
  const sctx = sc.getContext("2d")!;
  sctx.drawImage(img, 0, 0);
  const srcData = sctx.getImageData(0, 0, sc.width, sc.height);
  const sd = srcData.data;
  const sw = sc.width;
  const sh = sc.height;

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const octx = out.getContext("2d")!;
  const dst = octx.createImageData(W, H);
  const dd = dst.data;

  const [a, b, c, d, e, f, g, h] = invH;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const denom = g * x + h * y + 1;
      const sx = (a * x + b * y + c) / denom;
      const sy = (d * x + e * y + f) / denom;
      const di = (y * W + x) * 4;

      // Bilinear interpolation — smooth lines, no jagged/staircase artifacts
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      if (x0 >= 0 && x1 < sw && y0 >= 0 && y1 < sh) {
        const fx = sx - x0; // fractional x
        const fy = sy - y0; // fractional y
        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;
        const i00 = (y0 * sw + x0) * 4;
        const i10 = (y0 * sw + x1) * 4;
        const i01 = (y1 * sw + x0) * 4;
        const i11 = (y1 * sw + x1) * 4;
        for (let c = 0; c < 3; c++) {
          dd[di + c] = Math.round(
            sd[i00 + c] * w00 + sd[i10 + c] * w10 +
            sd[i01 + c] * w01 + sd[i11 + c] * w11,
          );
        }
        dd[di + 3] = 255;
      } else if (x0 >= 0 && x0 < sw && y0 >= 0 && y0 < sh) {
        // Edge fallback: nearest-neighbor for border pixels
        const si = (y0 * sw + x0) * 4;
        dd[di]     = sd[si];
        dd[di + 1] = sd[si + 1];
        dd[di + 2] = sd[si + 2];
        dd[di + 3] = 255;
      } else {
        dd[di] = dd[di + 1] = dd[di + 2] = 255;
        dd[di + 3] = 255;
      }
    }
  }

  // No color manipulation — preserve original appearance exactly
  octx.putImageData(dst, 0, 0);
  return out;
};

export const applyFilter = (canvas: HTMLCanvasElement, mode: FilterMode): HTMLCanvasElement => {
  // "original" returns the already-enhanced warp result as-is
  if (mode === "original") return canvas;

  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, out.width, out.height);
  const d = imgData.data;
  const w = out.width;
  const h = out.height;

  if (mode === "grayscale") {
    // Convert to luminance
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = d[i + 1] = d[i + 2] = g;
    }

    // Percentile contrast stretch (2 – 98 %)
    const lums: number[] = [];
    for (let i = 0; i < d.length; i += 4) lums.push(d[i]);
    lums.sort((a, b) => a - b);
    const lo = lums[Math.floor(lums.length * 0.02)];
    const hi = lums[Math.floor(lums.length * 0.98)];
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((d[i] - lo) / range) * 255));
      d[i] = d[i + 1] = d[i + 2] = v;
    }

    // Sharpen
    unsharpMask(d, w, h);
  }

  ctx.putImageData(imgData, 0, 0);
  return out;
};

export const canvasToBlob = (canvas: HTMLCanvasElement, type = "image/jpeg", q = 0.95): Promise<Blob> =>
  new Promise((res) => canvas.toBlob((b) => res(b!), type, q));

export const defaultCorners = (w: number, h: number): Pt[] => {
  const ix = w * 0.04;
  const iy = h * 0.04;
  return [
    { x: ix, y: iy },
    { x: w - ix, y: iy },
    { x: w - ix, y: h - iy },
    { x: ix, y: h - iy },
  ];
};
