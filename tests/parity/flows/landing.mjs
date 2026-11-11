/* The landing page against its original (prototypes/landing/). Reduced motion only: with full motion its shader and
   scroll-driven tweens run continuously, so there is no settled state to compare. tests/e2e/journey.mjs covers full motion. */
const base = { page: "landing", start: "", fullMotion: false };

const each = (name, steps) =>
  ["desktop", "tablet", "phone"].map(viewport => ({ ...base, name, viewport, steps }));

export default [
  ...each("page", []),
  ...each("sections", [
    { goto: "#how" },
    { goto: "#sides" },
    { goto: "#trust" },
    { goto: "#start" },
    { goto: "#top" },
  ]),
  {
    ...base,
    name: "steps-rail",
    viewport: "desktop",
    steps: [
      { dispatch: '.st-nav[data-dir="1"]' },
      { dispatch: '.st-nav[data-dir="1"]' },
      { dispatch: '.st-nav[data-dir="-1"]' },
    ],
  },
  {
    ...base,
    name: "sides-switch-and-bid",
    viewport: "desktop",
    steps: [
      { dispatch: "#sdTabB" },
      { dispatch: '.sd-sb[data-key="price"]' },
      { dispatch: ".sd-acc" },
      { dispatch: "#sdTabC" },
      { dispatch: '.sd-step[data-step="500"]' },
      { dispatch: '.sd-step[data-step="-500"]' },
      { dispatch: "#sdSend" },
    ],
  },
  {
    ...base,
    name: "pick-side-links",
    viewport: "desktop",
    steps: [
      { dispatch: '.hx-ctas a[data-pick-side="brand"]' },
      { dispatch: '.ct-ctas a[data-pick-side="creator"]' },
    ],
  },
  {
    ...base,
    name: "trust-escrow-and-payout",
    viewport: "desktop",
    steps: [
      { dispatch: '.tr-node[data-i="1"]' },
      { dispatch: '.tr-node[data-i="3"]' },
      { dispatch: "#trRefund" },
      { dispatch: "#trRefund" },
      { dispatch: 'button[data-v="50000"]' },
      { dispatch: 'button[data-d="bank"]' },
    ],
  },
  {
    ...base,
    name: "platform-drawers",
    viewport: "desktop",
    steps: [
      { dispatch: "#pf-r-ig" },
      { dispatch: "#pf-t-post" },
      { dispatch: "#pf-t-story" },
      { dispatch: "#pf-r-yt" },
      { dispatch: "#pf-t-short" },
      { dispatch: "#pf-r-yt" },
    ],
  },
  {
    ...base,
    name: "newsletter-form",
    viewport: "desktop",
    steps: [
      { fill: ["#subEmail", "not-an-email"] },
      { dispatch: ".sub" },
      { fill: ["#subEmail", "creator@example.com"] },
      { dispatch: ".sub" },
    ],
  },
];
