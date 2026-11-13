"use client";

import { useEffect } from "react";
import { ADS_ON, SOCIAL_BAR_SRC } from "@/lib/adsterra";

/**
 * Adsterra's Social Bar.
 *
 * It is a single script with no container: the network draws what it shows
 * itself rather than filling a box on the page. So what keeps it out of the
 * way is where and when it is loaded, and both are decided here.
 *
 * Where: only the pages people browse and read — the component list, the
 * Blocx index and each Blocx write-up, the FAQ and the testimonials, which
 * render this. Never the landing page, and never a component's live stage,
 * where people come to play.
 *
 * When: not with the page. It waits until the visitor has started using the
 * page (a scroll, a press or a key), or until the page has been open and
 * settled for a few seconds, and then for the browser to be idle. So it never
 * competes with the first paint, never delays a click, and a visitor's first
 * press on the page is never the one an ad answers.
 *
 * Once loaded it is loaded for the visit: moving between pages does not load
 * it again. NEXT_PUBLIC_ADS=off switches it off with every other unit.
 */

const ID = "pin-ad-tag";
/* a visitor who only reads still gets it, once the page has been open and still this long */
const SETTLE_MS = 6000;
const STARTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

export default function AdTag() {
  useEffect(() => {
    if (!ADS_ON || document.getElementById(ID)) return;

    let armed = true;
    let idle: number | undefined;
    let late: ReturnType<typeof setTimeout> | undefined;

    const inject = () => {
      if (document.getElementById(ID)) return;
      const script = document.createElement("script");
      script.id = ID;
      script.src = SOCIAL_BAR_SRC;
      script.async = true;
      /* as the network ships it: Cloudflare's Rocket Loader must leave it alone */
      script.setAttribute("data-cfasync", "false");
      document.body.appendChild(script);
    };

    const load = () => {
      if (!armed) return;
      armed = false;
      stop();
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(inject, { timeout: 2500 });
      else late = setTimeout(inject, 400);
    };

    const settle = setTimeout(load, SETTLE_MS);
    function stop() {
      clearTimeout(settle);
      STARTS.forEach((type) => window.removeEventListener(type, load));
    }
    STARTS.forEach((type) => window.addEventListener(type, load, { passive: true }));

    return () => {
      stop();
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (late) clearTimeout(late);
    };
  }, []);

  return null;
}
