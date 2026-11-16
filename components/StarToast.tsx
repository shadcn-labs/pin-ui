"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import PinMark from "./PinMark";
import { LINKS } from "@/lib/links";
import { formatStars, useGitHubStars } from "@/lib/useGitHubStars";
import "./star-toast.css";

/**
 * "Liking Pin UI so far?" — a small note in the corner asking for a star on
 * GitHub and a follow on X.
 *
 * It is a toast, not a dialog: it never takes focus, never dims the page and
 * never stands between the visitor and what they were doing. It slides in
 * from the side a moment after the page has arrived, so the page itself is
 * seen first.
 *
 * Where: the pages people browse — the component list, the Blocx index, the
 * testimonials and the FAQ. Never the landing page, which makes its own case
 * (and has its own star card while sponsoring is parked); never inside a
 * component or a Blocx block, where people are looking at the thing itself
 * and the stage's own bar sits at the foot of the screen; and never the
 * waitlist, the sponsor checkout or the policies.
 *
 * How often: every time. Every load and every reload brings it, and so does
 * coming back to a browsing page from a component or a block. The cross, or
 * an answer, puts it away for the rest of that page load — moving between
 * browsing pages does not bring it straight back — and a reload or a new
 * visit asks again.
 */

/* long enough for the page to arrive first, short enough to be there on every look */
const DELAY_MS = 2200;

const PAGES = new Set(["/components", "/blocx", "/testimonials", "/faq"]);

/* in from the side with a slight spring, out the same way */
const slideIn: Transition = { type: "spring", visualDuration: 0.5, bounce: 0.2 };
const slideOut: Transition = { duration: 0.22, ease: [0.4, 0, 1, 1] };

const allowed = (path: string) => PAGES.has(path);

export default function StarToast() {
  const pathname = usePathname() ?? "";
  const reduced = useReducedMotion();
  const stars = useGitHubStars();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  /* put away for the rest of this page load: a reload starts afresh */
  const putAway = useRef(false);
  const onPage = allowed(pathname);

  /*
   * Arriving on a browsing page — by loading it, reloading it, or coming back
   * to it from a component or a block — brings it in after a beat. Leaving
   * for a page it does not belong on takes it away. Moving between browsing
   * pages leaves it as it is.
   */
  useEffect(() => {
    if (!onPage) {
      setOpen(false);
      return;
    }
    if (putAway.current) return;
    const timer = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, [onPage]);

  const close = () => {
    putAway.current = true;
    setOpen(false);
  };

  return (
    /*
     * The dock: a fixed strip in the corner (the foot of the screen on a
     * phone) that clips what slides through it. The card comes in from past
     * the screen's edge, and without the clip that moment would put it
     * outside the page — which on a phone lets the whole page pan sideways.
     * It is empty, and lets every press through, whenever the card is not
     * there.
     */
    <div className="stoast-dock">
    <AnimatePresence>
      {open && (
        <motion.aside
          className="stoast"
          role="region"
          aria-labelledby={titleId}
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 64 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0, transition: slideIn }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: 48, transition: slideOut }}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <div className="stoast__head">
            <PinMark className="stoast__mark" />
            <button type="button" className="stoast__close" onClick={close} aria-label="Not now">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <p className="stoast__title" id={titleId}>
            Liking Pin UI so far?
          </p>
          <p className="stoast__copy">
            Star the repo and follow along on X for new components, drops and behind-the-scenes builds.
          </p>

          <div className="stoast__actions">
            <a
              className="stoast__btn stoast__btn--follow"
              href={LINKS.x}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="stoast__icon">
                <path d="M17.75 3h3.07l-6.71 7.67L22 21h-6.18l-4.84-6.33L5.44 21H2.37l7.18-8.2L2 3h6.34l4.37 5.78L17.75 3Zm-1.08 16.17h1.7L7.4 4.73H5.58l11.09 14.44Z" />
              </svg>
              Follow
            </a>
            <a
              className="stoast__btn stoast__btn--star"
              href={LINKS.github}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              aria-label={typeof stars === "number" ? `Star Pin UI on GitHub, ${stars} stars` : "Star Pin UI on GitHub"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="stoast__icon">
                <path d="M12 2.2a9.8 9.8 0 0 0-3.1 19.1c.5.1.67-.21.67-.47v-1.66c-2.73.6-3.3-1.31-3.3-1.31-.45-1.14-1.1-1.44-1.1-1.44-.89-.61.07-.6.07-.6.98.07 1.5 1.01 1.5 1.01.88 1.5 2.3 1.07 2.86.82.09-.64.34-1.07.62-1.31-2.18-.25-4.47-1.09-4.47-4.85 0-1.07.38-1.95 1.01-2.63-.1-.25-.44-1.25.1-2.6 0 0 .82-.27 2.7 1a9.3 9.3 0 0 1 4.9 0c1.87-1.27 2.7-1 2.7-1 .53 1.35.2 2.35.1 2.6.63.68 1 1.56 1 2.63 0 3.77-2.29 4.6-4.48 4.84.35.3.67.9.67 1.82v2.7c0 .26.18.58.68.47A9.8 9.8 0 0 0 12 2.2Z" />
              </svg>
              Star
              {typeof stars === "number" && <span className="stoast__count">{formatStars(stars)}</span>}
            </a>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
    </div>
  );
}
