import type { Transition } from "motion/react";

/**
 * Motion tokens. Everything in Pin UI animates on a spring — no duration-based
 * easing — so movement keeps a single physical character across the UI.
 */

/** The workhorse: quick, confident, almost no overshoot. */
export const spring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.9,
};

/** Softer and longer, for entrances and layout morphs. */
export const softSpring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 1,
};

/**
 * The ticket being issued: it arrives with some weight behind it and settles
 * rather than snapping, which is what makes it read as an object being handed
 * over instead of a box fading in.
 */
export const issueSpring: Transition = {
  type: "spring",
  stiffness: 240,
  damping: 22,
  mass: 1.1,
};

/** An overdamped spring for exits — travels out with no bounce on the way. */
export const exitSpring: Transition = {
  type: "spring",
  stiffness: 460,
  damping: 46,
  mass: 0.8,
};

/** Loose and bouncy, for small delightful pops (checkmark, chip). */
export const bouncySpring: Transition = {
  type: "spring",
  stiffness: 600,
  damping: 18,
  mass: 0.6,
};

/**
 * A copy button's icon swap. Feedback for a click has to land on the click:
 * a short tween rather than a spring, with the old face and the new crossing
 * at once instead of one waiting for the other to leave.
 */
export const swapQuick: Transition = { duration: 0.12, ease: [0.2, 0, 0, 1] };
