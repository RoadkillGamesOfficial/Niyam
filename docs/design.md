# Visual design: warm, cozy, Stardew-inspired

Status: **implemented 2026-11-08.** Phase 1 shipped with placeholder terminal
styling; this file is the design that replaced it. See "Shipped values" at the
end for the tokens and measurements that actually landed.

Scope of this direction: **visual only.** No behaviour, data or copy changes are
implied. Every string stays in `src/copy.ts`.

## The feel

A cozy farm-sim interface: parchment and wood, warm daylight, rounded chunky
controls, soft shadows, gentle press-and-lift motion, gold for rewards. The
reference is Stardew Valley's *interface language*, not its art.

Explicitly not this direction:

- pixel art, 8-bit or dot-matrix fonts, `image-rendering: pixelated`
- sprites, isometric scenes, character art, mascots
- sound effects or music
- icon packs or webfont downloads (both are outbound requests)
- farm vocabulary layered over every label

## Why

- `docs/PDD.md` §13 already says "Stardew Valley-inspired, game-console in feel".
- Gamification is a core product principle, not an add-on, so the interface
  should feel like a game worth playing.
- The Phase 1 terminal look (dark, monospace, `> ` prefixes, `[x]` glyphs) was a
  deliberate placeholder, not a design.

## Principles, in priority order

1. **Calm before cute.** Nothing bounces, flashes, or demands attention. This is
   a tool for a low-motivation moment as often as a motivated one.
2. **Readable first.** Warmth never buys a contrast failure. Body text 16px
   minimum, AA contrast, clear focus states.
3. **Game feel through material and motion, not graphics.** Borders, shadows,
   depth and easing do the work that sprites would do in the game.
4. **CSS-only craft.** No image files, no icon package, no new dependency.
   Inline SVG is allowed only where a CSS shape genuinely cannot do the job.
5. **Tokens only.** Components read custom properties from `globals.css`; no
   component hardcodes a colour, radius or duration.
6. **Metaphor is garnish, not language.** "Turned soil" may describe an empty
   state visually; the sentence inside it stays plain and never scolds.

## Tokens

Draft values. Every text/background pair must be measured before shipping (see
Verification); the targets below are the contract, the hexes are the starting
point.

### Colour

| Token | Draft | Role | Target |
|---|---|---|---|
| `--parchment-50` | `#fdf8ea` | cards, task slips | — |
| `--parchment-100` | `#f7edd6` | page background | — |
| `--parchment-200` | `#ecdcba` | recessed inputs, wells | — |
| `--wood-300` | `#c9a06a` | frame highlight | — |
| `--wood-500` | `#9a6b42` | frames, dividers | 3:1 vs parchment (UI boundary) |
| `--wood-700` | `#6d4726` | frame shadow, dark chrome | — |
| `--ink-900` | `#33291d` | body and heading text | ≥ 7:1 vs parchment-50 |
| `--ink-600` | `#6b5a44` | muted text, done titles | ≥ 4.5:1 vs parchment-100 |
| `--leaf-500` | `#5b8c3e` | primary action, done fill | ≥ 4.5:1 for text on it |
| `--leaf-700` | `#3f6629` | button edge, hover | — |
| `--gold-400` | `#e3b04b` | XP, rewards, focus ring | 3:1 vs parchment for focus |
| `--berry-500` | `#b5543b` | drift, error accent | never the only signal |
| `--sky-500` | `#5d87a6` | pivot, informational | never the only signal |

Colour never carries a state alone: done tasks also get a strikethrough and a
drawn check, errors also get text.

### Type

| Token | Draft | Role |
|---|---|---|
| `--font-rounded` | `ui-rounded, "SF Pro Rounded", "Segoe UI Rounded", "Nunito", "Trebuchet MS", system-ui, sans-serif` | everything |
| `--text-sm / base / lg / xl / 2xl` | `14 / 17 / 20 / 26 / 34px` | labels, body, section titles, page title |
| `--leading` | `1.6` | body |
| `--weight-regular / medium / bold` | `400 / 500 / 700` | body, controls, headings |

Rules: no uppercase tracking-wide labels (that was the terminal voice); numerals
use `font-variant-numeric: tabular-nums` so XP and timers do not jitter; the
fallback chain must end in something acceptable on Windows, which lacks
`ui-rounded` by default.

A bundled OFL display face (for headings only) is an option later. It is an
asset, not a dependency, but it must be approved and committed locally with its
licence. Nothing is fetched at runtime.

### Shape and depth

| Token | Draft | Role |
|---|---|---|
| `--radius-sm / md / lg / pill` | `8 / 12 / 18 / 999px` | controls, cards, page frame, buttons |
| `--border` | `2px solid var(--wood-500)` | frames |
| `--shadow-card` | `inset 0 1px 0 rgba(255,255,255,.6), 0 6px 16px rgba(93,62,31,.16)` | cards |
| `--shadow-press` | `0 1px 0 rgba(93,62,31,.35)` | pressed controls |

### Motion

| Token | Draft | Role |
|---|---|---|
| `--ease` | `cubic-bezier(.2,.8,.3,1)` | all transitions |
| `--fast` | `140ms` | hover, focus, press |
| `--pop` | `200ms` | check appears, badge changes |

## Materials (CSS recipes)

- **Parchment**: base colour plus one very low-alpha repeating gradient for
  grain (2–3%), plus a radial vignette on the page. One grain layer only; stacked
  gradients are the main paint-cost risk here.
- **Wooden frame**: `--border`, inset top highlight, outer soft shadow, 12px
  radius. Used for cards and the page frame — not on every element.
- **Ribbon**: the day line sits on a small banner with notched ends (clip-path),
  sized to its text.
- **Sign**: the wordmark sits on a wooden bar with a darker bottom edge, reading
  as a hung sign rather than a heading.
- **Task slip**: a parchment card inside the day card, 1px wood divider between
  rows, no per-row shadows (keeps the list flat and quick to scan).
- **Seed toggle**: a 22px circle with a wood rim; done fills with `--leaf-500`
  and draws a check (two CSS borders rotated, or an inline SVG path).
- **Button**: pill, `--leaf-500` fill, 3px `--leaf-700` bottom edge, translateY
  1px on `:active`, no glow.
- **Input**: recessed `--parchment-200` well, 2px inset border, warm focus ring
  in `--gold-400` with 2px offset.

## Component specs

Current page (Phase 1):

| Element | Treatment |
|---|---|
| Page | parchment ground, vignette, 72ch column |
| Masthead | wooden sign wordmark, plain lede, ribbon day line |
| Panels | one cream card each for "add" and "today's tasks" |
| Add form | recessed input + pill button side by side |
| Task row | slip inset, seed toggle, title, muted done state |
| Empty state | turned-soil patch with the existing plain sentence |

Phase 2 onwards (planned here, built there): XP as a Stardew-style energy bar
with gold fill; combo as a coin badge with a multiplier; integrity meter as
segmented hearts; check-in prompt as a pinned notice board above the plan;
level-up as a brief paper-and-gold flourish, under 400ms.

## Accessibility

- WCAG AA minimum: 4.5:1 body, 3:1 large text and control boundaries; measured,
  not eyeballed.
- `:focus-visible` ring on every interactive element, `--gold-400` at 2px offset,
  never removed.
- Keyboard reachable end to end; the toggle stays a real `<button>` with
  `aria-pressed`.
- No state by colour alone.
- `prefers-reduced-motion: reduce` removes all transforms and transitions.
- 200% zoom and 320px width must not clip or overlap.
- No audio anywhere.

## Copy stays copy

The visual layer may imply a farm; `src/copy.ts` decides what is said. New labels
(user-facing text) go through the voice writer, stay short and plain, and never
use guilt or farming jargon where a normal word works. Metaphor lives in the
materials, not the sentences.

## Implementation plan

Visual-only commits, each green on `npm test` and `npm run build`, nothing
pushed:

1. `style: replace tokens with a warm daylight palette` — token block, body
   ground, type scale. Class names unchanged, so `page.tsx` is untouched.
2. `style: frame the page as a wooden board` — sign, ribbon, card materials.
3. `style: restyle tasks as paper slips with a seed toggle` — rows, toggle, done
   state, input, button, empty state; small wrappers in `page.tsx` only.
4. `style: add press feedback and reduced-motion support` — transitions,
   `:active`, reduced-motion block.
5. `style: verify contrast and record final tokens` — measurement, keyboard
   walkthrough, 320/768/1280px check, update this file with shipped values.

Files: `src/app/globals.css` (bulk), `src/app/page.tsx` (wrappers),
`src/app/layout.tsx` only if a font stack must be declared there, `docs/`.
No new dependencies, no images, no runtime font fetch.

## Verification before calling it done

- Every text/background pair measured against its target in the token table.
- Keyboard-only pass: tab to input, submit, tab to each toggle, activate, no traps.
- Reduced-motion pass: no transforms when the OS asks for less motion.
- Widths 320 / 768 / 1280px, plus 200% zoom.
- `npm test` and `npm run build` green.
- One screenshot recorded in the session for the owner to react to, since a
  visual change cannot be verified by compiling it.

## Open questions

- Font: rounded system stack now, or approve a bundled OFL display face?
  Recommendation: system stack first, revisit once the palette is settled.
- Grain strength: the draft is deliberately subtle; too strong reads as noise on
  a laptop screen at 100%.
- A dusk theme is in the PDD backlog, not this pass. Tokens should make it cheap
  later, nothing more.

## Desktop pass (2026-11-08)

A second pass after the first screenshots: the page was built for a phone first
and left a narrow column with a lot of unused screen on a laptop. From 980px up
the shell widens to 1120px and becomes a two-column dashboard: stats across the
full width, then the plan and habits side by side, with the heat map as a wide
calendar strip. Panels align to the top instead of stretching to match their
neighbour. The header gains a rule, the wordmark grows, and the panel headings
share a gold marker and hairline.

The desktop grid is scoped with `:has(.stats)`, because the settings page shares
`.shell` but must not inherit the dashboard's panel flow; before that guard, the
heat-map strip layout landed on the settings page's last panel and squeezed its
values list into the label column.

The same treatment now covers every view: a closed day's summary panel spans the
full width (it is prose and a definition list, not a column card), and the
settings page gets its own two-column desktop layout — the check-in form beside
the game-values reference — so it no longer sits in a narrow column with half a
laptop screen empty.

Mobile padding was restored after the first desktop pass raised the base panel
padding: `.panel` keeps its original `16px 24px 24px`, and the desktop media
query raises it to 24px on all sides. At 320px the dashboard is a single column
with no horizontal overflow.

New tokens, used as fills behind text and never as text colours, so no contrast
gate applies: `--parchment-0: #fffdf6` (panel and stat tops) and
`--leaf-400: #55823a` (button gradient top). Verified in a headless Chrome
render at 1280px on both pages, plus the running-day dashboard; captures are
`docs/design-revamp-desktop.png`, `docs/design-revamp-active.png` and
`docs/design-revamp-settings.png`.

## Shipped values (2026-11-08)

Landed in `src/app/globals.css`, with class names unchanged so no component had
to move. Three draft hexes were darkened to meet their own contrast targets:

| Token | Draft | Shipped | Why |
|---|---|---|---|
| `--leaf-500` | `#5b8c3e` | `#47712f` | parchment text on leaf was 3.76:1; now 5.39:1 |
| `--gold-400` | `#e3b04b` | `#a8781f` | focus ring was 1.71:1 against parchment; now 3.36:1 |
| `--sky-500` | `#5d87a6` | `#46688a` | pivot text on parchment was 3.61:1; now 5.49:1 |

The decorative gold (energy bar, notice pin) keeps the light draft as
`--gold-300: #e3b04b`; only text and focus use the darker `--gold-400`.

Measured pairs (WCAG 2.1 relative luminance):

| Pair | Ratio | Target |
|---|---|---|
| `--ink-900` on `--parchment-50` | 13.41 | ≥ 7 (body) |
| `--ink-600` on `--parchment-100` | 5.69 | ≥ 4.5 (muted) |
| `--parchment-50` on `--leaf-500` | 5.39 | ≥ 4.5 (button text) |
| `--parchment-50` on `--wood-700` | 7.67 | ≥ 4.5 (sign) |
| `--gold-400` on `--parchment-100` | 3.36 | ≥ 3 (focus ring) |
| `--berry-500` on `--parchment-50` | 4.61 | ≥ 4.5 (error text) |
| `--sky-500` on `--parchment-50` | 5.49 | ≥ 4.5 (pivot) |
| `--ink-900` on `--parchment-200` | 10.51 | ≥ 4.5 (input text) |

Other shipped decisions: the task glyph is a 22px seed button that fills leaf
and draws a check with two borders when pressed, so the `[x]` copy marks are no
longer rendered (they stay in `src/copy.ts` as labels). The `> ` prefixes before
hints and empty states are gone. State is still never colour-only: done rows
keep their strikethrough, and the seed has a drawn check.

Verified on 2026-11-08 in the local preview: no horizontal overflow at 320,
768 and 1280px (document `scrollWidth` equals `clientWidth` in each case), and
at 640px, which is what a 1280px window becomes at 200% zoom. The pinned
check-in board and the firm overlay were rendered at 320, 640 and 1280px; the
overlay card stays inside a 320x480 viewport (top 56px, bottom 424px), so a
short zoomed window does not clip it. Captures: `docs/design-revamp-320.png`,
`docs/design-revamp-1280.png`, `docs/design-revamp-overlay.png`.

One defect was found this way and fixed: the plan form's Add button overflowed
its card until the row was allowed to wrap.
