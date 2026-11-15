"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { LIBRARY, thumbOf, wallOf } from "../library/registry";

/**
 * The wall of recordings behind the hero's claim — Figma 501:915.
 *
 * Rows of the library's own loops, fading up from almost nothing at the top
 * (10%, 40%, 80%, then full) so the claim reads over the first row and the
 * components come forward as the eye travels down.
 *
 * Every row runs on forever, and they alternate: the first drifts right, the
 * one under it left, then right, then left — a slow weave rather than one band
 * sliding past. Each row is a pass of six tiles repeated as many times as the
 * frame needs, and its offset wraps at exactly one pass width measured from
 * the DOM, so the seam can never be seen. The drift is a CSS animation, run
 * by the compositor at the screen's own rate; since an IntersectionObserver
 * cannot follow a compositor-only move, the clips below read each tile's
 * real place a few times a second instead.
 *
 * Only what can be seen moves. A tile fetches its clip once it is in the frame,
 * plays only while it stays there, and lets the clip go when it leaves, so the
 * wall never holds more video than it shows — and on a phone it plays only a
 * few tiles at once, the rest drifting by as stills. The loop itself stops
 * whenever the hero is off screen. Reduced motion, a hidden tab or a
 * data-saver hold everything still.
 */

const COLS = 6;
const ROWS = [0.1, 0.4, 0.8, 1];
/** Drift, in CSS pixels a second; each row a little different so they never line up. */
const SPEEDS = [16, 19, 14, 17];

const CLIPS = LIBRARY.filter((entry) => entry.clip);

/*
 * Which rows get the library first. The wall has room for every clip once
 * (four rows of six), so each tile is a different component — newest first,
 * into the row that reads strongest and sits wholly above the fold (the third,
 * at 80%), then the full-strength row under it, then the faint upper rows.
 * Past twenty-four the oldest wait their turn; under it, the shelf wraps.
 */
const ROW_RANK = [3, 2, 0, 1];
const tileFor = (r: number, c: number) => CLIPS[(ROW_RANK[r] * COLS + c) % CLIPS.length];

export default function HeroWall() {
  const reduced = useReducedMotion();
  const wallRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  /*
   * The server renders one pass of each row — what the frame shows — and the
   * copies the seamless loop needs are added straight after, once the wall
   * has been measured, so the first load hydrates half the tiles.
   */
  const [passes, setPasses] = useState(1);
  /* one pass's width plus the gap after it, per row: the distance a row wraps at */
  const spans = useRef<number[]>(ROWS.map(() => 0));

  /* how many copies of a pass the frame needs, so the track never shows its end */
  useEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    const measure = () => {
      trackRefs.current.forEach((track, r) => {
        const pass = track?.firstElementChild as HTMLElement | null;
        if (!track || !pass) return;
        const gap = parseFloat(getComputedStyle(track).columnGap || "0") || 0;
        spans.current[r] = pass.getBoundingClientRect().width + gap;
      });
      const width = spans.current[0];
      if (width) setPasses(Math.max(2, Math.ceil(wall.clientWidth / width) + 1));
      /* the drift is a CSS animation over one pass, at each row's own pace */
      trackRefs.current.forEach((track, r) => {
        const span = spans.current[r];
        if (!track || !span) return;
        track.style.setProperty("--span", `${span}px`);
        track.style.animationDuration = `${span / SPEEDS[r]}s`;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wall);
    return () => observer.disconnect();
  }, []);

  /*
   * The weave. Each row drifts by a CSS animation (landing.css) rather than a
   * transform written from script every frame: the browser runs it on the
   * compositor at the screen's own refresh rate, and a busy frame elsewhere on
   * the page can no longer make the wall stutter. It starts once the copies
   * the seamless wrap needs exist, and pauses while the hero is off screen.
   */
  const [drifting, setDrifting] = useState(false);
  useEffect(() => {
    setDrifting(!reduced && passes >= 2);
  }, [reduced, passes]);

  useEffect(() => {
    const wall = wallRef.current;
    if (!wall || typeof IntersectionObserver === "undefined") return;
    const visibility = new IntersectionObserver(([entry]) => {
      wall.toggleAttribute("data-paused", !entry?.isIntersecting);
    });
    visibility.observe(wall);
    return () => visibility.disconnect();
  }, []);

  /*
   * Clips: fetched and played only while their tile is inside the frame, and
   * let go of again once it leaves.
   *
   * The drift runs on the compositor, where an IntersectionObserver cannot see
   * it, so a tile's place is read from the page itself — a few times a second,
   * and on scroll, only while the hero is on screen.
   *
   * Two things keep this within what a phone can do. A playing tile is a
   * video decoder, and a phone has only a handful: ask for more and the page
   * stutters, and the clips further down it fail to start at all. So a phone
   * plays only a few tiles at once — the ones most in view, in the rows that
   * read strongest — and the rest of the wall drifts by as stills. And a clip
   * that has left the frame is unloaded, not merely paused: a paused video
   * still holds its decoder and its buffer, and the wall used to keep every
   * clip it had ever shown.
   */
  useEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    const videos = Array.from(wall.querySelectorAll<HTMLVideoElement>("video"));
    /* how strongly each tile's row is drawn: the claim's rows are faint, the lower ones full */
    const strength = new Map(
      videos.map((video) => [video, parseFloat(video.closest<HTMLElement>(".hwall__row")?.style.opacity || "1") || 1]),
    );

    const still = () =>
      reduced ||
      document.hidden ||
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

    /* how many tiles may play at once: every one in view on a desktop, a few on a phone, fewer on a modest one */
    const small = window.matchMedia("(max-width: 700px), (pointer: coarse)");
    const budget = () => {
      if (!small.matches) return Infinity;
      const device = navigator as Navigator & { deviceMemory?: number };
      const modest = (device.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4;
      return modest ? 2 : 4;
    };

    const play = (video: HTMLVideoElement) => {
      if (!video.getAttribute("src")) {
        video.src = video.dataset.src ?? "";
        video.preload = "auto";
      }
      if (video.paused) void video.play().catch(() => {});
    };
    /* out of the frame: stop, and hand the decoder and the buffer back */
    const release = (video: HTMLVideoElement) => {
      if (!video.paused) video.pause();
      if (video.getAttribute("src")) {
        video.removeAttribute("src");
        video.load();
      }
      delete video.dataset.live;
    };

    /* a clip is only shown over its still once it has frames, so one that cannot start never covers it */
    const onPlaying = (event: Event) => {
      (event.currentTarget as HTMLVideoElement).dataset.live = "";
    };
    const onGone = (event: Event) => {
      delete (event.currentTarget as HTMLVideoElement).dataset.live;
    };
    for (const video of videos) {
      video.addEventListener("playing", onPlaying);
      video.addEventListener("emptied", onGone);
      video.addEventListener("error", onGone);
    }

    let onScreen = true;
    const sample = () => {
      const frame = wall.getBoundingClientRect();
      const top = Math.max(frame.top, 0);
      const bottom = Math.min(frame.bottom, window.innerHeight);
      const quiet = still() || !onScreen;
      const seen: { video: HTMLVideoElement; score: number }[] = [];
      for (const video of videos) {
        const r = video.getBoundingClientRect();
        const w = Math.min(r.right, frame.right) - Math.max(r.left, frame.left);
        const h = Math.min(r.bottom, bottom) - Math.max(r.top, top);
        const share = w > 0 && h > 0 ? (w * h) / (r.width * r.height || 1) : 0;
        /* in view: at least a fiftieth of the tile is inside the frame */
        if (share > 0.02 && !quiet) seen.push({ video, score: share * (strength.get(video) ?? 1) });
        else if (!onScreen || share <= 0.02) release(video);
        else if (!video.paused) video.pause();
      }
      /* the ones already playing keep their place, so tiles do not trade off with every sample */
      seen.sort((a, b) => Number(a.video.paused) - Number(b.video.paused) || b.score - a.score);
      const allowed = budget();
      seen.forEach(({ video }, i) => {
        if (i < allowed) play(video);
        else if (!video.paused) video.pause();
      });
    };

    let queued = 0;
    const onScroll = () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        sample();
      });
    };

    /* the wall itself does not move, so whether the hero is on screen is the observer's to say */
    const visibility =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            onScreen = Boolean(entry?.isIntersecting);
            sample();
          });
    visibility?.observe(wall);
    const timer = window.setInterval(() => {
      if (onScreen) sample();
    }, 350);
    sample();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", sample);
    small.addEventListener("change", sample);
    return () => {
      window.clearInterval(timer);
      cancelAnimationFrame(queued);
      visibility?.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", sample);
      small.removeEventListener("change", sample);
      for (const video of videos) {
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("emptied", onGone);
        video.removeEventListener("error", onGone);
      }
    };
  }, [reduced, passes]);

  return (
    <div className="hwall" ref={wallRef} aria-hidden="true">
      {ROWS.map((opacity, r) => {
        const row = Array.from({ length: COLS }, (_, c) => tileFor(r, c));
        return (
          /* fades up row by row as CSS keyframes (app/hero.css), so the wall is there at first paint */
          <div
            key={r}
            className="hwall__row hwall-in"
            style={{ opacity, "--rise-d": `${0.1 + r * 0.08}s` } as React.CSSProperties}
          >
            <div
              /* even rows (the first, the third) travel right, odd rows left */
              className={`hwall__track ${r % 2 === 0 ? "hwall__track--right" : "hwall__track--left"}`}
              data-drift={drifting || undefined}
              ref={(el) => {
                trackRefs.current[r] = el;
              }}
            >
              {Array.from({ length: passes }, (_, p) => (
                <div key={p} className="hwall__pass">
                  {row.map((entry, c) => (
                    <div key={c} className="hwall__tile" style={{ background: entry.clipStage ?? entry.stage }}>
                      {/*
                        Every tile's still is an image under its clip: the first
                        pass, which the frame opens on, loads at once, and the
                        copies further along the track only as the drift brings
                        them near. Every tile lays its clip over the still once it
                        plays.
                      */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="hwall__media"
                        src={thumbOf(entry.poster)}
                        alt=""
                        width={384}
                        height={227}
                        /*
                         * The opening tiles of each row — all a phone's frame shows at
                         * first — are fetched at once; the rest of the track lazily, as
                         * it comes near, so they never queue ahead of the page itself.
                         */
                        loading={p === 0 && c < 2 ? "eager" : "lazy"}
                        decoding="async"
                      />
                      {/*
                        Every row plays: even the faint top row is plainly seen on
                        the dark page, and a frozen tile there reads as broken. The
                        loops are 960px, and only tiles inside the frame play.
                      */}
                      {(
                        <video
                          className="hwall__media hwall__clip"
                          data-src={wallOf(entry.clip!)}
                          muted
                          playsInline
                          loop
                          preload="none"
                          tabIndex={-1}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
