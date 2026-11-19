"use client";

import { useSearchParams } from "next/navigation";
import { LINKS } from "@/lib/links";

/* what the page says when the checkout route sends a visitor back here instead of to Dodo */
const NOTICES = {
  unavailable: "Checkout isn't open yet. Please try again soon, or write to us at ",
  error: "We couldn't open the checkout just now. Please try again, or write to us at ",
  busy: "Too many tries in a row. Wait a minute and try again, or write to us at ",
} as const;

type Notice = keyof typeof NOTICES;
const isNotice = (value: string | null): value is Notice => value !== null && value in NOTICES;

/**
 * The line under the heading when a checkout could not open: `/sponsor?checkout=…`.
 *
 * Read in the browser rather than on the server so that /sponsor itself is a
 * static page, served from Vercel's CDN to everyone, instead of a function run
 * on every visit for a line almost nobody ever sees. The page renders this
 * inside a Suspense boundary, so only this line waits for the address — the
 * rest of the page is in the prerendered HTML.
 */
export default function CheckoutNotice() {
  const value = useSearchParams().get("checkout");
  if (!isNotice(value)) return null;
  return (
    <p className="sp__notice" role="alert">
      {NOTICES[value]}
      <a href={`mailto:${LINKS.email}`}>{LINKS.email}</a>.
    </p>
  );
}
