/**
 * Adsterra — every ad unit in one place.
 *
 * Where each one goes, and why, is in components/ads/AdSlot.tsx and the pages
 * that render it. The short version: in the breaks between sections, after
 * the thing people came for, never inside a live stage, a form or a payment.
 *
 * Set NEXT_PUBLIC_ADS=off (in .env.local, or on Vercel) to switch every unit
 * off at once without touching the code.
 */

export const ADS_ON = process.env.NEXT_PUBLIC_ADS !== "off";
/* on localhost a slot Adsterra leaves empty shows where it is; in production it folds away */
export const ADS_DEV = process.env.NODE_ENV !== "production";

/** Adsterra's banner host: `<host>/<key>/invoke.js`. */
export const BANNER_HOST = "https://www.highperformanceformat.com";

export type BannerUnit = { kind: "banner"; key: string; width: number; height: number; label: string };
export type NativeUnit = { kind: "native"; src: string; container: string; label: string };
export type AdUnit = BannerUnit | NativeUnit;

export const UNITS = {
  /* responsive, in the page's own type: the main unit, at every width */
  native: {
    kind: "native",
    src: "https://bauval.org/21/c050c143b93e1d83e5ef752ef97b6c5c",
    container: "container-c050c143b93e1d83e5ef752ef97b6c5c",
    label: "Native",
  },
  /* tablets and up, where the column is at least 728px wide */
  leaderboard: { kind: "banner", key: "a6ec60a841bbdff550d5c95a11b4681a", width: 728, height: 90, label: "728×90" },
  /* the side rail, only where a wide screen leaves an empty margin for it */
  skyscraper: { kind: "banner", key: "ca2fec39aa7920425f4d9edf7405c72d", width: 160, height: 600, label: "160×600" },
} as const satisfies Record<string, AdUnit>;

export type UnitName = keyof typeof UNITS;

/** The Social Bar: one script, drawn by Adsterra itself, loaded by components/AdTag.tsx. */
export const SOCIAL_BAR_SRC = "https://bauval.org/14/50aa0cb20eedc764a879b7bc3f921d31";
