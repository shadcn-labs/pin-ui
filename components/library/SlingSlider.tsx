"use client";

import { useEffect, useRef } from "react";
import "./sling-slider.css";

/* ══ Sling slider ═════════════════════════════════════════
   A range made of thin bars, solid up to the value and faint
   after it. The last solid bar is the head, and a red ball sits
   on its tip. Two ways to move it:

   DRAG THE BARS. An ordinary slider: the value follows your hand,
   the head leans with your speed, and every bar you pass springs
   up and settles — a wake left behind the hand.

   PULL THE BALL. A slingshot. Grab the ball and pull it back, away
   from where you want it to go. A dashed arc shows exactly where it
   will land, and the reading turns red and shows the value it will
   land on. Pull further for further, pull down for a higher lob.
   Let go and it flies along that exact arc, bounces in place, and
   the value is what the preview said. A short pull, or Escape,
   puts it back.

   Why not fling on release? A throw read from the speed of your
   last few pointer events cannot be aimed: the same gesture lands
   in a different place every time. A pull is a position, and a
   position can be previewed, adjusted and trusted.

   Built on the Wake slider idea (Bencho, MIT). Each bar here is a
   damped spring with a position and a velocity, so a bar overshoots
   and settles, and a landing can press bars down as well as up.

   ── ONE LOOP, NO RE-RENDERS ─────────────────────────────
   Everything that moves is written straight to the DOM from refs in
   one rAF loop. React renders once. The loop sleeps when nothing is
   moving and wakes on input.

   ── FIXED STEP ──────────────────────────────────────────
   Stiff springs blow up on one long frame, so physics runs in fixed
   1/240 s steps. A 60 Hz and a 120 Hz screen behave the same.

   ── ANY WIDTH ───────────────────────────────────────────
   The slider is drawn at its design size and scaled down, never up,
   to the width it is given, so on a phone it fits whole rather than
   running off the screen. Every pointer position is read back in the
   slider's own units, so dragging and aiming are exact at any scale. */

/* ── geometry, from the Figma frame ─────────────────────── */
const N = 59; // bars
const PITCH = 10; // bar centre to bar centre, px
const BAR_W = 3; // solid bar
const BAR_H = 48;
const DIM_W = 1; // faint bar
const DIM_H = 32;
const BALL = 12;
const BALL_GAP = 8; // head tip to ball
const STAGE_H = 96;
const TRACK = (N - 1) * PITCH; // first bar centre to last
const REST_Y = -(BAR_H / 2 + BALL_GAP + BALL / 2); // ball centre at rest: -38

/* ── physics ────────────────────────────────────────────── */
const STEP = 1 / 240;
/* bar wake: damping ratio ≈ 0.34, overshoots once or twice */
const WAKE_K = 320;
const WAKE_C = 12;
/* faint → solid: ratio ≈ 0.58, a small pop, not a wobble */
const BASE_K = 520;
const BASE_C = 26;
/* value chasing the hand: just under critical, keeps up, no overshoot */
const FOLLOW_K = 1100;
const FOLLOW_C = 62;
/* head lean: loose, so letting go of a pull whips it past upright */
const LEAN_K = 260;
const LEAN_C = 11;
const LEAN_MAX = 30; // degrees
/* the ball on the tip (or on your finger while aiming) */
const RIDE_K = 900;
const RIDE_C = 40;

/* ── the sling ──────────────────────────────────────────── */
const GRAB_R = 22; // how close to the ball counts as grabbing it
const FINGER_R = 24; // …and on touch, at least this many screen px, at any scale
const PULL_MAX = 96; // the band stretches no further than this, px
const PULL_MIN = 10; // shorter than this on release: put it back
const POWER = 5; // px of travel per px of sideways pull
const GRAVITY = 5200; // with the lift below, a 240 px shot ≈ the Figma arc
const LIFT = 46; // apex above the higher end, px…
const LIFT_PER_PX = 0.28; // …plus this much per px travelled…
const LIFT_PER_DOWN = 0.9; // …plus this much per px pulled down
const BOUNCE = 0.38; // vertical energy kept per hop
/* the highest the ball may fly, above the bars' centre. A long throw pulled
   down hard would otherwise lob ~330 px up, out of any box it sits in; the
   slider reserves exactly this much room above itself (sling-slider.css,
   .psling__body), so the arc and the flight are always inside its own box.
   The reference shot (240 px) peaks at ~151, so ordinary throws never meet it. */
const CEIL = 150;
const HOP_MIN = 140; // px/s: slower than this and it has landed

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const headOf = (x: number) => Math.floor(x / PITCH + 1e-6); // index of the head bar
const toValue = (x: number) => Math.round((x / TRACK) * 100);

type Mode = "idle" | "drag" | "aim" | "flight" | "hop";

/* where a pull from the head at `x` sends the ball */
function aimAt(x: number, pullX: number, pullY: number) {
  /* pull left, it goes right: the slingshot rule */
  const value = clamp(x - pullX * POWER, 0, TRACK);
  /* it lands on the tip of the bar that will be the head */
  const land = headOf(value) * PITCH;
  const lift = LIFT + Math.abs(land - x) * LIFT_PER_PX + Math.max(0, pullY) * LIFT_PER_DOWN;
  return { value, land, lift };
}

/* the launch that leaves (fx, fy) and comes down exactly on (tx, REST_Y),
   peaking `lift` px above the higher of the two ends — but never above the
   ceiling. Lowering the peak only flattens the lob: the launch is solved for
   it, so the landing is exactly where it was. */
function solve(fx: number, fy: number, tx: number, lift: number) {
  const apex = Math.max(Math.min(fy, REST_Y) - lift, -CEIL);
  const vy = -Math.sqrt(2 * GRAVITY * (fy - apex));
  const up = -vy / GRAVITY;
  const down = Math.sqrt((2 * (REST_Y - apex)) / GRAVITY);
  return { vx: (tx - fx) / (up + down), vy, time: up + down };
}

export type SlingSliderProps = {
  /** Where it starts, 0 to 100. */
  defaultValue?: number;
  /** Called with every whole-number change, while dragging and while the ball flies. */
  onChange?: (value: number) => void;
  /** The slider's accessible name. */
  label?: string;
  theme?: "light" | "dark";
  /** The line under it saying how to use it. */
  hint?: boolean;
};

export default function SlingSlider({
  defaultValue = 36,
  onChange,
  label = "Value",
  theme = "dark",
  hint = true,
}: SlingSliderProps) {
  const stage = useRef<HTMLDivElement | null>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const ball = useRef<HTMLSpanElement | null>(null);
  const ghost = useRef<HTMLSpanElement | null>(null);
  const arc = useRef<SVGPathElement | null>(null);
  const band = useRef<SVGPathElement | null>(null);
  const trail = useRef<SVGPathElement | null>(null);
  const reading = useRef<HTMLSpanElement | null>(null);
  const fitRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);

  const start = (clamp(defaultValue, 0, 100) / 100) * TRACK;
  const lit0 = headOf(start) + 1;

  const s = useRef({
    mode: "idle" as Mode,
    raf: 0,
    acc: 0,
    last: 0,
    reduced: false,
    pointer: -1,

    /* the value, as px along the track */
    x: start,
    vx: 0,
    target: start,
    prevX: start,

    /* bars: wake spring (h, hv) and faint/solid spring (b, bv) */
    h: new Float32Array(N),
    hv: new Float32Array(N),
    b: Float32Array.from({ length: N }, (_, i) => (i < lit0 ? 1 : 0)),
    bv: new Float32Array(N),
    lit: lit0,
    instant: false, // a key press: change without motion

    lean: 0,
    leanV: 0,

    /* the ball, in stage px: x along the track, y from the bars' centre */
    bx: (lit0 - 1) * PITCH,
    by: REST_Y,
    bvx: 0,
    bvy: 0,

    /* aiming */
    grabX: 0,
    grabY: 0,
    pullX: 0,
    pullY: 0,
    aim: { value: start, land: 0, lift: 0 },
    aimAlpha: 0,

    /* flight */
    fromX: 0, // value when it left
    flyFrom: 0, // ball x when it left
    landX: 0,
    landValue: 0,
    trail: [] as number[],

    value: toValue(start),
  });

  /* the tip of the head bar, and the ball's seat above it */
  const tip = (extra: number) => {
    const p = s.current;
    const head = (p.lit - 1) * PITCH;
    const r = (p.lean * Math.PI) / 180;
    const half = (BAR_H / 2) * (1 + p.h[p.lit - 1]) + extra;
    return { x: head + Math.sin(r) * half, y: -Math.cos(r) * half };
  };

  /* ── one fixed step of physics ────────────────────────── */
  const step = (dt: number) => {
    const p = s.current;

    if (p.mode === "drag" || p.mode === "idle") {
      p.vx += (FOLLOW_K * (p.target - p.x) - FOLLOW_C * p.vx) * dt;
      p.x += p.vx * dt;
    } else if (p.mode === "flight") {
      p.bvy += GRAVITY * dt;
      p.bx += p.bvx * dt;
      p.by += p.bvy * dt;
      /* the value travels with the ball, from where it was to exactly
         where the preview said */
      const span = p.landX - p.flyFrom;
      const t = span === 0 ? 1 : clamp((p.bx - p.flyFrom) / span, 0, 1);
      p.x = lerp(p.fromX, p.landValue, t);
      p.vx = p.bvx;
      if (p.by >= REST_Y && p.bvy > 0) {
        p.bx = p.landX;
        p.by = REST_Y;
        p.x = p.target = p.landValue;
        impact(p.bx, p.bvy);
        p.bvx = 0;
        p.bvy = -p.bvy * BOUNCE;
        p.mode = Math.abs(p.bvy) < HOP_MIN ? "idle" : "hop";
      }
    } else if (p.mode === "hop") {
      /* hops straight up and down: the value is already final */
      p.bvy += GRAVITY * dt;
      p.by += p.bvy * dt;
      p.vx = 0;
      if (p.by >= REST_Y && p.bvy > 0) {
        p.by = REST_Y;
        impact(p.bx, p.bvy * 0.6);
        p.bvy = -p.bvy * BOUNCE;
        if (Math.abs(p.bvy) < HOP_MIN) {
          p.bvy = 0;
          p.mode = "idle";
        }
      }
    }
    /* "aim" holds the value still */
    p.x = clamp(p.x, 0, TRACK);

    /* bars the value crosses light up and get a push from its speed */
    const lit = headOf(p.x) + 1;
    if (lit !== p.lit) {
      const lo = Math.min(lit, p.lit), hi = Math.max(lit, p.lit);
      const push = p.instant || p.reduced ? 0 : (1 - Math.exp(-Math.abs(p.vx) / 900)) * 7;
      for (let i = lo - 1; i < hi; i++) {
        if (i < 0 || i >= N) continue;
        p.hv[i] += push;
        if (p.instant) { p.b[i] = i < lit ? 1 : 0; p.bv[i] = 0; }
      }
      p.lit = lit;
    }

    let energy = 0;
    for (let i = 0; i < N; i++) {
      const to = i < p.lit ? 1 : 0;
      p.bv[i] += (BASE_K * (to - p.b[i]) - BASE_C * p.bv[i]) * dt;
      p.b[i] += p.bv[i] * dt;
      p.hv[i] += (-WAKE_K * p.h[i] - WAKE_C * p.hv[i]) * dt;
      p.h[i] += p.hv[i] * dt;
      energy += Math.abs(p.h[i]) + Math.abs(p.hv[i]) * 0.02
        + Math.abs(to - p.b[i]) + Math.abs(p.bv[i]) * 0.02;
    }

    /* the lean. Aiming: the band drags the tip toward the ball.
       Otherwise it leans into the value's speed. Let go of a pull and
       this spring snaps it through upright: the whip. */
    let leanTo = 0;
    if (!p.reduced) {
      if (p.mode === "aim") leanTo = clamp(p.pullX * 0.32, -LEAN_MAX, LEAN_MAX);
      else if (p.mode === "drag" || p.mode === "idle") leanTo = clamp(p.vx * 0.012, -18, 18);
    }
    p.leanV += (LEAN_K * (leanTo - p.lean) - LEAN_C * p.leanV) * dt;
    p.lean += p.leanV * dt;

    /* the ball: on the tip, or on your finger while aiming */
    if (p.mode === "idle" || p.mode === "drag" || p.mode === "aim") {
      const seat = tip(BALL_GAP + BALL / 2);
      const tx = p.mode === "aim" ? seat.x + p.pullX : seat.x;
      const ty = p.mode === "aim" ? seat.y + p.pullY : seat.y;
      p.bvx += (RIDE_K * (tx - p.bx) - RIDE_C * p.bvx) * dt;
      p.bvy += (RIDE_K * (ty - p.by) - RIDE_C * p.bvy) * dt;
      p.bx += p.bvx * dt;
      p.by += p.bvy * dt;
    }

    return energy
      + Math.abs(p.target - p.x) + Math.abs(p.vx) * 0.01
      + Math.abs(p.lean) * 0.1 + Math.abs(p.leanV) * 0.01
      + Math.abs(p.bvx) * 0.01 + Math.abs(p.bvy) * 0.01;
  };

  /* a landing presses the bars under it down, most at the centre;
     their springs throw them back up past rest */
  const impact = (x: number, vy: number) => {
    const p = s.current;
    if (p.reduced) return;
    const c = x / PITCH;
    const force = clamp(vy / 260, 0, 6);
    for (let i = Math.max(0, Math.floor(c - 7)); i <= Math.min(N - 1, Math.ceil(c + 7)); i++) {
      p.hv[i] -= force * Math.exp(-Math.abs(i - c) / 2.4);
    }
  };

  /* ── write the frame ──────────────────────────────────── */
  const paint = () => {
    const p = s.current;
    for (let i = 0; i < N; i++) {
      const el = bars.current[i];
      if (!el) continue;
      const b = p.b[i];
      const sy = Math.max(0.05, lerp(DIM_H / BAR_H, 1, b) + p.h[i]);
      const sx = lerp(DIM_W / BAR_W, 1, clamp(b, 0, 1.4));
      const rot = i === p.lit - 1 ? p.lean : 0;
      el.style.transform =
        `translateX(${i * PITCH}px) rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      el.style.opacity = lerp(0.5, 1, clamp(b, 0, 1)).toFixed(3);
    }

    if (ball.current) {
      ball.current.style.transform =
        `translate(${(p.bx - BALL / 2).toFixed(2)}px, ${(p.by - BALL / 2).toFixed(2)}px)`;
    }

    /* the aim: arc, landing ring, and the band from tip to ball */
    const aiming = p.mode === "aim" && Math.hypot(p.pullX, p.pullY) >= PULL_MIN && Math.abs(p.pullX) >= 2;
    p.aimAlpha += ((aiming ? 1 : 0) - p.aimAlpha) * (aiming ? 0.35 : 0.2);
    if (aiming) {
      const { land, lift } = p.aim;
      const { vx, vy, time } = solve(p.bx, p.by, land, lift);
      let d = "";
      for (let k = 0; k <= 40; k++) {
        const t = (time * k) / 40;
        const x = p.bx + vx * t;
        const y = p.by + vy * t + 0.5 * GRAVITY * t * t;
        d += `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      arc.current?.setAttribute("d", d);
      if (ghost.current) {
        ghost.current.style.transform =
          `translate(${(land - BALL / 2).toFixed(2)}px, ${(REST_Y - BALL / 2).toFixed(2)}px)`;
      }
    }
    const a = p.aimAlpha.toFixed(3);
    if (arc.current) arc.current.style.opacity = (p.aimAlpha * 0.75).toFixed(3);
    if (ghost.current) ghost.current.style.opacity = a;

    if (band.current) {
      if (p.mode === "aim") {
        const t = tip(0);
        band.current.setAttribute("d", `M${t.x.toFixed(1)} ${t.y.toFixed(1)}L${p.bx.toFixed(1)} ${p.by.toFixed(1)}`);
        band.current.style.opacity = "0.55";
      } else {
        band.current.style.opacity = "0";
      }
    }

    /* the path the ball really flew, eaten from its tail after landing */
    if (trail.current) {
      const t = p.trail;
      if (p.mode === "flight") t.push(p.bx, p.by);
      else if (t.length) t.splice(0, 6);
      let d = "";
      for (let k = 0; k < t.length; k += 2) d += `${k ? "L" : "M"}${t[k].toFixed(1)} ${t[k + 1].toFixed(1)}`;
      trail.current.setAttribute("d", d);
    }

    /* the reading: while aiming it shows where the ball will land */
    const shown = p.mode === "aim" && aiming ? toValue(p.aim.value) : toValue(p.x);
    if (reading.current) {
      if (reading.current.textContent !== String(shown)) reading.current.textContent = String(shown);
      reading.current.toggleAttribute("data-aim", p.mode === "aim" && aiming);
    }
    const value = toValue(p.x);
    if (value !== p.value) {
      p.value = value;
      stage.current?.setAttribute("aria-valuenow", String(value));
      changed.current?.(value);
    }
  };

  /* ── the loop ─────────────────────────────────────────── */
  const wake = () => {
    const p = s.current;
    if (p.raf) return;
    p.last = performance.now();
    p.acc = 0;
    const frame = (now: number) => {
      p.acc += Math.min(0.05, (now - p.last) / 1000);
      p.last = now;
      let e = 0;
      while (p.acc >= STEP) {
        e = step(STEP);
        p.acc -= STEP;
      }
      p.instant = false;
      paint();
      const busy = p.mode !== "idle" || e > 0.004 || p.aimAlpha > 0.01 || p.trail.length > 0;
      p.raf = busy ? requestAnimationFrame(frame) : 0;
    };
    p.raf = requestAnimationFrame(frame);
  };

  useEffect(() => {
    const p = s.current;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { p.reduced = mq.matches; };
    sync();
    mq.addEventListener("change", sync);
    paint();
    return () => {
      mq.removeEventListener("change", sync);
      cancelAnimationFrame(p.raf);
      p.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── fitting the slider to its width ──────────────────── */
  useEffect(() => {
    const fit = fitRef.current;
    const body = bodyRef.current;
    if (!fit || !body) return;
    const measure = () => {
      /* the slider's own size, unscaled, against the room it has */
      const natural = body.offsetWidth;
      const room = fit.parentElement?.clientWidth ?? fit.clientWidth;
      const scale = natural > 0 && room > 0 ? Math.min(1, room / natural) : 1;
      fit.style.setProperty("--psling-scale", String(scale));
      fit.style.width = `${natural * scale}px`;
      fit.style.height = `${body.offsetHeight * scale}px`;
    };
    measure();
    const watch = new ResizeObserver(measure);
    if (fit.parentElement) watch.observe(fit.parentElement);
    watch.observe(body);
    return () => watch.disconnect();
  }, []);

  /* pointer → stage px. The slider may be scaled to fit a narrow
     screen, so measure in its own units. */
  const local = (clientX: number, clientY: number) => {
    const r = stage.current!.getBoundingClientRect();
    const k = r.width / (TRACK + BAR_W) || 1;
    return {
      x: (clientX - r.left) / k - BAR_W / 2,
      y: (clientY - r.top) / k - STAGE_H / 2,
    };
  };

  /*
   * Close enough to the ball to grab it. A finger needs a real target, so on
   * touch the reach is at least FINGER_R screen pixels however far the slider
   * has been scaled down to fit — at a phone's scale the design's 22 would be
   * about ten.
   */
  const onBall = (x: number, y: number, pointerType = "mouse") => {
    const p = s.current;
    const r = stage.current?.getBoundingClientRect();
    const k = r ? r.width / (TRACK + BAR_W) || 1 : 1;
    const reach = pointerType === "mouse" ? GRAB_R : Math.max(GRAB_R, FINGER_R / k);
    return p.mode === "idle" && Math.hypot(x - p.bx, y - p.by) <= reach;
  };

  const release = () => {
    const p = s.current;
    if (p.mode === "aim") {
      const pulled = Math.hypot(p.pullX, p.pullY) >= PULL_MIN && Math.abs(p.pullX) >= 2;
      if (!pulled) {
        p.mode = "idle"; // too short a pull: put it back
      } else if (p.reduced) {
        p.mode = "idle";
        p.x = p.target = p.aim.value;
        p.vx = 0;
        p.instant = true;
      } else {
        /* the sling: exactly the previewed arc, from where the ball is */
        const { vx, vy } = solve(p.bx, p.by, p.aim.land, p.aim.lift);
        p.bvx = vx;
        p.bvy = vy;
        p.fromX = p.x;
        p.flyFrom = p.bx;
        p.landX = p.aim.land;
        p.landValue = p.aim.value;
        p.target = p.aim.value;
        p.trail.length = 0;
        p.mode = "flight";
      }
    } else if (p.mode === "drag") {
      p.mode = "idle";
    }
    p.pullX = p.pullY = 0;
    if (stage.current) stage.current.style.cursor = "";
    wake();
  };

  return (
    <div className="psling" data-theme={theme}>
    <div ref={fitRef} className="psling__fit">
    <div ref={bodyRef} className="psling__body">
      <div
        ref={stage}
        className="psling__stage"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={s.current.value}
        style={{ width: TRACK + BAR_W, height: STAGE_H }}
        onPointerDown={(e) => {
          const p = s.current;
          if (p.pointer !== -1 || e.button !== 0) return; // one hand at a time
          p.pointer = e.pointerId;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* scripted */ }
          const { x, y } = local(e.clientX, e.clientY);
          p.trail.length = 0;
          if (onBall(x, y, e.pointerType)) {
            p.mode = "aim";
            p.grabX = x;
            p.grabY = y;
            p.pullX = p.pullY = 0;
            p.aim = aimAt(p.x, 0, 0);
            e.currentTarget.style.cursor = "grabbing";
          } else {
            /* the bars: a plain slider. Grabbing mid-flight lands
               the ball wherever your hand is. */
            p.mode = "drag";
            p.target = clamp(x, 0, TRACK);
          }
          wake();
        }}
        onPointerMove={(e) => {
          const p = s.current;
          const { x, y } = local(e.clientX, e.clientY);
          if (e.pointerId !== p.pointer) {
            /* hover: say what a press here will do */
            if (p.pointer === -1) e.currentTarget.style.cursor = onBall(x, y) ? "grab" : "";
            return;
          }
          if (p.mode === "aim") {
            let dx = x - p.grabX, dy = y - p.grabY;
            /* the band stretches with more resistance near its limit */
            const len = Math.hypot(dx, dy);
            if (len > 0) {
              const k = (PULL_MAX * (1 - Math.exp(-len / PULL_MAX))) / len;
              dx *= k;
              dy *= k;
            }
            p.pullX = dx;
            p.pullY = dy;
            p.aim = aimAt(p.x, dx, dy);
          } else if (p.mode === "drag") {
            p.target = clamp(x, 0, TRACK);
          }
          wake();
        }}
        onPointerUp={(e) => {
          const p = s.current;
          if (e.pointerId !== p.pointer) return;
          p.pointer = -1;
          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* never captured */ }
          release();
        }}
        onPointerCancel={(e) => {
          const p = s.current;
          if (e.pointerId !== p.pointer) return;
          p.pointer = -1;
          p.pullX = p.pullY = 0;
          if (p.mode === "aim" || p.mode === "drag") p.mode = "idle";
          release();
        }}
        onKeyDown={(e) => {
          const p = s.current;
          if (e.key === "Escape" && p.mode === "aim") {
            e.preventDefault();
            p.pullX = p.pullY = 0;
            p.mode = "idle"; // let the band go slack, fire nothing
            wake();
            return;
          }
          const by = e.shiftKey ? 10 : 1;
          /* from where it is now, not from the last painted frame: a key held
             down repeats faster than frames, and each press must count */
          const now = toValue(p.x);
          let next: number | null = null;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") next = now + by;
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = now - by;
          if (e.key === "PageUp") next = now + 10;
          if (e.key === "PageDown") next = now - 10;
          if (e.key === "Home") next = 0;
          if (e.key === "End") next = 100;
          if (next === null) return;
          e.preventDefault();
          /* keys repeat: no wake, no lean, no flight. It just moves. */
          const x = (clamp(next, 0, 100) / 100) * TRACK;
          p.mode = "idle";
          p.x = p.target = x;
          p.vx = 0;
          p.instant = true;
          wake();
        }}
      >
        {Array.from({ length: N }, (_, i) => (
          <span key={i} ref={(el) => { bars.current[i] = el; }} className="psling__bar" />
        ))}
        <svg className="psling__arcs" aria-hidden="true">
          <path ref={arc} className="psling__arc" />
          <path ref={trail} className="psling__trail" />
          <path ref={band} className="psling__band" />
        </svg>
        <span ref={ghost} className="psling__ghost" aria-hidden="true" />
        <span ref={ball} className="psling__ball" aria-hidden="true" />
      </div>
      <span ref={reading} className="psling__value" aria-hidden="true">
        {s.current.value}
      </span>
    </div>
    </div>
      {hint && (
        <p className="psling__hint">Drag the bars to set. Pull the red ball back and let go to sling it.</p>
      )}
    </div>
  );
}
