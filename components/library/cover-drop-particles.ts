/* ══ Cover Drop: the particle engine ══════════════════════
   Everything that moves in CoverDrop.tsx, and nothing React needs
   to know about. It must sit beside the component.

   The dropped thumbnail is rebuilt as a grid of particles, one per
   cell of the final cover. Each particle carries the colour of its
   destination cell and starts at the matching spot inside the
   (rotated, scaled) drag ghost, so at t = 0 the cluster *is* the
   small picture. The particles then travel to their cells and settle
   into a mosaic of the full cover; the sharp <img> is already
   underneath, and the canvas fades away on top of it. Removing a
   cover plays the same paths backwards into its thumbnail.

   Rendering writes straight into an ImageData buffer (one Uint32 per
   pixel), which keeps ~12k particles comfortably inside the frame
   budget. The canvas is fixed to the viewport and sized to the union
   of the ghost and the cover plus room for the flight, so it is never
   clipped by the box the component sits in. */

export type Effect = "grain" | "burst" | "drift";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TransitionInput {
  image: HTMLImageElement;
  /** Ghost box in viewport px, before rotation. */
  from: Box;
  /** Ghost rotation in degrees, about its centre. */
  fromRotation: number;
  /** Final cover box in viewport px. */
  to: Box;
  /** Corner radius of the final cover. */
  radius: number;
  /** Where the pointer released, in viewport px. */
  origin: { x: number; y: number };
  effect: Effect;
  /**
   * Play the same choreography backwards: the cover breaks apart and the
   * particles collapse into the `from` box (used when a cover is removed).
   */
  reverse?: boolean;
  /** Fired once every particle has landed. Swap the real image in here. */
  onSettled: () => void;
}

/** Cell size in CSS px. Smaller = finer grain, more particles. */
const STEP = 3;
/** Canvas fade once the mosaic is complete. */
const FADE_MS = 240;
/** Canvas fade once the particles are back in the thumbnail. */
const FADE_OUT_MS = 160;
/** Exits run faster than entrances: the user has already decided. */
const REVERSE_SPEED = 1.3;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Samples the image exactly as `object-fit: cover` would show it, one pixel per cell. */
function sampleCells(image: HTMLImageElement, cols: number, rows: number, aspect: number) {
  const c = document.createElement("canvas");
  c.width = cols;
  c.height = rows;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  let sw = iw;
  let sh = iw / aspect;
  if (sh > ih) {
    sh = ih;
    sw = ih * aspect;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, cols, rows);
  // Throws a SecurityError if the image is cross-origin without CORS.
  return ctx.getImageData(0, 0, cols, rows).data;
}

/** True when the cell centre lies inside the rounded rectangle. */
function insideRounded(x: number, y: number, w: number, h: number, r: number) {
  const dx = x < r ? r - x : x > w - r ? x - (w - r) : 0;
  const dy = y < r ? r - y : y > h - r ? y - (h - r) : 0;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Runs the transition. Returns a cancel function that tears the canvas down
 * immediately (the caller is responsible for showing the final state).
 */
export function runParticleTransition(input: TransitionInput): () => void {
  const { image, from, fromRotation, to, radius, origin, effect, onSettled } = input;
  const reverse = input.reverse === true;

  if (prefersReducedMotion()) {
    onSettled();
    return () => {};
  }

  const cols = Math.max(1, Math.round(to.w / STEP));
  const rows = Math.max(1, Math.round(to.h / STEP));
  const cw = to.w / cols;
  const ch = to.h / rows;

  let pixels: Uint8ClampedArray;
  try {
    pixels = sampleCells(image, cols, rows, to.w / to.h);
  } catch {
    // Pixels are unreadable (e.g. CORS). Fall back to a plain swap.
    onSettled();
    return () => {};
  }

  // ---- Canvas region: union of ghost + cover, padded for flight paths ----
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pad = effect === "burst" ? 200 : 140;
  const left = Math.max(0, Math.floor(Math.min(from.x, to.x) - pad));
  const top = Math.max(0, Math.floor(Math.min(from.y, to.y) - pad));
  const right = Math.min(window.innerWidth, Math.ceil(Math.max(from.x + from.w, to.x + to.w) + pad));
  const bottom = Math.min(window.innerHeight, Math.ceil(Math.max(from.y + from.h, to.y + to.h) + pad));
  const W = Math.max(1, Math.round((right - left) * dpr));
  const H = Math.max(1, Math.round((bottom - top) * dpr));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    left: `${left}px`,
    top: `${top}px`,
    width: `${W / dpr}px`,
    height: `${H / dpr}px`,
    pointerEvents: "none",
    zIndex: "40",
  } satisfies Partial<CSSStyleDeclaration>);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    onSettled();
    return () => {};
  }
  document.body.appendChild(canvas);

  const frame = ctx.createImageData(W, H);
  const buf = new Uint32Array(frame.data.buffer);

  // ---- Build particles ----
  const max = cols * rows;
  const sx = new Float32Array(max);
  const sy = new Float32Array(max);
  const tx = new Float32Array(max);
  const ty = new Float32Array(max);
  const delay = new Float32Array(max);
  const dur = new Float32Array(max);
  const pa = new Float32Array(max); // per-effect param
  const pb = new Float32Array(max); // per-effect param
  const pc = new Float32Array(max); // per-effect param
  const rgb = new Uint32Array(max);
  /** Cells that the thumbnail's square crop doesn't show: they hide while in the thumbnail. */
  const edge = new Uint8Array(max);

  // Both the thumbnail and the cover use object-fit: cover, but with different
  // aspect ratios, so they show different crops of the photo. Map each cover
  // cell into the thumbnail's crop so the cluster looks exactly like the thumbnail.
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const crop = (aspect: number) => {
    const w = iw / ih > aspect ? ih * aspect : iw;
    return { w, h: w / aspect };
  };
  const coverCrop = crop(to.w / to.h);
  const thumbCrop = crop(from.w / from.h);
  const kx = coverCrop.w / thumbCrop.w;
  const ky = coverCrop.h / thumbCrop.h;

  const theta = (fromRotation * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const fcx = from.x + from.w / 2;
  const fcy = from.y + from.h / 2;
  const maxDist = Math.max(
    Math.hypot(to.x - origin.x, to.y - origin.y),
    Math.hypot(to.x + to.w - origin.x, to.y - origin.y),
    Math.hypot(to.x - origin.x, to.y + to.h - origin.y),
    Math.hypot(to.x + to.w - origin.x, to.y + to.h - origin.y),
    1,
  );

  let n = 0;
  let end = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const lx = (i + 0.5) * cw;
      const ly = (j + 0.5) * ch;
      if (!insideRounded(lx, ly, to.w, to.h, radius)) continue;

      const k = (j * cols + i) * 4;
      // Little-endian ABGR; alpha is OR-ed in per frame.
      rgb[n] = (pixels[k + 2] << 16) | (pixels[k + 1] << 8) | pixels[k];

      // Same spot of the photo inside the rotated, scaled ghost.
      let u = ((i + 0.5) / cols - 0.5) * kx;
      let v = ((j + 0.5) / rows - 0.5) * ky;
      if (u < -0.5 || u > 0.5 || v < -0.5 || v > 0.5) {
        edge[n] = 1;
        u = Math.max(-0.5, Math.min(0.5, u));
        v = Math.max(-0.5, Math.min(0.5, v));
      }
      const gx = u * from.w;
      const gy = v * from.h;
      sx[n] = fcx + gx * cos - gy * sin - left;
      sy[n] = fcy + gx * sin + gy * cos - top;
      tx[n] = to.x + lx - left;
      ty[n] = to.y + ly - top;

      const r1 = Math.random();
      const r2 = Math.random();
      if (effect === "grain") {
        // Radial wave outward from the drop point; loose, wobbling grains.
        const d = Math.hypot(to.x + lx - origin.x, to.y + ly - origin.y) / maxDist;
        delay[n] = d * 260 + r1 * 140;
        dur[n] = 640 + r2 * 220;
        pa[n] = (Math.random() * 2 - 1) * 18; // sideways wobble amplitude
      } else if (effect === "burst") {
        // Shatter away from the ghost centre, hang, then get pulled home.
        const ax = sx[n] + left - fcx;
        const ay = sy[n] + top - fcy;
        const ang = Math.atan2(ay, ax) + (r1 - 0.5) * 1.4;
        const mag = 50 + Math.pow(r2, 0.6) * 150;
        pa[n] = Math.cos(ang) * mag;
        pb[n] = Math.sin(ang) * mag - 20;
        delay[n] = Math.random() * 110;
        dur[n] = 960 + Math.random() * 220;
      } else {
        // Drift: a sweep that lifts sand off the ghost and lays it down left to right.
        const fx = lx / to.w;
        const fy = ly / to.h;
        delay[n] = fx * 380 + fy * 70 + r1 * 90;
        dur[n] = 780 + r2 * 200;
        pa[n] = (Math.random() - 0.5) * 70; // control point x jitter
        pb[n] = 50 + Math.random() * 70; // lift height
        pc[n] = Math.random() * Math.PI * 2; // flow phase
      }
      const e = delay[n] + dur[n];
      if (e > end) end = e;
      n++;
    }
  }

  // Start size: the visible part of the grid packed into the ghost.
  const startSize = Math.max(0.5, (from.w / (to.w / kx)) * STEP * 1.15);
  const finalSize = STEP + 0.6; // slight overlap so the settled mosaic has no seams
  const transitSize = effect === "burst" ? 2.4 : effect === "drift" ? 1.7 : 1.4;

  // ---- Frame ----
  const draw = (t: number) => {
    buf.fill(0);
    for (let q = 0; q < n; q++) {
      const p = clamp01((t - delay[q]) / dur[q]);
      let x: number;
      let y: number;
      let size: number;
      let alpha = 255;

      if (effect === "grain") {
        const e = easeOutQuint(p);
        const dx = tx[q] - sx[q];
        const dy = ty[q] - sy[q];
        const len = Math.hypot(dx, dy) || 1;
        const wob = pa[q] * Math.sin(Math.PI * e);
        x = lerp(sx[q], tx[q], e) + (-dy / len) * wob;
        y = lerp(sy[q], ty[q], e) + (dx / len) * wob;
        size = p < 0.75 ? lerp(startSize, transitSize, clamp01(p * 5)) : lerp(transitSize, finalSize, (p - 0.75) / 0.25);
        if (p > 0 && p < 1) alpha = 210;
      } else if (effect === "burst") {
        const split = 0.3;
        if (p < split) {
          const e = easeOutCubic(p / split);
          x = sx[q] + pa[q] * e;
          y = sy[q] + pb[q] * e;
        } else {
          const e = easeInOutCubic((p - split) / (1 - split));
          x = lerp(sx[q] + pa[q], tx[q], e);
          y = lerp(sy[q] + pb[q], ty[q], e);
        }
        size = p < 0.85 ? lerp(startSize, transitSize, clamp01(p * 6)) : lerp(transitSize, finalSize, (p - 0.85) / 0.15);
      } else {
        const e = easeOutCubic(p);
        const cx = (sx[q] + tx[q]) / 2 + pa[q];
        const cy = Math.min(sy[q], ty[q]) - pb[q];
        const a = 1 - e;
        x = a * a * sx[q] + 2 * a * e * cx + e * e * tx[q];
        y = a * a * sy[q] + 2 * a * e * cy + e * e * ty[q];
        const flow = (1 - e) * Math.sin(Math.PI * e);
        x += Math.cos(ty[q] * 0.045 + e * 6 + pc[q]) * 10 * flow;
        y += Math.sin(tx[q] * 0.035 + e * 7 + pc[q]) * 14 * flow;
        size = p < 0.8 ? lerp(startSize, transitSize, clamp01(p * 5)) : lerp(transitSize, finalSize, (p - 0.8) / 0.2);
        if (p > 0 && p < 1) alpha = 225;
      }

      if (edge[q]) {
        // Outside the thumbnail's crop: invisible in the thumbnail, fade in on the way out.
        alpha = (alpha * Math.min(1, p * 4)) | 0;
        if (alpha === 0) continue;
      }

      // Round up: rounding down leaves 1px seams wherever spacing exceeds the size.
      const s = Math.max(1, Math.ceil(size * dpr));
      let x0 = Math.round(x * dpr - s / 2);
      let y0 = Math.round(y * dpr - s / 2);
      let x1 = x0 + s;
      let y1 = y0 + s;
      if (x0 < 0) x0 = 0;
      if (y0 < 0) y0 = 0;
      if (x1 > W) x1 = W;
      if (y1 > H) y1 = H;
      if (x0 >= x1 || y0 >= y1) continue;
      const col = ((alpha << 24) | rgb[q]) >>> 0;
      for (let yy = y0; yy < y1; yy++) {
        const row = yy * W;
        for (let xx = x0; xx < x1; xx++) buf[row + xx] = col;
      }
    }
    ctx.putImageData(frame, 0, 0);
  };

  // ---- Loop ----
  let raf = 0;
  let fadeTimer = 0;
  let settled = false;
  const t0 = performance.now();
  const speed = reverse ? REVERSE_SPEED : 1;
  const fadeMs = reverse ? FADE_OUT_MS : FADE_MS;
  // Forward runs 0 → end; reverse runs end → 0 along the exact same paths.
  const at = (elapsed: number) => (reverse ? end - elapsed : elapsed);

  const tick = (now: number) => {
    const elapsed = (now - t0) * speed;
    if (elapsed >= end) {
      draw(at(end));
      settled = true;
      onSettled();
      // The real element (cover or thumbnail) is now underneath; dissolve the canvas off it.
      canvas.style.transition = `opacity ${fadeMs}ms cubic-bezier(0.23, 1, 0.32, 1)`;
      requestAnimationFrame(() => {
        canvas.style.opacity = "0";
      });
      fadeTimer = window.setTimeout(() => canvas.remove(), fadeMs + 40);
      return;
    }
    draw(at(elapsed));
    raf = requestAnimationFrame(tick);
  };
  draw(at(0));
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(fadeTimer);
    canvas.remove();
    if (!settled) settled = true;
  };
}
