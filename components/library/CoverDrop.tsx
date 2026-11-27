"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { runParticleTransition, type Box, type Effect } from "./cover-drop-particles";
import "./cover-drop.css";

/* ══ Cover Drop ═══════════════════════════════════════════
   A cover field with a row of photos under it. Drag a photo up
   into the field, or tap it, and the photo breaks into grains
   that fly up and settle into the cover, one grain per cell of
   the finished picture. Remove it and the same grains fly back
   into its slot. A file dragged in from the desktop works too.

   ── WHAT THE PARTICLES ARE ──────────────────────────────
   The grains are sampled from the cover as it will be shown, so
   when they land the mosaic is the cover; the sharp <img> is
   already underneath and the canvas fades off it. At the start
   each grain sits at its own spot inside the dragged thumbnail,
   rotated and scaled with it, so the drag hands over to the
   particles without a jump. cover-drop-particles.ts is all of it.

   ── THE DRAG ────────────────────────────────────────────
   A pointer drag, not HTML drag and drop: it works the same with
   a finger, and the ghost can lean with your speed. The ghost is
   portalled to <body>, so a transformed parent can never offset it.
   A drop that misses the field flies home to its slot.

   Each effect is a choreography of the same grains:
     grain — a wave outward from where you let go, grains wobbling
     burst — the photo shatters, hangs, then is pulled home
     drift — swept up and laid down left to right, like sand

   Photos are drawn into a canvas to be sampled, so a photo on
   another origin has to be served with CORS headers; one that is
   not simply swaps in without the effect. */

export type CoverDropEffect = Effect;

export type CoverDropPhoto = {
  id: string;
  alt: string;
  /** The full-size source: shown as the cover and sampled for the grains. */
  src: string;
  /** A small source for the row and the drag ghost. Defaults to `src`. */
  thumb?: string;
};

export type CoverDropProps = {
  theme?: "light" | "dark";
  /** How the grains travel. */
  effect?: CoverDropEffect;
  /** A small switch under the row to try each effect. */
  showEffects?: boolean;
  /** The photos in the row, four of them read best. */
  photos?: CoverDropPhoto[];
  /** The field's label, read out as its name. */
  label?: string;
  /** Called once a new cover has landed, and with null once it has gone. */
  onChange?: (cover: { src: string; alt: string } | null) => void;
};

const unsplash = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const photo = (id: string, alt: string): CoverDropPhoto => ({
  id,
  alt,
  src: unsplash(id, 1200),
  thumb: unsplash(id, 240),
});

const PHOTOS: CoverDropPhoto[] = [
  photo("photo-1501785888041-af3ef285b470", "Turquoise lake below sunlit peaks"),
  photo("photo-1439066615861-d1af74d74000", "Alpine lake with a wooden boat"),
  photo("photo-1506905925346-21bda4d32df4", "Mountain ridge above a sea of clouds"),
  photo("photo-1519681393784-d120267933ba", "Snowy peaks under the night sky"),
];

const EFFECTS: { id: CoverDropEffect; name: string }[] = [
  { id: "grain", name: "Grain" },
  { id: "burst", name: "Burst" },
  { id: "drift", name: "Drift" },
];

/* ── images ─────────────────────────────────────────────── */

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/**
 * Loads an image with CORS enabled so its pixels can be sampled. The <img>
 * that shows the cover uses the same crossOrigin mode, so the browser serves
 * both from one cache entry.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (!src.startsWith("blob:")) img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        img.decode().then(
          () => resolve(img),
          () => resolve(img),
        );
      };
      img.onerror = () => {
        imageCache.delete(src);
        reject(new Error(`Cover Drop: failed to load ${src}`));
      };
      img.src = src;
    });
    imageCache.set(src, p);
  }
  return p;
}

/* ── geometry ───────────────────────────────────────────── */

type Cover = { id: string; src: string; alt: string; key?: number };

type DragState = {
  photo: CoverDropPhoto;
  pointerId: number;
  startX: number;
  startY: number;
  offX: number;
  offY: number;
  px: number;
  py: number;
  lastPx: number;
  r: number;
  s: number;
  active: boolean;
  raf: number;
  zone: DOMRect | null;
  size: number;
};

/** The size a desktop file starts from: about one thumbnail. */
const THUMB = 88;
/** The cover's corner, which the grains are cut to. Matches .pcd__zone. */
const RADIUS = 18;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

let dropSeq = 0;

const rectToBox = (r: DOMRect): Box => ({ x: r.left, y: r.top, w: r.width, h: r.height });
const inside = (r: DOMRect, x: number, y: number) =>
  x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
const thumbOf = (p: CoverDropPhoto) => p.thumb ?? p.src;

export default function CoverDrop({
  theme = "dark",
  effect: initialEffect = "burst",
  showEffects = false,
  photos = PHOTOS,
  label = "Cover",
  onChange,
}: CoverDropProps) {
  const [effect, setEffect] = useState<CoverDropEffect>(initialEffect);
  const [cover, setCover] = useState<Cover | null>(null);
  const [incoming, setIncoming] = useState<Cover | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ photo: CoverDropPhoto; x: number; y: number; size: number } | null>(null);
  const [over, setOver] = useState(false);
  /** A photo whose grains are flying back to its slot: the slot stays empty until they land. */
  const [returningId, setReturningId] = useState<string | null>(null);

  const labelId = `${useId()}-label`;
  const zoneRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef(new Map<string, HTMLButtonElement>());
  const drag = useRef<DragState | null>(null);
  const overRef = useRef(false);
  const suppressClick = useRef(false);
  const cancelRun = useRef<(() => void) | null>(null);
  const runId = useRef(0);
  const leaveTimer = useRef(0);
  const objectUrls = useRef<string[]>([]);
  const live = useRef({ cover, incoming, photos, effect, onChange });
  live.current = { cover, incoming, photos, effect, onChange };

  useEffect(() => setEffect(initialEffect), [initialEffect]);

  // Warm the cache so the first drop never waits on the network.
  useEffect(() => {
    photos.forEach((p) => loadImage(p.src).catch(() => {}));
  }, [photos]);

  // Report a cover once it has landed, and its removal once it has gone.
  const reported = useRef<string | null>(null);
  useEffect(() => {
    const key = cover ? `${cover.id}:${cover.key ?? ""}` : null;
    if (key === reported.current) return;
    reported.current = key;
    live.current.onChange?.(cover ? { src: cover.src, alt: cover.alt } : null);
  }, [cover]);

  // Tear down anything in flight on unmount.
  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      cancelRun.current?.();
      window.clearTimeout(leaveTimer.current);
      if (drag.current) {
        cancelAnimationFrame(drag.current.raf);
        document.body.style.cursor = "";
      }
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const setOverState = (v: boolean) => {
    if (overRef.current !== v) {
      overRef.current = v;
      setOver(v);
    }
  };

  /** Jump any running transition to its end state. */
  const finishRunning = () => {
    runId.current++;
    cancelRun.current?.();
    cancelRun.current = null;
    setReturningId(null);
    const pending = live.current.incoming;
    if (pending) {
      setCover(pending);
      setIncoming(null);
    }
  };

  const commit = useCallback(async (next: Cover, from: Box, rotation: number, origin: { x: number; y: number }) => {
    finishRunning();
    window.clearTimeout(leaveTimer.current);
    setLeaving(false);
    // Re-dropping the photo that is already the cover: rebuild it from scratch.
    setCover((c) => (c && c.id === next.id ? null : c));
    next = { ...next, key: ++dropSeq };
    setIncoming(next);
    const token = runId.current;

    let img: HTMLImageElement;
    try {
      img = await loadImage(next.src);
    } catch {
      if (token === runId.current) {
        setCover(next);
        setIncoming(null);
      }
      return;
    }
    const zone = zoneRef.current;
    if (token !== runId.current || !zone) return;

    cancelRun.current = runParticleTransition({
      image: img,
      from,
      fromRotation: rotation,
      to: rectToBox(zone.getBoundingClientRect()),
      radius: RADIUS,
      origin,
      effect: live.current.effect,
      onSettled: () => {
        if (token !== runId.current) return;
        setCover(next);
        setIncoming(null);
      },
    });
    // no deps: finishRunning and the effect are read through refs and stable setters
  }, []);

  const fromPhoto = (p: CoverDropPhoto): Cover => ({ id: p.id, src: p.src, alt: p.alt });

  const selectFromSlot = (p: CoverDropPhoto) => {
    const slot = slotRefs.current.get(p.id);
    if (!slot) return;
    const r = slot.getBoundingClientRect();
    commit(fromPhoto(p), rectToBox(r), 0, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  /** A plain fade, for covers with no slot to return to (desktop files). */
  const fadeOut = () => {
    setLeaving(true);
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setCover(null);
      setLeaving(false);
    }, 180);
  };

  const clear = async () => {
    finishRunning();
    const current = live.current.incoming ?? live.current.cover;
    const p = live.current.photos.find((ph) => ph.id === current?.id);
    const slot = p && slotRefs.current.get(p.id);
    const zone = zoneRef.current;
    if (!current || !p || !slot || !zone) {
      fadeOut();
      return;
    }
    const token = runId.current;
    let img: HTMLImageElement;
    try {
      img = await loadImage(current.src);
    } catch {
      fadeOut();
      return;
    }
    if (token !== runId.current) return;

    const s = slot.getBoundingClientRect();
    const z = zone.getBoundingClientRect();
    const sx = s.left + s.width / 2;
    const sy = s.top + s.height / 2;
    // The canvas paints the cover as a mosaic this same frame, so the real
    // image can go at once; its grains then funnel into the slot, the ones
    // nearest it first.
    setReturningId(p.id);
    setCover(null);
    setIncoming(null);
    cancelRun.current = runParticleTransition({
      image: img,
      from: rectToBox(s),
      fromRotation: 0,
      to: rectToBox(z),
      radius: RADIUS,
      origin: { x: 2 * (z.left + z.width / 2) - sx, y: 2 * (z.top + z.height / 2) - sy },
      effect: live.current.effect,
      reverse: true,
      onSettled: () => {
        if (token !== runId.current) return;
        cancelRun.current = null;
        setReturningId(null);
      },
    });
  };

  /* ── pointer drag ──────────────────────────────────────── */

  const isHidden = (id: string) =>
    id === draggingId || id === returningId || id === incoming?.id || (!incoming && !leaving && id === cover?.id);

  const loop = () => {
    const d = drag.current;
    if (!d || !d.active) return;
    const vx = d.px - d.lastPx;
    d.lastPx = d.px;
    // lean with the hand's speed, settle to a slight tilt
    const targetR = Math.max(-12, Math.min(12, vx * 0.9)) - 2;
    d.r += (targetR - d.r) * 0.16;
    d.s += (1.06 - d.s) * 0.22;
    const el = ghostRef.current;
    if (el) {
      el.style.transform = `translate3d(${d.px - d.offX}px, ${d.py - d.offY}px, 0) rotate(${d.r}deg) scale(${d.s})`;
    }
    d.raf = requestAnimationFrame(loop);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, p: CoverDropPhoto) => {
    if (e.button !== 0 || drag.current || isHidden(p.id)) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      photo: p,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offX: e.clientX - r.left,
      offY: e.clientY - r.top,
      px: e.clientX,
      py: e.clientY,
      lastPx: e.clientX,
      r: 0,
      s: 1,
      active: false,
      raf: 0,
      zone: null,
      size: r.width,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    d.px = e.clientX;
    d.py = e.clientY;
    if (!d.active && Math.hypot(d.px - d.startX, d.py - d.startY) > 4) {
      d.active = true;
      d.zone = zoneRef.current?.getBoundingClientRect() ?? null;
      setGhost({ photo: d.photo, x: d.startX - d.offX, y: d.startY - d.offY, size: d.size });
      setDraggingId(d.photo.id);
      document.body.style.cursor = "grabbing";
      d.raf = requestAnimationFrame(loop);
    }
    if (d.active && d.zone) setOverState(inside(d.zone, d.px, d.py));
  };

  const endDrag = (e: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    cancelAnimationFrame(d.raf);
    document.body.style.cursor = "";
    if (!d.active) return; // a plain click, handled by onClick
    suppressClick.current = true;
    setOverState(false);

    const el = ghostRef.current;
    const hit = !cancelled && d.zone && inside(d.zone, d.px, d.py);

    if (hit) {
      const size = d.size * d.s;
      const cx = d.px - d.offX + d.size / 2;
      const cy = d.py - d.offY + d.size / 2;
      commit(fromPhoto(d.photo), { x: cx - size / 2, y: cy - size / 2, w: size, h: size }, d.r, { x: d.px, y: d.py });
      setDraggingId(null);
      // The grains are drawn exactly where the ghost is: let them take over.
      const fade = el?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: "ease-out", fill: "forwards" });
      if (fade) fade.onfinish = () => setGhost(null);
      else setGhost(null);
      return;
    }

    // Missed: fly back to the slot, then show the slot under the ghost.
    const slot = slotRefs.current.get(d.photo.id)?.getBoundingClientRect();
    if (!el || !slot) {
      setGhost(null);
      setDraggingId(null);
      return;
    }
    const back = el.animate(
      [{ transform: el.style.transform }, { transform: `translate3d(${slot.left}px, ${slot.top}px, 0) rotate(0deg) scale(1)` }],
      { duration: 340, easing: EASE_OUT, fill: "forwards" },
    );
    back.onfinish = () => {
      setDraggingId(null);
      window.setTimeout(() => setGhost(null), 200);
    };
  };

  const onThumbClick = (p: CoverDropPhoto) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (isHidden(p.id)) return;
    selectFromSlot(p);
  };

  /* ── files from the desktop ───────────────────────────── */

  const hasFiles = (e: ReactDragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  useEffect(() => {
    // Keep a file dropped just outside the field from opening in the tab.
    const block = (e: DragEvent) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);

  const onFileDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setOverState(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    const x = e.clientX;
    const y = e.clientY;
    commit({ id: `file-${Date.now()}`, src: url, alt: file.name }, { x: x - THUMB / 2, y: y - THUMB / 2, w: THUMB, h: THUMB }, 0, {
      x,
      y,
    });
  };

  const pickEffect = (next: CoverDropEffect) => {
    if (next === effect) return;
    finishRunning();
    setEffect(next);
  };

  /* ── render ───────────────────────────────────────────── */

  const layers = [cover, incoming].filter((c): c is Cover => c !== null);
  const filled = layers.length > 0;
  const showClose = !!cover && !incoming && !leaving;
  const effectIndex = Math.max(0, EFFECTS.findIndex((x) => x.id === effect));

  return (
    <div className="pcd" data-theme={theme}>
      <span className="pcd__label" id={labelId}>
        {label}
      </span>
      <div
        ref={zoneRef}
        className="pcd__zone"
        role="region"
        aria-labelledby={labelId}
        data-over={over || undefined}
        data-filled={filled || undefined}
        onDragEnter={(e) => hasFiles(e) && setOverState(true)}
        onDragOver={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setOverState(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverState(false);
        }}
        onDrop={onFileDrop}
      >
        <div className="pcd__placeholder" aria-hidden={filled}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 12.5V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h5.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="m3 16 4.3-4.3a2 2 0 0 1 2.8 0L16 17.6M14 15.5l1.3-1.3a2 2 0 0 1 2.8 0L21 17"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M18 2.5v6M15 5.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>{over ? "Drop to set cover" : "Drag a photo here"}</span>
        </div>

        {layers.map((c) => (
          <img
            key={c.key ?? c.id}
            className="pcd__img"
            src={c.src}
            alt={c === incoming ? "" : c.alt}
            crossOrigin={c.src.startsWith("blob:") ? undefined : "anonymous"}
            draggable={false}
            data-pending={c === incoming || undefined}
            data-leaving={(leaving && c === cover) || undefined}
          />
        ))}

        {showClose && (
          <button type="button" className="pcd__close" aria-label="Remove cover" onClick={clear}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <div className="pcd__outline" aria-hidden="true" />
      </div>

      <div className="pcd__thumbs" role="list" aria-label="Photos">
        {photos.map((p) => {
          const hidden = isHidden(p.id);
          return (
            <div className="pcd__slot" role="listitem" key={p.id}>
              <button
                ref={(el) => {
                  if (el) slotRefs.current.set(p.id, el);
                  else slotRefs.current.delete(p.id);
                }}
                type="button"
                className="pcd__thumb"
                data-hidden={hidden || undefined}
                tabIndex={hidden ? -1 : 0}
                aria-label={`Set “${p.alt}” as ${label.toLowerCase()}`}
                onPointerDown={(e) => onPointerDown(e, p)}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => endDrag(e, false)}
                onPointerCancel={(e) => endDrag(e, true)}
                onClick={() => onThumbClick(p)}
              >
                <img src={thumbOf(p)} alt="" draggable={false} />
              </button>
            </div>
          );
        })}
      </div>

      {showEffects && (
        <div className="pcd__effects" role="group" aria-label="Effect">
          <span
            className="pcd__effects-pill"
            aria-hidden="true"
            style={{ transform: `translateX(${effectIndex * 100}%)` }}
          />
          {EFFECTS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={x.id === effect}
              className="pcd__effect"
              data-active={x.id === effect || undefined}
              onClick={() => pickEffect(x.id)}
            >
              {x.name}
            </button>
          ))}
        </div>
      )}

      {ghost &&
        createPortal(
          <div
            ref={ghostRef}
            className="pcd-ghost"
            aria-hidden="true"
            style={{
              width: ghost.size,
              height: ghost.size,
              transform: `translate3d(${ghost.x}px, ${ghost.y}px, 0)`,
            }}
          >
            <img src={thumbOf(ghost.photo)} alt="" draggable={false} />
          </div>,
          document.body,
        )}
    </div>
  );
}
