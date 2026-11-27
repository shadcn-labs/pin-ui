/**
 * The library index: one entry per component, with what the shelf cards, the
 * hero wall and the sidebar need — its name, its media and its stage. Free of
 * React and of `node:fs`, so it can be read anywhere.
 *
 * This file is imported by code that runs in the browser, and a module ships
 * whole, so it carries nothing else. Each entry's long half — its
 * description, props table, usage and how-it-works paragraphs, and the
 * `files` the component page reads off disk — lives in registry-docs.ts,
 * which only the server reads. Add a component by adding its entry here and
 * its docs there, under the same slug.
 */

export type SourceFile = {
  /**
   * The file's name inside `components/library`. It is both what the tab is
   * called and what is read off disk at build time — the two cannot drift,
   * because there is only one of them.
   */
  name: string;
  /** Highlighting hint for the code panel. */
  lang: "tsx" | "css";
};

export type PropSpec = {
  name: string;
  type: string;
  required?: boolean;
  fallback?: string;
  note: string;
};

/**
 * The shelves the library is sorted onto — the sections of the index page and
 * of the sidebar, in the order they are read. A component's place within its
 * shelf is its place in LIBRARY, newest first.
 */
export const CATEGORIES = [
  { id: "controls", name: "Inputs & controls" },
  { id: "cards", name: "Cards & widgets" },
  { id: "media", name: "Audio & media" },
  { id: "lists", name: "Lists & pickers" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export type Entry = {
  slug: string;
  /** The name on the shelf card. */
  name: string;
  /**
   * The preview loop: a few seconds of the recording, cut to start on its most
   * alive moment, at 960px and 30fps with no audio — about 80KB. The full
   * 1080p60 recordings are 1–2MB each and used to be seeked 9–15 seconds in
   * before a card could show anything, which is what made the hero band sit
   * empty for seconds after every reload.
   *
   * Left out for a component that has not been recorded yet: its card shows
   * the poster instead, and it stays out of the hero band until it has a loop.
   */
  clip?: string;
  /**
   * Set false to keep a recorded component's loop on the shelf only, out of
   * the hero band and the Pinterest peek.
   */
  hero?: boolean;
  /**
   * The loop's first frame as a still, so a card is never blank while it
   * loads — or, for a component without a loop yet, a screenshot of it.
   */
  poster: string;
  /**
   * Whether the component makes any sound. The workbench only offers its
   * speaker control for the ones that do — a mute button on a silent
   * component is a control that does nothing.
   */
  sound: boolean;
  /**
   * How much to zoom the clip inside the card frame. The three were recorded at
   * 1920×1080 with the component centred at different sizes; this brings them
   * all to about the same presence on the shelf.
   */
  zoom: number;
  /**
   * The field the component was designed to sit on. Each one carries its own
   * dark or light backdrop, so the preview shows it the way it is meant to be
   * seen rather than dropping it onto the page's own paper.
   */
  stage: string;
  /**
   * Set only for components drawn in both a light and a dark theme. The stage
   * shows the dark one, on this field, whenever the site is switched to its
   * crimson state; the others keep the one field they were designed on.
   */
  stageDark?: string;
  /**
   * Wider than a card. The stage normally holds a component to a card's width;
   * these get the room they were laid out in.
   */
  wide?: boolean;
  /**
   * A scene rather than an object: it fills the whole stage, edge to edge, with
   * no padding or width cap — the 3-D pad is drawn into the frame itself.
   */
  fill?: boolean;
  /**
   * Its animation runs past its own box — the Egg OTP's eggs break and fall. The
   * stage lets that spill show instead of scrolling to it; the frame around
   * the stage still clips it. Only for components too short to ever need to
   * scroll inside the stage.
   */
  spill?: boolean;
  /**
   * The field behind the shelf and carousel loop, when the loop was recorded
   * on a different field from the stage's light one — the Egg OTP loop is
   * recorded in its dark theme.
   */
  clipStage?: string;
  /**
   * Flagged with a "New" tag on the shelf, in the sidebar and on its page.
   * Never written by hand: it is set below for exactly the components the
   * landing page shows, so the two can never disagree.
   */
  isNew?: boolean;
  /** Which shelf it sits on, in the sidebar and on the index page. */
  category: CategoryId;
  /**
   * Who made it, shown as a small colour-cycling dot after the name — in the
   * sidebar and on the shelf — with a tooltip that links to their X profile.
   */
  creator?: { handle: string; url: string };
  /**
   * Who asked for it, shown as a "Requested by @handle" chip at the top of its
   * stage that links to their X profile.
   */
  requestedBy?: { handle: string; url: string };
};

const ENTRIES: Entry[] = [
  {
    slug: "cover-drop",
    category: "controls",
    name: "Cover Drop",
    /* a recording of the live field in its dark theme on Burst: two photos dropped in, one tapped, then removed back into its slot */
    clip: "/clips/loop/cover-drop.mp4",
    /* the loop's own first frame: the empty field and the row under it */
    poster: "/clips/loop/cover-drop.jpg",
    sound: false,
    /* the recording leaves wide field around the column: 1.25 brings it forward and keeps the burst in */
    zoom: 1.25,
    stage: "#f4f4f5",
    stageDark: "#131313",
    clipStage: "#131313",
  },
  {
    slug: "sling-slider",
    category: "controls",
    name: "Sling Slider",
    /* a recording of the live slider in its dark theme: dragging the bars, then slinging the ball */
    clip: "/clips/loop/sling-slider.mp4",
    poster: "/clips/loop/sling-slider.jpg",
    sound: false,
    /* the recording leaves wide field around the slider: 1.5 brings it forward and keeps the arc in */
    zoom: 1.5,
    stage: "#f4f3ef",
    stageDark: "#111111",
    clipStage: "#111111",
    /* 59 bars and the reading are nearly 700px: it gets the room it was drawn in, and scales down below that */
    wide: true,
    /* a ball pulled back past either end of the track is drawn outside the slider's box: the stage shows it */
    spill: true,
  },
  {
    slug: "presence-cards",
    category: "cards",
    name: "Presence Cards",
    /* a recording of the live stage in its dark theme: the four at work, and a visitor painting cells and dragging the artwork's corner */
    clip: "/clips/loop/presence-cards.mp4?v=2",
    /* the loop's own first frame (v=2: it replaced the screenshot that stood in before the recording) */
    poster: "/clips/loop/presence-cards.jpg?v=2",
    sound: false,
    /* the recording leaves wide field around the scene: 1.3 fills the card and still keeps every name tag in */
    zoom: 1.3,
    stage: "#f4f4f5",
    stageDark: "#0d0d0f",
    clipStage: "#0d0c0f",
    /* a scene: the canvas and its blooms fill the whole stage */
    fill: true,
  },
  {
    slug: "theme-switch",
    category: "controls",
    name: "Theme Switch",
    /* a remocn edit of a frame-exact recording of the live switch: Droplet, Rain and Diwali, then Droplet back to where it began */
    clip: "/clips/loop/theme-switch.mp4",
    poster: "/clips/loop/theme-switch.jpg",
    sound: true,
    zoom: 1,
    stage: "#ffffff",
    clipStage: "#141414",
    stageDark: "#141414",
    /* a scene: the effects fill the whole stage */
    fill: true,
  },
  {
    slug: "reader-card",
    category: "cards",
    name: "Reader Card",
    /* the dark half of the recording of the live card, at 960px and 30fps: it opens on its passage, is read and resized, and folds back into the card */
    clip: "/clips/loop/reader-card.mp4",
    poster: "/clips/loop/reader-card.jpg",
    sound: false,
    zoom: 1,
    stage: "#dcdcdc",
    clipStage: "#0e0e10",
    stageDark: "#0e0e10",
    /* a scene: the ambient light fills the stage and the reader opens across it */
    fill: true,
  },
  {
    slug: "search-card",
    category: "controls",
    name: "Search Card",
    /* a remocn edit of a frame-exact recording of the live card: it rises open, the sheet glides, a row is
       binned, a chip goes and the count rolls, "set" filters the list, and it folds back into the middle */
    clip: "/clips/loop/search-card.mp4",
    poster: "/clips/loop/search-card.jpg",
    sound: false,
    zoom: 1,
    stage: "#ececef",
    clipStage: "#ececef",
    stageDark: "#0b0b0d",
  },
  {
    slug: "selection-list",
    category: "lists",
    name: "Selection List",
    /* a remocn edit of a frame-exact recording of the live list: the rows arrive, then each one is picked in turn and the choice cleared */
    clip: "/clips/loop/selection-list.mp4",
    poster: "/clips/loop/selection-list.jpg",
    sound: false,
    zoom: 1,
    stage: "#f6f4f1",
    clipStage: "#f6f4f1",
    stageDark: "#221f20",
  },
  {
    slug: "desk-computer",
    category: "controls",
    name: "Desk Computer",
    /* recorded in light: a remocn edit of a frame-exact recording of the live figure — it assembles,
       the mouse is dragged, a search is typed, and the CD flies into the drive as AutoPlay opens */
    clip: "/clips/loop/desk-computer.mp4",
    poster: "/clips/loop/desk-computer.jpg",
    sound: true,
    zoom: 1,
    stage: "#ffffff",
    clipStage: "#ffffff",
    stageDark: "#0f1013",
    /* a scene: it fills the stage and fits the drawing to it */
    fill: true,
  },
  {
    slug: "liquid-voice",
    category: "media",
    name: "Liquid Voice",
    /* a remocn edit of a frame-exact recording of the live pill: record and send by day, night spreads from the pill, record and cancel, day comes back */
    clip: "/clips/loop/liquid-voice.mp4",
    poster: "/clips/loop/liquid-voice.jpg",
    sound: false,
    zoom: 1,
    stage: "#0d5bb5",
    clipStage: "#0d5bb5",
    stageDark: "#060b1c",
    /* a scene, not a card: the sky fills the stage edge to edge */
    fill: true,
  },
  {
    slug: "file-box",
    category: "cards",
    name: "File Box",
    /* a remocn edit of a frame-exact recording of the live box: the folders file in, lift one by one, and the pink one is tugged */
    clip: "/clips/loop/file-box.mp4",
    poster: "/clips/loop/file-box.jpg",
    sound: false,
    zoom: 1,
    stage: "#fbe9d2",
    clipStage: "#fbe9d2",
    stageDark: "#17130f",
    /* a scene on its own grained paper: it fills the stage and centres itself */
    fill: true,
  },
  {
    slug: "copy-paste-pad",
    category: "controls",
    name: "Copy Paste Pad",
    /* a remocn edit of a frame-exact recording of the live pad: ⌘C, flip to dark, ⌘V back to light */
    clip: "/clips/loop/copy-paste-pad.mp4",
    poster: "/clips/loop/copy-paste-pad.jpg",
    hero: false,
    sound: true,
    zoom: 1,
    stage: "#f2c300",
    clipStage: "#f2c300",
    stageDark: "#0f0f11",
    /* a scene, not a card: it fills the stage edge to edge */
    fill: true,
  },
  {
    slug: "task-card",
    category: "cards",
    name: "Task Card",
    /* recorded in dark: a remocn edit of a frame-exact recording of the live card */
    clip: "/clips/loop/task-card.mp4",
    poster: "/clips/loop/task-card.jpg",
    hero: false,
    sound: false,
    zoom: 1.3,
    stage: "#f6f6f7",
    clipStage: "#0a0a0b",
    stageDark: "#0a0a0b",
    /* the menus open past the card's edge */
    spill: true,
  },
  {
    slug: "magnify",
    category: "cards",
    name: "Magnify",
    /* recorded in dark: a remocn edit of the real component, its springs replayed frame by frame */
    clip: "/clips/loop/magnify.mp4",
    poster: "/clips/loop/magnify.jpg",
    hero: false,
    sound: false,
    zoom: 1,
    stage: "#ffffff",
    /* the loop is the dark face, so its frame is the dark field */
    clipStage: "#0b0b0c",
    stageDark: "#0b0b0c",
    /* the poster's long shadow and the lens's handle run past the paper */
    spill: true,
  },
  {
    slug: "progress-image",
    category: "controls",
    name: "Progress Image",
    /* a remocn edit of the real component, rendered from the same reveal engine */
    clip: "/clips/loop/progress-image.mp4",
    poster: "/clips/loop/progress-image.jpg",
    hero: false,
    sound: false,
    zoom: 1,
    stage: "#f4f4f4",
    clipStage: "#f4f4f4",
    stageDark: "#0e0e0f",
    /* the card's long soft shadow and the switcher's offset shadow run past their boxes */
    spill: true,
  },
  {
    slug: "prompt-composer",
    category: "controls",
    name: "Prompt Composer",
    /* recorded in dark, in 4K: a remocn edit of the real component */
    clip: "/clips/loop/prompt-composer.mp4",
    poster: "/clips/loop/prompt-composer.jpg",
    hero: false,
    sound: false,
    zoom: 1,
    stage: "#f3f3f3",
    /* the loop is the dark face, so its frame is the dark stage */
    clipStage: "#0b0b0c",
    stageDark: "#0b0b0c",
    /* laid out as a wide row — pill, field, send — not a card */
    wide: true,
    /* the cards' and the field's soft shadows run past their boxes */
    spill: true,
  },
  {
    slug: "calendar-card",
    category: "cards",
    name: "Calendar",
    clip: "/clips/loop/calendar-card.mp4?v=2",
    poster: "/clips/loop/calendar-card.jpg?v=2",
    hero: false,
    sound: false,
    zoom: 1,
    stage: "#f4f4f4",
    clipStage: "#f4f4f4",
    /* the card's long soft shadow runs past its box */
    spill: true,
    stageDark: "#0b0b0c",
  },
  {
    slug: "chat-room",
    requestedBy: { handle: "hrstwt", url: "https://x.com/hrstwt" },
    category: "lists",
    name: "Chat Room",
    clip: "/clips/loop/chat-room.mp4",
    poster: "/clips/loop/chat-room.jpg",
    hero: false,
    sound: true,
    zoom: 1,
    stage: "#f5f5f6",
    clipStage: "#f5f5f6",
    /* the card's soft shadow runs past its box; clipped there it draws a line */
    spill: true,
    stageDark: "#0c0c0d",
  },
  {
    slug: "dynamic-drop-zone",
    requestedBy: { handle: "hrstwt", url: "https://x.com/hrstwt" },
    category: "controls",
    name: "Dynamic Drop Zone",
    clip: "/clips/loop/dynamic-drop-zone.mp4?v=3",
    poster: "/clips/loop/dynamic-drop-zone.jpg?v=3",
    hero: false,
    sound: false,
    zoom: 1,
    stage: "#e6e8ee",
    clipStage: "#e6e8ee",
    /* the zone's soft shadow, and the hole's swelling, run past its box */
    spill: true,
    stageDark: "#050506",
  },
  {
    slug: "swap-card",
    category: "cards",
    name: "Swap Card",
    clip: "/clips/loop/swap-card.mp4",
    poster: "/clips/loop/swap-card.jpg",
    hero: false,
    sound: false,
    zoom: 1,
    stage: "#eaecef",
    clipStage: "#eaecef",
    /* the token list and the swap burst open past the card's box */
    spill: true,
    stageDark: "#0e0f12",
  },
  {
    slug: "liquid-tabs",
    category: "lists",
    name: "Liquid Tabs",
    clip: "/clips/loop/liquid-tabs.mp4?v=2",
    poster: "/clips/loop/liquid-tabs.jpg?v=2",
    hero: false,
    sound: false,
    zoom: 1,
    stage: "#e9e9eb",
    clipStage: "#e8e8e8",
    /* the card's soft shadow runs past its box; clipped there it draws a line on a short stage */
    spill: true,
    stageDark: "#0c0c0e",
  },
  {
    slug: "thermal-dial",
    category: "cards",
    name: "Thermal Dial",
    clip: "/clips/loop/thermal-dial.mp4?v=2",
    poster: "/clips/loop/thermal-dial.jpg?v=2",
    hero: false,
    sound: false,
    zoom: 1,
    stage: "#ebe9e5",
    clipStage: "#050706",
    /* the glow under the dial runs past its box; clipped there it draws a hard line on a short stage */
    spill: true,
    stageDark: "#060606",
  },
  {
    slug: "lamp-switch",
    category: "controls",
    name: "Lamp Switch",
    clip: "/clips/loop/lamp-switch.mp4?v=2",
    poster: "/clips/loop/lamp-switch.jpg?v=2",
    hero: false,
    sound: false,
    zoom: 1,
    stage: "#e4dfd6",
    clipStage: "#e0ddd4",
    stageDark: "#313539",
  },
  {
    slug: "joystick",
    category: "controls",
    name: "Joystick",
    clip: "/clips/loop/joystick.mp4",
    poster: "/clips/loop/joystick.jpg",
    hero: false,
    sound: true,
    zoom: 0.9,
    stage: "#9ab5d3",
    stageDark: "#1f2638",
    wide: true,
  },
  {
    slug: "weather",
    category: "cards",
    name: "Weather",
    clip: "/clips/loop/weather.mp4",
    poster: "/clips/loop/weather.jpg",
    hero: false,
    sound: false,
    zoom: 1.15,
    stage: "#ebebeb",
    stageDark: "#0e0e0f",
    wide: true,
  },
  {
    slug: "recorder",
    category: "media",
    name: "Recorder",
    clip: "/clips/loop/recorder.mp4",
    poster: "/clips/loop/recorder.jpg",
    hero: false,
    sound: true,
    zoom: 1.1,
    stage: "#e2e2e1",
    stageDark: "#363636",
    clipStage: "#363636",
  },
  {
    slug: "taxi",
    category: "cards",
    name: "Taxi",
    clip: "/clips/loop/taxi.mp4",
    poster: "/clips/loop/taxi.jpg",
    hero: false,
    sound: true,
    zoom: 1.3,
    stage: "#f2f2f2",
    stageDark: "#0f0e0b",
    spill: true,
  },
  {
    slug: "chips",
    category: "controls",
    name: "Chips",
    clip: "/clips/loop/chips.mp4",
    poster: "/clips/loop/chips.jpg",
    sound: true,
    zoom: 0.94,
    stage: "#edeae4",
    stageDark: "#121211",
    wide: true,
  },
  {
    slug: "otp-input",
    category: "controls",
    name: "Egg OTP",
    creator: { handle: "RachitThakur146", url: "https://x.com/RachitThakur146" },
    clip: "/clips/loop/otp-input-dark.mp4",
    poster: "/clips/loop/otp-input-dark.jpg",
    sound: false,
    zoom: 1.65,
    stage: "#ffffff",
    stageDark: "#0b0b0b",
    clipStage: "#0b0b0b",
    spill: true,
  },
  {
    slug: "add-member",
    category: "lists",
    name: "Add Member",
    clip: "/clips/loop/add-member.mp4",
    poster: "/clips/loop/add-member.jpg",
    sound: false,
    zoom: 1.2,
    stage: "#f1f1f1",
    stageDark: "#08080a",
  },
  {
    slug: "session-list",
    category: "lists",
    name: "Count down",
    clip: "/clips/loop/session-list.mp4",
    poster: "/clips/loop/session-list.jpg",
    sound: false,
    zoom: 1.3,
    stage: "#2d8cff",
  },
  {
    slug: "balance-card",
    category: "cards",
    name: "Balance Card",
    clip: "/clips/loop/balance-card.mp4",
    poster: "/clips/loop/balance-card.jpg",
    sound: true,
    zoom: 1.25,
    stage: "#232323",
  },
  {
    slug: "cart-card",
    category: "cards",
    name: "Add To Cart",
    clip: "/clips/loop/cart-card.mp4",
    poster: "/clips/loop/cart-card.jpg",
    sound: true,
    zoom: 1,
    stage: "#ececec",
  },
];

/**
 * How many of the newest components the landing page shows under the hero.
 * Those, and only those, wear the "New" tag — on the landing shelf, the
 * library index, the sidebar and their own pages. Add a component to the top
 * of the list and the oldest of them hands its tag on.
 */
export const LANDING_SHOWN = 5;

/**
 * The card-sized WebP of a poster: "/clips/loop/x.jpg?v=2" → "/clips/thumb/x.webp?v=2".
 * Wherever a poster is shown at card size — the shelf, the hero wall, the
 * Pinterest peek, the star card — this is what is loaded: 768×432 rather than
 * the 1280×720 JPEG, about a fifth of the bytes. scripts/make-thumbs.py makes them.
 */
export function thumbOf(poster: string): string {
  return poster.replace(/^\/clips\/loop\/([^/?]+)\.jpg/, "/clips/thumb/$1.webp");
}

/**
 * The small-tile copy of a loop: "/clips/loop/x.mp4" → "/clips/wall/x.mp4".
 * The hero wall plays up to two dozen tiles at once at about 340px and the
 * Pinterest peek smaller still, so both play these 640×360 copies — under half
 * the pixels to decode each frame and about a third of the bytes. The shelf
 * and the component pages keep the 960px loops. scripts/make-wall-clips.py
 * makes them.
 */
export function wallOf(clip: string): string {
  return clip.replace(/^\/clips\/loop\//, "/clips/wall/");
}

/** The library, newest first, with "New" set on the ones the landing page shows. */
export const LIBRARY: Entry[] = ENTRIES.map((entry, i) => ({ ...entry, isNew: i < LANDING_SHOWN }));


export const bySlug = (slug: string) => LIBRARY.find((entry) => entry.slug === slug);

/** The library sorted onto its shelves, empty shelves left out. */
export function byCategory() {
  return CATEGORIES.map((category) => ({
    ...category,
    entries: LIBRARY.filter((entry) => entry.category === category.id),
  })).filter((group) => group.entries.length > 0);
}
