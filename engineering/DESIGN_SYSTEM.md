# LiftIQ design system

Source of truth for the tokens is `frontend/src/app/globals.css`. Rules are enforced by
`frontend/tests/test_ui_system.ts` (part of `npm test`).

## Two surfaces

| Surface | Where | Why |
|---|---|---|
| **Log** (default) | dashboard, history, reports, forms, legal, error pages | Reading and logging. Warm paper (`--canvas #F1EEE6`), hairline rules, ink text. |
| **Stage** (`.stage`) | the live workout only | The camera feed is the content and numbers are read from a few metres away. Graphite (`--canvas #141816`). |

Components never hard-code colours. They use semantic utilities (`bg-canvas`, `text-ink`,
`text-ink-2`, `border-rule`, `bg-brand`, `text-fail` ...). `.stage` re-points the same
variables, so one component works on both surfaces. Tailwind's default palette is removed
(`--color-*: initial`), so a stray `zinc-900` or `lime-400` renders nothing.

## Colour

One accent. Pine (`--brand`) is the brand colour and also the "good form" colour. Caution
(ochre) and fail (brick) appear only as score and error states, and never alone: a score is
always shown as glyph + number + word (`components/ui/score.tsx`, bands 85 / 70).

All text pairs meet WCAG AA; control borders (`--rule-strong`) meet 3:1.

## Type

- **Archivo** (variable, weight axis only): UI and headings.
- **Archivo Narrow 700** (static): counters, figures, timer. Tall and readable at a distance.
- **Newsreader 400** (static): the AI coach's written text only, so it reads as advice, not data.
- Numbers use `tabular-nums`. No monospace except literal code.

## Shape, depth, motion

- Radius: `rounded-control` 2px (buttons, inputs, tags), `rounded-surface` 4px (panels, dialogs),
  `rounded-media` 8px (camera media). Circles only for the status dot.
- Depth: borders, not shadows. `shadow-overlay` is the single shadow, for dialogs and menus.
- Structure: hairline rules and whitespace (`Section`, `StatStrip`), not stacks of boxed cards.
- Motion: 140ms colour changes for hover, focus and press only. The only pulsing element is the
  "Live" dot. `prefers-reduced-motion` is honoured globally.

## Icons

Owned set in `components/ui/icons.tsx`: brand mark, six exercise pictograms, pass / caution /
fail glyphs, camera-off. Everything else is text. Do not add an icon library.

## Copy

Plain second person. No em dashes, no emoji, no marketing superlatives. Empty values read
"n/a". This applies to engine text (`gym_trainer.py` cues) and the AI prompt as well; the AI
output is also filtered (`_plain` in `app/services/ai_service.py`).

## States every data view has

Skeleton (`LoadingRegion` + `Skeleton`, mirrors the layout), empty (`EmptyState`), error
(`ErrorState` with retry), and route-level `not-found.tsx`, `error.tsx`, `global-error.tsx`.

## Content that needs a human

- `frontend/src/lib/legal.ts`: operator name, contact email, governing law, and
  `reviewedByCounsel`. Unset values are omitted from the Terms and Privacy pages, and until
  `reviewedByCounsel` is true both pages say they have not been reviewed.
- A real product demo on the signed-out screen (`components/auth-layout.tsx`, `TODO(product-demo)`)
  needs footage with clear rights and consent.
- Exercise pictograms and the favicon were drawn in-house and should get a designer's pass.
