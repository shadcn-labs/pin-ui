"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { ADSENSE_CLIENT, ADS_LIVE, AD_SLOTS, type AdSlotName } from "@/lib/ads";
import "./ad-slot.css";

/**
 * One Google AdSense unit (lib/ads.ts names them).
 *
 * The AdSense library is loaded here, once, by whichever slot renders first —
 * next/script dedupes it by id — so only the pages that carry an ad ever
 * download it, and it waits for idle time so it never competes with the page.
 * Pushing onto `window.adsbygoogle` before the library has arrived is fine:
 * it is a queue the library drains when it loads.
 *
 * Each <ins> is pushed exactly once (React's development double-run of
 * effects would otherwise request two ads for one slot and AdSense rejects the
 * second), and it is keyed on the page path, so moving between pages that
 * share this component — one Blocx block to the next — asks for a fresh ad.
 * Room is held for the ad before it arrives so nothing below it jumps, and if
 * AdSense has nothing to show the whole slot folds away (ad-slot.css) rather
 * than leaving an empty, labelled hole.
 *
 * In development AdSense does not serve, so the slot draws a labelled
 * placeholder of the same size and requests nothing.
 */

type Format = "display" | "in-article";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export default function AdSlot({
  name,
  format,
  className = "",
}: {
  name: AdSlotName;
  format: Format;
  className?: string;
}) {
  const pathname = usePathname();
  const slot = AD_SLOTS[name];

  return (
    <aside className={`pinad pinad--${format} ${className}`} aria-label="Advertisement">
      <span className="pinad__label" aria-hidden="true">
        Advertisement
      </span>
      {ADS_LIVE ? (
        <>
          <Script
            id="pin-adsbygoogle"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            strategy="lazyOnload"
            crossOrigin="anonymous"
          />
          <AdUnit key={pathname} slot={slot} format={format} />
        </>
      ) : (
        <div className="pinad__placeholder">
          Ad · {name} · {format === "in-article" ? "In-article" : "Display"} · {slot}
        </div>
      )}
    </aside>
  );
}

function AdUnit({ slot, format }: { slot: string; format: Format }) {
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    const ins = ref.current;
    /* already filled (or claimed) — the development double-run, or a remount of the same element */
    if (!ins || ins.getAttribute("data-adsbygoogle-status")) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* an ad blocker or a policy refusal: the slot simply stays empty and folds away */
    }
  }, []);

  return format === "in-article" ? (
    <ins
      ref={ref}
      className="adsbygoogle pinad__unit"
      style={{ display: "block", textAlign: "center" }}
      data-ad-layout="in-article"
      data-ad-format="fluid"
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
    />
  ) : (
    <ins
      ref={ref}
      className="adsbygoogle pinad__unit"
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
