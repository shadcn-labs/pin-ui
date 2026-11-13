"use client";

import { useEffect, useState } from "react";
import { ADS_ON } from "@/lib/adsterra";
import AdSlot from "./AdSlot";

/**
 * The 160×600 skyscraper, in the empty margin beside a page's content.
 *
 * It only exists where a screen is wide enough to leave that margin empty:
 * it measures the content column it sits beside (`anchor`, a selector) and
 * appears only when the space to its right takes the ad with room to spare,
 * and the window is tall enough to show it whole. So it can never cover a
 * word or a card. It stays put while the page scrolls, and steps aside for
 * the footer so the two never meet.
 */

const AD_W = 160;
const AD_H = 600;
/* clear space on both sides of the ad */
const GAP = 32;

export default function AdRail({ anchor }: { anchor: string }) {
  const [room, setRoom] = useState(false);
  const [footer, setFooter] = useState(false);

  useEffect(() => {
    if (!ADS_ON) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const column = document.querySelector(anchor);
      if (!column) return setRoom(false);
      const right = column.getBoundingClientRect().right;
      const free = window.innerWidth - right;
      setRoom(free >= AD_W + GAP * 2 && window.innerHeight >= AD_H + 120);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", schedule);
    const column = document.querySelector(anchor);
    const watch = column ? new ResizeObserver(schedule) : null;
    if (column) watch?.observe(column);
    return () => {
      window.removeEventListener("resize", schedule);
      watch?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [anchor]);

  /* the footer arriving: the rail fades out of its way */
  useEffect(() => {
    if (!ADS_ON) return;
    const foot = document.querySelector("footer");
    if (!foot) return;
    const watch = new IntersectionObserver(([entry]) => setFooter(entry.isIntersecting));
    watch.observe(foot);
    return () => watch.disconnect();
  }, []);

  if (!ADS_ON || !room) return null;
  return (
    <div className="pinad-rail" data-away={footer || undefined}>
      <AdSlot unit="skyscraper" />
    </div>
  );
}
