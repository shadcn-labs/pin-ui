/**
 * Google AdSense — every identifier in one place.
 *
 * Three ad units, each placed once, on pages that are reading or browsing
 * rather than playing: never on the landing hero, and never on a component's
 * live stage, where an ad would sit on the thing people came to try.
 *
 *   indexDisplay   "UI"    Display      /components, after the "Just added" shelf
 *   docsInArticle  "UI2"   In-article   /blocx/[slug], inside the docs, after the first two text sections
 *   blocxDisplay   "UI 3"  Display      /blocx, after the first shelf
 *
 * The AdSense library is the code snippet AdSense asks for, in the <head> of
 * every page (app/layout.tsx), which is also what its site verification looks
 * for; the `google-adsense-account` meta tag beside it verifies the site too,
 * and public/ads.txt names this publisher as an authorised seller.
 */

export const ADSENSE_CLIENT = "ca-pub-3898386786530632";

export const AD_SLOTS = {
  indexDisplay: "7479460685",
  docsInArticle: "5682008330",
  blocxDisplay: "6841166433",
} as const;

export type AdSlotName = keyof typeof AD_SLOTS;

/**
 * Real ads only in production. AdSense does not serve to localhost, so in
 * development each slot draws a labelled placeholder of its reserved size
 * instead — the layout can be checked without requesting a single ad.
 */
export const ADS_LIVE = process.env.NODE_ENV === "production";
