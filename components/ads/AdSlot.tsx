"use client";

import { useEffect, useRef, useState } from "react";
import { ADS_DEV, ADS_ON, BANNER_HOST, UNITS, type AdUnit, type UnitName } from "@/lib/adsterra";
import "./ads.css";

/**
 * One Adsterra unit, placed so it never gets in anyone's way.
 *
 * Every unit is drawn inside a frame of its own. Adsterra's banner code keeps
 * its settings in one global (`atOptions`) and writes itself in with
 * document.write, so two banners on one page would otherwise read each
 * other's settings; in a frame each has its own page. The frame is sandboxed
 * without top navigation, so no ad can ever send the visitor away from the
 * page they are on — a click on an ad opens in a new tab, and nothing else.
 *
 * The room an ad takes is held from the first paint, so nothing below it
 * moves when it arrives. Nothing is requested until the slot comes within a
 * screen of view, so an ad far down a page costs nothing until someone gets
 * there. A Native Banner follows the height of what it draws and is set in
 * the page's own colour, and follows the theme switch.
 *
 * If Adsterra has nothing to show, the slot folds away in production; on
 * localhost it stays, outlined, so the placement can still be seen.
 */

type Status = "waiting" | "loading" | "filled" | "empty";

/* the room a Native Banner holds before it has measured what it drew */
const NATIVE_RESERVE = 140;

/* how long a slot waits for anything to be drawn before it calls itself empty */
const FILL_TIMEOUT_MS = 12000;

function bannerDoc(key: string, width: number, height: number) {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:transparent}</style></head><body><script>atOptions={key:"${key}",format:"iframe",height:${height},width:${width},params:{}};<\/script><script src="${BANNER_HOST}/${key}/invoke.js"><\/script></body></html>`;
}

function nativeDoc(src: string, container: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}body{font-size:15px;line-height:1.35;-webkit-font-smoothing:antialiased}a{color:inherit}img{max-width:100%}</style></head><body><script async data-cfasync="false" src="${src}"><\/script><div id="${container}"></div></body></html>`;
}

/* the frame may run its own scripts and open a new tab; it may not navigate the page it sits in */
const SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

export default function AdSlot({
  unit: name,
  className = "",
}: {
  unit: UnitName;
  className?: string;
}) {
  const unit: AdUnit = UNITS[name];
  const slotRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [near, setNear] = useState(false);
  /* a fixed-size banner is only drawn where its width fits */
  const [fits, setFits] = useState(unit.kind === "native");
  const [status, setStatus] = useState<Status>("waiting");
  const [height, setHeight] = useState<number | null>(null);

  /* wait until the slot is within a screen of view */
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || !ADS_ON) return;
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          watch.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    watch.observe(slot);
    return () => watch.disconnect();
  }, []);

  /*
   * A banner needs its full width: below that the slot stands down entirely
   * rather than overflow. It measures the column it sits in, not itself, so a
   * slot that has stood down still comes back when the window widens.
   */
  useEffect(() => {
    const column = slotRef.current?.parentElement;
    if (!column || unit.kind !== "banner") return;
    const width = unit.width;
    const measure = () => {
      const style = getComputedStyle(column);
      const inner = column.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setFits(inner >= width);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(column);
    return () => watch.disconnect();
  }, [unit]);

  /* once the frame has loaded: follow what is drawn in it, and decide whether anything was */
  useEffect(() => {
    if (!near || !fits) return;
    const frame = frameRef.current;
    if (!frame) return;
    setStatus("loading");
    let poll: ReturnType<typeof setInterval> | undefined;
    let giveUp: ReturnType<typeof setTimeout> | undefined;
    let sizeWatch: ResizeObserver | undefined;
    let themeWatch: MutationObserver | undefined;

    const paint = (doc: Document) => {
      /* the Native Banner is set to inherit: give it the page's own type and colour */
      const style = getComputedStyle(slotRef.current ?? document.body);
      doc.body.style.color = style.color;
      doc.body.style.fontFamily = `${style.fontFamily}, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
    };

    const onLoad = () => {
      const doc = frame.contentDocument;
      const win = frame.contentWindow as (Window & typeof globalThis) | null;
      if (!doc || !win) return;
      if (unit.kind === "native") {
        paint(doc);
        themeWatch = new MutationObserver(() => paint(doc));
        themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-pin-theme"] });
        sizeWatch = new win.ResizeObserver(() => {
          const h = doc.body.scrollHeight;
          if (h > 0) setHeight(h);
        });
        sizeWatch.observe(doc.body);
      }
      const drawn = () =>
        !!doc.querySelector("iframe, img, a, ins, video, canvas") ||
        (doc.body.innerText ?? "").trim().length > 0;
      poll = setInterval(() => {
        if (drawn()) {
          setStatus("filled");
          clearInterval(poll);
          clearTimeout(giveUp);
        }
      }, 500);
      giveUp = setTimeout(() => {
        clearInterval(poll);
        setStatus((now) => (now === "filled" ? now : "empty"));
      }, FILL_TIMEOUT_MS);
    };

    frame.addEventListener("load", onLoad);
    /* a frame that finished before this effect ran will not fire again */
    if (frame.contentDocument?.URL === "about:srcdoc" && frame.contentDocument.readyState === "complete") onLoad();
    return () => {
      frame.removeEventListener("load", onLoad);
      clearInterval(poll);
      clearTimeout(giveUp);
      sizeWatch?.disconnect();
      themeWatch?.disconnect();
    };
  }, [near, fits, unit]);

  if (!ADS_ON) return null;

  const width = unit.kind === "banner" ? unit.width : undefined;
  const reserve = unit.kind === "banner" ? unit.height : 0;
  const folded = status === "empty" && !ADS_DEV;

  return (
    <aside
      ref={slotRef}
      className={`pinad pinad--${unit.kind} ${className}`}
      data-status={status}
      data-fits={fits || undefined}
      hidden={folded || undefined}
      aria-label="Advertisement"
    >
      {fits && (
        <>
          <span className="pinad__label" aria-hidden="true">
            Advertisement
          </span>
          <div
            className="pinad__box"
            style={{ width, minHeight: unit.kind === "native" ? height ?? NATIVE_RESERVE : reserve }}
          >
            {near && (
              <iframe
                ref={frameRef}
                className="pinad__frame"
                title="Advertisement"
                sandbox={SANDBOX}
                referrerPolicy="strict-origin-when-cross-origin"
                srcDoc={unit.kind === "banner" ? bannerDoc(unit.key, unit.width, unit.height) : nativeDoc(unit.src, unit.container)}
                width={unit.kind === "banner" ? unit.width : undefined}
                height={unit.kind === "banner" ? unit.height : height ?? undefined}
                scrolling="no"
              />
            )}
            {ADS_DEV && status === "empty" && (
              <span className="pinad__dev">
                Adsterra {unit.label} · nothing served here on localhost
              </span>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
