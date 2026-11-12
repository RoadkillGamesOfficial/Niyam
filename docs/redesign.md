# Niyam: Visual Redesign Spec ("Cozy Farm Sim" direction)

> **For the coding agent:** Read this whole file before changing anything. This is a **visual and layout redesign only**. Do not change app logic, data models, XP/combo/integrity calculations, check-in timing, routes, or persistence. If something here conflicts with existing behavior, keep the behavior and adapt the visuals. Before editing, inspect the codebase and report the stack (framework, styling approach, component structure) in 3-5 lines, then proceed.

---

## 1. Product context

Niyam is a discipline tool. It helps the user stay on task and avoid distractions via **configurable periodic check-ins** that pull them back on track or let them log progress after getting distracted. It uses XP, levels, a combo multiplier, and an integrity score to make discipline feel rewarding.

**The emotional goal:** Progress should feel *good*, like tending a farm in Stardew Valley. Warm, charming, rewarding, and calm. The user should feel encouraged, never punished. There is room to breathe: a missed check-in never costs XP (it only resets the combo). The design must reinforce that. No harsh reds, no alarming flashes, no guilt.

**Current problems:** Colors are flat and beige-on-beige. Layout is a generic card grid. Everything has equal visual weight, so nothing feels like a "game". There is no sense of place, character, or reward.

**Inspiration, not imitation:** Take the *feel* of Stardew Valley (pixel-art UI, wooden panels, parchment, warm daylight, sprouting crops, dialogue boxes, inventory tabs). **Do not copy or embed any Stardew/ConcernedApe assets, sprites, fonts, or logos.** All art must be original, built from CSS, inline SVG, or simple generated pixel-style shapes.

---

## 2. Design principles

1. **Everything is an object in a cozy world.** Panels look like wood signs, parchment, and inventory slots, not web cards.
2. **Chunky and tactile.** Hard-edged (no blur) shadows, visible borders, buttons that physically press down.
3. **One hero at a time.** The current task and the next check-in are the visual focus. Stats are a compact HUD.
4. **Reward is visible.** XP gains, level-ups, combo increases, and finished tasks get small, satisfying feedback.
5. **Calm by default.** Motion is slow and gentle. Respect `prefers-reduced-motion`.
6. **Readable first.** Pixel style is for headings and accents. Body text stays highly legible.
7. **Gentle language.** Keep existing copy tone ("One small day at a time.", "never costs XP"). Never add shaming text.

---

## 3. Design tokens

Define these as CSS variables (or the project's theme/token equivalent) in one place. Use them everywhere; no hard-coded colors in components.

### Palette (warm daylight)

| Token | Hex | Use |
|---|---|---|
| `--sky-top` | `#9fd8f0` | Page background gradient, top |
| `--sky-bottom` | `#f7e9b8` | Page background gradient, horizon |
| `--grass-1` | `#7cb342` | Ground strip, success fills |
| `--grass-2` | `#558b2f` | Grass shadow, borders on green |
| `--wood-dark` | `#5d3a1a` | Outer borders, text on parchment, logo sign |
| `--wood-mid` | `#8b5a2b` | Panel frames, buttons |
| `--wood-light` | `#c68b4e` | Panel highlights, tab hover |
| `--parchment` | `#fdf0cf` | Panel interiors |
| `--parchment-dark` | `#ecd49a` | Inset areas, input backgrounds, dividers |
| `--gold` | `#f4b41a` | XP, level, rewards, primary accent |
| `--gold-dark` | `#b97a0a` | Gold borders/shadows |
| `--water` | `#4aa3df` | Combo accent |
| `--water-dark` | `#2a6fa8` | Combo borders |
| `--heart` | `#e8605a` | Integrity heart (soft, not alarming) |
| `--leaf` | `#4caf50` | Integrity fill, positive states |
| `--ink` | `#3b2410` | Body text |
| `--ink-soft` | `#6b4a2b` | Secondary text |

Contrast requirement: all body text must meet WCAG AA (4.5:1) on its background. `--ink` on `--parchment` passes; verify any new pairing.

### Typography

- **Display / headings / numbers / buttons:** `"Pixelify Sans"` (Google Fonts), fallback `"Press Start 2P", monospace`. Use Pixelify Sans first; it is more legible. Reserve `Press Start 2P` for tiny labels at most.
- **Body / descriptions / task text:** `"Nunito"` or `"Quicksand"` (rounded, friendly, readable), fallback `system-ui, sans-serif`.
- Use `image-rendering: pixelated` on any pixel imagery.
- Numbers (XP, combo, timers) use the display font with `font-variant-numeric: tabular-nums`.
- Scale: logo 40px, section titles 22px, stat numbers 36px, body 16px, small labels 13px (minimum).

### Shape language (the "pixel panel")

Build a reusable **pixel panel** component/class used for all cards:

- No `border-radius` above `4px`. Corners look stepped, not round. Achieve this with a stepped `box-shadow` / `clip-path` polygon or stacked borders.
- Frame: 4px `--wood-dark` outer border, 4px `--wood-mid` inner frame, `--parchment` interior, 2px `--wood-light` top-left inner highlight.
- Shadow: hard offset `box-shadow: 4px 4px 0 rgba(59,36,16,0.35)`. **No blur anywhere.**
- Variants: `panel--wood` (dark sign), `panel--parchment` (default), `panel--inset` (sunken, for slots and inputs).

### Buttons

- Chunky wooden/gold buttons: 3px dark border, hard bottom shadow (`0 4px 0`), pressed state moves down 3px and removes the shadow.
- Primary = gold. Secondary = wood. Gentle/neutral = parchment.
- Focus ring: 3px `--water` outline with 2px offset (keyboard visible).
- Hover: brighten slightly and lift 1px. Pressed: translate down.

### Background

- Vertical gradient `--sky-top` to `--sky-bottom`.
- Bottom of the page (fixed, behind content): a pixel-art grass strip with a tiled pattern, a few tiny flowers/tufts, and an optional fence silhouette. Pure CSS/SVG.
- Optional: 2 to 3 soft pixel clouds drifting very slowly (60s+ loop). Disabled under reduced motion.

---

## 4. Layout and components

Goal: replace "title + 3 cards + 2x2 grid" with a **game HUD + main stage + side tabs** feel. Keep all existing sections and data. Re-skin and reposition them.

### 4.1 Header / HUD bar

- Left: **Niyam** logo as a hanging wooden sign (two short chains/ropes above it, wood-grain texture, pixel font, subtle idle sway of 1 to 2 degrees on a slow loop). Tagline "One small day at a time." beneath in `--ink-soft`.
- Right: navigation (**Reframe, Insights, Settings**) as **inventory-style tabs**: small wooden tabs with an icon each (e.g., compass/refresh for Reframe, bar chart/book for Insights, gear for Settings). Active tab raised and parchment-colored. Icons are original pixel SVGs.
- Far right: **day/status plaque**: shows `Today · 2026-11-11` and the `Running` state as a small status badge with a gently pulsing green dot (paused = amber, closed = grey). Optional: a small sun icon whose position reflects time of day.

### 4.2 Stats row, as HUD gauges (not three equal cards)

Compact HUD strip with three distinct gauges, each visually different:

- **Level** (gold): a **star/badge icon** next to the level name ("Mortal"), with a chunky segmented XP bar below (segments, not smooth fill). Show `55 XP · 55 today`. On XP gain, the new segments flash gold once.
- **Combo** (water blue): a **big multiplier** `x1.25` inside a coin/medallion shape, with stacked small pips showing combo level. Keep the "never costs XP, only resets the combo" line as a small caption.
- **Integrity** (green + heart): a **heart icon** next to the percentage, with a segmented leaf-green energy bar styled like Stardew's energy meter. Caption: "How steady the last two weeks have been."

Rule: no red states. Low integrity shifts to warm amber, never red.

### 4.3 "On now": Quest log

- Style as a **quest journal / scroll panel** with a small exclamation-mark icon.
- The current task is the **hero**: large text, wax-seal or quest-marker bullet, gold highlighted frame.
- Progress shown as **task slots** (e.g., `2/3 tasks finished` as three small boxes, two with a checkmark/sprout, one empty), in addition to the text.
- Add a clearly styled primary button for completing the current task if one already exists in the app. Do not add new behavior if it doesn't.

### 4.4 Check-in, as a dialogue box

This is the signature element of the product. Make it feel like an NPC talking to you.

- Style as a **Stardew-like dialogue box**: parchment panel, thick wood frame, with a small **character portrait** on the left (original pixel mascot: a friendly scarecrow, sprout, or little farm spirit; build as SVG/CSS).
- The existing message ("An unanswered check-in never costs XP...") appears as the speech text, ideally with a gentle typewriter reveal on first show (skip under reduced motion).
- The actions (**Pause check-ins**, **Re-plan the rest**, **Close the day**) become **dialogue response options**, a vertical list of selectable lines, each with a small `▶` cursor that appears on hover/focus, like Stardew's choice menus.
- "Next check-in · 14 min · every 30 min" becomes a **clock/timer widget**: small pixel clock or hourglass icon with a segmented countdown bar that drains over the interval. The mascot gets subtly more attentive (e.g., a small bounce) in the last minute. This must be gentle, not alarming.
- When a check-in is actually due, the panel gets a soft gold glow and a speech-bubble "!" above the mascot. No flashing, no sound by default.

### 4.5 "The plan": Task list

- Style as an **inventory grid / checklist board**: tasks as rows in inset slots, with a custom pixel checkbox.
- Completed tasks show a small **sprout that has grown** icon plus a gentle strikethrough. Current task has a gold marker. Upcoming tasks are slightly muted.

### 4.6 "Habits": The garden

- Style as a **garden plot**: each habit is a soil tile with a crop. The crop's growth stage reflects streak/consistency (seed, sprout, small plant, flowering, harvest-ready). Use original simple pixel SVGs, 4 to 5 stages.
- Habit name beneath each tile in the body font. Done-today shows a small sparkle.
- If the app has no streak data per habit, map growth to whatever consistency data exists and report which field you used.

### 4.7 Screens: Reframe, Insights, Settings

Apply the same tokens and panel system so every page matches. Specific ideas:

- **Insights:** charts restyled with palette colors, chunky bars (pixel-stepped), parchment backgrounds; consider a "farm ledger" or "journal" framing.
- **Settings:** form controls as inset wooden slots; sliders styled as chunky pixel sliders with a gold handle; toggles as lever/switch.
- **Reframe:** styled as a calm dialogue/notebook panel.

---

## 5. Motion and feedback

All animations: **slow, soft, optional**. Wrap in `@media (prefers-reduced-motion: no-preference)`.

| Event | Feedback |
|---|---|
| XP gained | Floating `+10 XP` in gold rising and fading; bar segments flash |
| Task finished | Sprout grows into plant on that task; tiny sparkle burst (4 to 6 pixels) |
| Combo up | Medallion does one small pop (scale 1 to 1.12 to 1) |
| Level up | Centered banner/dialog: "Level up!" with a gentle golden glow and a simple confetti of pixel stars (max 2s). Dismissible |
| Check-in due | Soft gold glow plus mascot "!" bubble |
| Combo reset | **Neutral and kind:** the medallion dims for a moment with text like "Fresh start". No red, no shake |
| Idle | Logo sign sway, cloud drift, mascot blink every ~5s |

Optional (off by default, behind a Settings toggle): soft chime sounds for XP gain and check-in. Do not implement audio unless a settings toggle is added.

---

## 6. Level names (optional copy change)

If level names are currently generic, consider a farm-flavored ladder. Only change if the names are purely cosmetic strings in the code, and keep the underlying thresholds identical:

Seedling, Sprout, Mortal, Tiller, Gardener, Harvester, Steward, Keeper, Elder.

(Keep "Mortal" if it's an existing identity of the product; only reorder around it.)

---

## 7. Responsive and accessibility

- Desktop: HUD gauges in one row; main stage as two columns (quest + plan left, check-in + habits right), as today.
- Tablet/mobile: single column. Order: HUD, check-in dialogue (most important), quest log, plan, habits. Tabs collapse into an icon-only bottom or top bar.
- Touch targets at least 44x44px.
- Every icon-only control has an `aria-label`.
- Color is never the only indicator (use icons/text plus color).
- Fully keyboard navigable; visible focus ring as defined above.
- Pixel fonts are never used below 13px.
- Verify contrast for all text/background pairs.

---

## 8. Technical guidance

- Use CSS variables for all tokens. Create one `theme`/`tokens` file and one shared **PixelPanel** / `.panel` primitive. Do not copy-paste frame styles.
- Load fonts via Google Fonts (or self-host if the project already self-hosts). Use `font-display: swap`.
- Icons and mascot: inline SVG or CSS only. Keep each under ~2KB. Put them in a single `icons`/`sprites` module.
- No new heavy dependencies. If a lightweight animation helper is needed, prefer CSS first.
- Keep the DOM semantic (headings, lists, buttons). Don't turn interactive things into divs.
- Do not touch business logic, state, or API code.

---

## 9. Suggested implementation order

Work in these phases and **stop after each to show/summarize the result** (or at least commit separately):

1. **Foundation:** tokens, fonts, background (sky + grass), `PixelPanel`, button styles.
2. **Header + HUD:** wooden sign logo, tabs, status plaque, three gauges.
3. **Check-in dialogue + timer** (signature piece) with mascot.
4. **Quest log + plan list.**
5. **Habits garden.**
6. **Motion and reward feedback** (XP float, task sparkle, level-up banner).
7. **Restyle remaining screens** (Reframe, Insights, Settings).
8. **Responsive + accessibility pass.**

---

## 10. Acceptance criteria

- [ ] Feels immediately like a cozy pixel-farm game UI, not a generic web dashboard.
- [ ] No blur shadows, no large rounded corners; panels use the pixel-panel style.
- [ ] Palette is warm and saturated enough to feel playful; all text passes AA contrast.
- [ ] Check-in looks like a dialogue box with selectable response options and a visible countdown.
- [ ] Level/Combo/Integrity are three visually distinct gauges with icons.
- [ ] Habits render as a garden with growth stages.
- [ ] Missed check-in / combo reset never shows red, shaking, or shaming copy.
- [ ] All animations respect `prefers-reduced-motion`.
- [ ] Works at 375px, 768px, and 1440px widths.
- [ ] All existing functionality behaves exactly as before.
- [ ] No third-party game assets used; all art is original.

---

## 11. Report back

When done, summarize: files changed, new shared components created, any assumptions (e.g., what data drives the crop growth stages), and anything from this spec you skipped and why.
