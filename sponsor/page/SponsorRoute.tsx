import type { Metadata } from "next";
import SponsorPage from "./SponsorPage";
import "@/app/hero.css";
import "@/app/sections.css";

export const metadata: Metadata = {
  title: "Sponsor — Pin UI",
  description:
    "Back Pin UI: sponsor as Diamond or Gold, or chip in as a supporter, and help fund new open-source blocks and components.",
  alternates: { canonical: "/sponsor" },
};

/**
 * The sponsor plans — where the landing page's sponsor boxes go.
 *
 * A static page: the same for everyone, so it is prerendered and served from
 * the CDN rather than rendered by a function on every visit. When the
 * checkout route cannot open Dodo's checkout it sends the visitor back here
 * with `?checkout=…`, and the one line that explains why is read from the
 * address in the browser (CheckoutNotice.tsx).
 */
export default function SponsorRoute() {
  return <SponsorPage />;
}
