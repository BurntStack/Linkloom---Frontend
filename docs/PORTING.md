# Linkloom frontend: porting contract

`prototype/` is the approved design. It is the source of truth and is **read-only**.
`src/` must stay indistinguishable from it to a user. This is a refactor, not a redesign.

## The one rule

No user-visible change: same DOM, classes, attributes, copy, CSS, motion, timing, focus order, keyboard behaviour,
validation messages and sample data. That includes things you would improve. If you find a real bug or awkward copy
in the prototype, **keep it** and list it in your final report; do not fix it.

Do not add features, dependencies, frameworks, persistence, or a backend.

## What "done" means for a file

1. `// @ts-nocheck` is gone and it compiles under `strict` with no `any` in exported signatures.
   Local `any` is allowed only at a genuinely dynamic boundary and needs a one-line reason.
2. No globals: no `window.LLD`, `LLD_DATA`, `LLD_C`, `LLA`, `window.gsap`, no bare `LLD.`. Everything is imported.
3. Real ES module: the outer IIFE is gone; shared things are named exports, not properties attached to a global.
4. Readable: long render functions split into small named functions inside the module (or sibling files in the same
   folder). Template strings are moved **verbatim**: whitespace inside a template literal is part of the DOM.
5. The parity gate passes for the routes you own, and your flow file covers the screen's interactions.

## How to work

- Convert with targeted edits. Do not retype whole files from memory: templates must stay byte-identical.
- Keep module-load side effects (`register`, listeners) in the same relative order. `src/main.ts` import order is
  the prototype's script order and the cascade order; do not reorder it, and leave the CSS alone.
- Modules are strict and the prototype was sloppy. Watch for implicit globals and `this` at function level.
- Stay inside the paths you own. If you need something changed elsewhere, finish what you can and report it.
- Never leave a file broken at import time: other agents build the whole app. Save complete, working states.

## Checks

```
npx tsc --noEmit                                     # must not report errors in your files
node tests/parity/run.mjs --only=<substr,substr>     # compare against the prototype; see --list
node tests/parity/run.mjs --only=<...> --no-full-motion   # faster while iterating
```

The gate holds a machine-wide lock because this machine has very little free memory. Runs queue, so:
scope every run with `--only`, run it when you have a batch of changes (not after each edit), never run
it in parallel with itself, never lower the lock, and never run the whole suite (the orchestrator does that).
Do not run other browsers or `vite dev`.

A failure means the build differs from the prototype. Change `src/`. Never change `prototype/`,
`tests/parity/run.mjs` or `tests/parity/scenarios.mjs` to make a difference disappear; report it instead.
If a failure is clearly in another agent's unfinished file, wait briefly and re-run before investigating.

## Flow files

Each group owns `tests/parity/flows/<group>.mjs`, a default-exported array of:

```js
{ name, start: "route" /* or route */, viewport: "desktop"|"tablet"|"phone", preset: "<js run before routing>",
  pixels: true, fullMotion: true,
  steps: [ { click: sel }, { dispatch: sel }, { fill: [sel, value] }, { type: [sel, value] }, { select: [sel, value] },
           { check: sel }, { press: key }, { hover: sel }, { goto: "#hash" }, { eval: "js" }, { wait: ms },
           { file: [sel, fixtureName] }, { scroll: y }, { swipe: [sel, dx] } ] }
```

The DOM, form values, focus, hash, title and scroll are compared after every step, and pixels in the reduced-motion run.
Cover every branch a user can reach: happy paths, validation errors, cancel/back, and the empty/edge states.
Put fixtures in `tests/parity/fixtures/`. `Date` is frozen at 2026-11-04 10:42 IST and `Math.random` is seeded
on both sides, so timers that compare `Date.now()` never elapse; use `eval` with a preset or the state to reach those branches.

## Shared API (`src/core`)

Import from `@/core`. `LLD` is the typed runtime object, and screens may keep the short alias:

```ts
import { LLD as L, type State } from "@/core";
```

`L.store.s` is the typed state. `L.motion` is the typed motion API. `src/types.ts` holds the data model.

The test hooks `window.LLD` / `window.LLD_DATA` exist only when `VITE_TEST_HOOKS` is set (parity build). No app code may read them.
