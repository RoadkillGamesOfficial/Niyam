# Voice guide

The voice in one page. Every user-facing string lives in `src/copy.ts`; this file
says how to write the next one. Reasoned from `docs/knowledge.md` and the Tone
section of `docs/PDD.md`.

## The voice

A practical coach on the user's side. Direct, warm, lightly playful. Short plain
sentences. Never a scold, never clinical, never gushing. The user is a capable
adult having an ordinary day, and getting back on track should feel easy.

Reads like someone who knows you, not like a product speaking:

- Good: "Nothing open. Take the gap, or add one small thing."
- Good: "Bring one over, or let it go. Nothing is forced."
- Not: "You have no active tasks. Please create a task to get started."
- Not: "Great job! You're crushing it today!"

## Words we use

| Use | Instead of | Why |
|---|---|---|
| Pulse, check-in | reminder, alert, notification | one name for the thing, used the same way every time |
| On track, Pivot, Drifted | success, fail, bad | the three answers are states, not verdicts |
| unanswered | missed, skipped, failed | describes the event without judging it |
| drift, drifted | slide, slip, lapse | neutral, and it is the product's own term |
| micro-action | mini task, quick win | the product's vocabulary for a shrunk task |
| Integrity, Combo, Level, XP | score, streak (except habits) | game terms stay consistent |
| "Take the gap" | "You have free time" | plain, a little wry, never a nag |
| "one small thing" | "a task" | the smallest unit of progress, said warmly |

Avoid: "you failed", "you should have", "you're behind", "don't forget",
"remember to", productivity-guru phrasing ("optimize", "leverage", "deep work"),
generic self-help lines, and exclamation marks in ordinary confirmations.

## Situations and the lines that set the tone

**Empty states** (always end with a next step)
- Plan: "The plan is clear. Add one small thing to begin."
- Habits: "No habits yet. Add one you want to keep."
- Nothing in progress: "Nothing open. Take the gap, or add one small thing."

**Starting**
- "Starting sets the plan and begins check-ins."
- "Pick what today can hold. It changes how much is planned."

**The check-in**
- "How is it going?" — the whole question. No preamble.
- "One line is plenty" — the note field's placeholder, which lowers the bar.
- Unanswered: "An unanswered check-in never costs XP. It only resets the combo."

**Drifting** (the moment that must never feel like a punishment)
- "Make it smaller"
- "Pick something easier than the whole task. Starting counts."
- Options are verbs with a five-minute ceiling: "Write one sentence", "Open the
  file and read one line".

**Quiet hours**
- "This one waited quietly. Answer it if you like, or leave it for the morning."

**Rewards and day close**
- "Today, wrapped" — the heading; the numbers do the bragging.
- "That is today. Tomorrow starts from here."

**Insights** (counts and observations, never verdicts)
- "3 of 5 tasks finished today."
- "Two moments drifted today. That is information, not a verdict."
- "This week is still open. A single check-in starts the pattern."
- "Try a five-minute version." / "Give it a time that fits your better hours."
- Not: "Your worst hours are the afternoon." / "You should plan better."

**Errors** (say what happened, then the next step)
- "That habit could not be saved. Check the details and try again."
- "That did not save. Check the values and try again."

## Mechanics of the copy file

Phase 4 voice pass (2026-11-10): insight copy was written as observations with a
next step where a habit is slipping; no percentage is framed as a grade.

- All strings in `src/copy.ts`, none in components.
- Sentence case. No uppercase tracking-wide labels in prose (the Phase 1
  terminal look is being retired; that is visual work, not a copy decision).
- Numbers are allowed to be plain: "Every day · 0 day streak".
- Labels stay one or two words; helper lines stay under about 15 words.
- Wording that names a *place in the code* is a smell. Say what the numbers mean
  to the user, and only mention the file when their only action is to edit it.

## 2026-11-13 pass: one name per thing, on every screen

- Settings has a lede about settings, not the check-in interval hint it used to
  borrow. A paused day has its own "Paused" plaque label, not the habit tag.
- The interruption levels describe what happens: "a quiet note on the page", "a
  note and a soft chime", "a full-screen check-in".
- Insights keep events apart: drifted answers and unanswered check-ins are
  counted and named separately, in the daily note and in heat-map tooltips.
  "across 2 active days" is now "on 2 days", and the trends legend says
  integrity blends answered check-ins with finished tasks, which is what the
  code does. No number is framed as a grade.
- One message, one place: the AI-off notice appears once per screen, the
  unanswered-check-in helper sits where the answer is chosen, and the combo
  gauge explains the multiplier instead of repeating that helper.
- Empty, idle and error states keep a next step: "All clear. The next check-in
  comes on its own.", "Local AI is off. Turn it on in Settings to use it.",
  "No recent days yet."
- Habit schedules are asked for in plain words: "Schedule detail", placeholder
  "Optional", and one hint that is true for every frequency.
- Prompts are copy too: the model receives display names ("Low-energy rescue",
  "On track"), never stored slugs, `prompts/reframe.md` states the no-blame
  voice, and `prompts/shrink.md` matches the under-five-minutes rule (1–5
  minutes, verb-first title).

## Open question for the owner

The product name appears once, in `src/copy.ts` (`PRODUCT_NAME`). The voice works
for "Niyam" but has not been read by the owner; the small name and the tagline
("One small day at a time.") are the one pair worth a direct yes or no.
