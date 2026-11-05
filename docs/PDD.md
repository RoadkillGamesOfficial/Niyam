# **Product Design Document: Local-First Discipline & Momentum Companion**

*Working names under consideration: Consto, Constantia, Kata, Niyam, Ordo, Sudor, Meliora (see Appendix A)*

*Version 0.1 (Draft) · November 3, 2026 · Status: Scope definition, pre-build*

## **1\. Document Overview**

**Purpose.** This document defines what the product is, who it is for, how it should behave, and how it will be built in phases. It is meant to be the basis for build decisions: when a question comes up during implementation, this document should answer it, or be updated so that it does.

**Scope.** Product vision, feature behavior, gamification rules, conceptual data model, high-level architecture, AI behavior, phasing, risks, and open questions. It intentionally contains no code and no low-level schemas.

**Audience.** The product owner (who is also the primary user) and any AI coding tools used during implementation.

**Conventions.** Requirements carry IDs (for example PLAN-1) so they can be referenced in tasks and tests. Items tagged **\[Assumption\]** are my interpretation of the source notes and need confirmation. Numeric values in the gamification section are starting points to be tuned, not fixed rules.

## **2\. Product Summary**

A personal productivity companion that helps one person plan their day, stay on course through frequent lightweight check-ins, recover quickly from low-motivation moments, and build discipline through a game-like reward system. It runs entirely on a single laptop: no cloud, no accounts, no data leaving the machine.

**Vision.** Make discipline feel like a game worth playing rather than a standard to fail against, so that becoming more productive is something the user actually enjoys.

**Core pillars**

* **Flexible structure.** Plans exist to reduce decision fatigue, but they bend when plans change or motivation shifts. Rigidity is a bug.  
* **Momentum through gamification.** Rewards, combos, and visible progress are a core principle of the product, not a bolt-on.  
* **Recovery over punishment.** When the user drifts, the system lowers the difficulty and helps them re-engage. It never shames and never takes away earned progress.  
* **Private and local.** Everything is computed, stored, and inferred on the user’s own hardware.  
* **Reflection that compounds.** Every task, check-in, and brain dump is logged so the product gets better at helping over time.

## **3\. Problem Statement**

* **Morning decision paralysis.** Unstructured to-do items are hard to turn into an actionable order of work, so the day starts with friction.  
* **Rigid schedules break.** A fixed timetable fails the first time something changes, and the failure often leads to abandoning the plan entirely.  
* **Silent drift.** Distraction (a video game, a rabbit hole) can run for hours before the user notices, and one lost block cascades into a lost day.  
* **“Bleh” moods with no exit.** Low-energy or aimless periods have no built-in way out, and generic self-help advice does not fit the specific situation.  
* **Weak external drive.** Standard to-do lists and calendars provide no reward or momentum. They are either static or quietly punishing.

## **4\. Goals, Non-Goals, and Success Measures**

### **4.1 Goals**

| ID | Goal |
| ----- | ----- |
| G1 | Turn a messy list of tasks into a realistic, flexible plan for the day in under five minutes. Allow a choice to do this the morning of or night before. |
| G2 | Catch distraction within a short window (default 30 minutes) and redirect without guilt. |
| G3 | Provide an always-available way to reset out of a low mood into one tiny action. |
| G4 | Make consistency rewarding through XP, combos, and a visible progress record. |
| G5 | Learn the user’s patterns over time (when they drift, what energy levels work) and adapt. |
| G6 | Operate fully offline on one laptop at zero running cost. |

### **4.2 Non-Goals (Version 1\)**

* Multi-user, team, or social features, including leaderboards.  
* Cloud sync, accounts, or remote access.  
* Mobile apps.  
* Calendar or third-party integrations.  
* Full project management (dependencies across weeks, Gantt views, and similar).  
* Clinical or therapeutic functionality. The reframe feature is a productivity tool, not mental health care.  
* A reward system which can allow for purchasing things like pets in the app or ways to take care of pets or perhaps earning currency to earn time off, a truly impactful reward system someone would care about for longer

### **4.3 Success Measures**

* The user opens the planner on most working days without needing to be reminded.  
* A high share of check-ins are answered (target to be set after a baseline period).  
* Time from “Drifted” to a re-engaged state shrinks over weeks.  
* The user reports the app as something they want to use, not something they feel obligated to use. This is the most important measure and is tracked through a simple optional weekly rating.
* Automatic phone connection or real-time phone tracking. (Manual screen time import is a planned future feature; see Section 8.8.)  

## **5\. Target User and Scenarios**

**Primary user.** A single self-directed individual (the product owner) who has good intentions and real goals but inconsistent follow-through, whose motivation fluctuates, and who responds well to game mechanics and immediate feedback.

| \# | Scenario | What the product does |
| ----- | ----- | ----- |
| S1 | Morning start/night before: the user has a head full of tasks and low clarity. | User pastes tasks, picks a daily profile, and receives a structured, flexible plan with a timeline. |
| S2 | Two hours in, the user is deep in a video game instead of their task. | A check-in arrives within 30 minutes; the user taps Drifted and is guided to a tiny first step instead of a lecture. |
| S3 | Mid-afternoon “bleh” slump. | User opens the brain dump from anywhere, writes freely, and receives a diagnosis plus one small action. |
| S4 | A meeting runs over and the plan is now wrong. | User uses Pivot/Restructure; the remaining plan is reshuffled around the new reality. |
| S5 | End of week. | User reviews patterns: when they drift, which profiles worked, how consistency is trending. |

## **6\. Design Principles**

1. **Never shame.** Tone is direct, light, and supportive. Failure states always include a next step.  
2. **One-click friction.** Anything the user must do repeatedly (a check-in, a status change) takes a single click or keypress.  
3. **Adapt the plan, not the person.** When reality diverges from the plan, the plan changes.  
4. **Reward behavior, not volume.** Rewards come from honest check-ins, recovery, and consistency, not just from completing more tasks.  
5. **Honest reporting must be safe.** If admitting a drift is punished, users will stop admitting it. Self-reporting is always at least partly rewarded.  
6. **Adjustable intensity.** Check-in frequency and how forceful interruptions are can always be dialed up or down.  
7. **Transparent and local.** The user can see, edit, export, and delete all of their data.

## **7\. Experience Overview**

The product has one central loop that runs through the day, plus one feature available at any time.

**Daily loop:** Plan the day → Work → Check-in pulse every \~30 minutes (customizable) → (Reframe if drifting) → Close the day → Review patterns.

**Anytime:** Brain dump / Reframe, accessible from a universal shortcut regardless of time of day or plan state.

| Feature | Trigger | Purpose | Phase |
| ----- | ----- | ----- | ----- |
| Daily Planner | Start/End of day (user-initiated) | Convert unformatted tasks into a flexible, gamified timeline | 1 (manual), 3 (AI-assisted) |
| Check-In Pulse | Timer, default every 30 minutes | Catch drift early, keep momentum, adjust plan, reward timely response to check in | 2 |
| Reframe (Brain Dump) | Anytime, or routed from Drifted | Break out of slumps with a diagnosis and one micro-action | 3 |
| Gamification Layer | Always on | Make progress visible and rewarding | 2 |
| Insights | On demand, plus weekly summary | Reveal drift and productivity patterns; tune scheduling | 4 |
| Habits | Day start (automatic) | Recurring tasks added to the plan without re-entry | 2 |
| Screen Time Import | User-initiated upload | Bring phone usage into Insights | Future |

## **8\. Feature Specifications**

### **8.1 Daily Planner**

**Purpose.** Replace morning decision paralysis with a concrete, adjustable plan. This is the scheduler-style “morning check-in”: the user feeds it to-do items and it helps organize them. It is deliberately not a feelings check-in; emotional dumps live in the always-available Reframe feature.

**Inputs**

* Free-form task text (a paragraph, a list, or fragments).  
* A **Daily Profile** chosen by the user based on current energy.  
* Optional: available hours and fixed commitments for the day.

**Daily Profiles**

| Profile | Intent | Planning effect |
| ----- | ----- | ----- |
| Sprinting | High energy, push hard | More tasks, longer focus blocks, heavier tasks placed early, firmer check-ins |
| Maintenance | Normal steady day | Balanced load, regular breaks, standard check-ins |
| Low-Energy Rescue | Low capacity, protect momentum | Fewer and smaller tasks, easy wins first, shorter blocks, gentle check-ins |

**Behavior**

* The system breaks the input into discrete tasks, splitting large ones into chunks.  
* Each task receives an estimated duration and a **Cognitive Load** rating (Light, Medium, Heavy).  
* Prerequisite relationships between tasks are identified where obvious (task B needs task A).  
* Tasks are laid out on a timeline fitted to the chosen profile. The timeline is a suggestion, not a contract.  
* The user reviews and edits everything before confirming.

**Requirements**

* PLAN-1: The user can enter tasks as unstructured text and receive a structured task list.  
* PLAN-2: The user can manually add, edit, reorder, split, merge, and delete tasks at any time.  
* PLAN-3: The user must confirm the plan before it becomes active.  
* PLAN-4: A “Re-plan the rest of my day” action regenerates the remaining timeline from the current time and state.  
* PLAN-5: If the AI is unavailable, the planner still works manually (see Section 11.3).  
* PLAN-6: Unfinished tasks at the end of the day are carried over as suggestions, not forced into tomorrow’s plan.

### **8.2 Check-In Pulse**

**Purpose.** Limit any distraction to roughly one interval, preventing a bad half hour from becoming a lost day. Provide structure to breaks in order to prevent breaks from leeching more time beyond the initial plan.

**Trigger.** A recurring timer, default every 30 minutes during active plan time. The interval is configurable.

**The prompt.** A single, fast question with the current task shown, and three answers:

| Response | Meaning | Result |
| ----- | ----- | ----- |
| **On Track** | Working on the planned task | XP awarded, combo increases |
| **Pivot** | Plan changed, a task finished early, or priorities shifted | Combo preserved; user picks the next task or the plan reshuffles |
| **Drifted** | Off task or stuck | Combo resets; routed to Reframe with a shrunken task and honesty XP |

An optional one-line note can be attached to any response.

**Other states**

* **Pause.** The user can pause check-ins for meals, meetings, or breaks, and resume after. Paused time never counts against the user, but a little ping does indicate if it has been paused for greater than an hour in case the user forgot to unpause.  
* **Missed pulse.** If the prompt is not answered within a set window, it is logged as missed, the combo resets, and no baseline XP is lost.  
* **Interruption level.** The user chooses how forceful the check-in is: *Gentle* (notification), *Standard* (notification plus sound), or *Firm* (screen-blocking overlay plus audio).

**Requirements**

* PULSE-1: Check-ins fire on schedule while a plan is active, even when the app is not in focus (see Risk R1).  
* PULSE-2: A response requires a single click or keypress.  
* PULSE-3: Every response is logged with timestamp, current task, and optional note.  
* PULSE-4: Missed check-ins are reconciled correctly if the laptop sleeps or the app restarts.  
* PULSE-5: Interval, interruption level, and quiet hours are user-configurable.

### **8.3 Reframe (Brain Dump)**

**Purpose.** Help the user get out of emotional slumps, decision friction, and aimlessness with something more useful than generic encouragement.

**Access.** Always available through a universal shortcut and a persistent control in the interface. Also entered automatically when the user selects Drifted. It is not tied to the morning.

**Flow**

1. The user writes an unedited brain dump: frustrations, fatigue, paralysis, whatever is there.  
2. The system analyzes it together with relevant history (recent check-ins, active tasks, time of day, prior reframes).  
3. It returns a short **diagnosis** naming the likely type of blockage.  
4. It returns **one micro-action**: small enough to start in under five minutes, with no setup.  
5. If a task is involved, the task is **shrunk** into a tiny version of itself.  
6. The user accepts, edits, or asks for a different angle. Completing the micro-action earns XP.

**Blockage categories (initial set):** Clarity Deficit, Overwhelm or Scope Creep, Fatigue, Avoidance, Distraction Pull, Low Mood. The set can evolve based on logged data.

**Requirements**

* REF-1: A brain dump can be started from any screen in one action.  
* REF-2: Output is always structured: diagnosis, one micro-action, and an optional shrunken task.  
* REF-3: Responses are short and specific. They reference the user’s actual situation and avoid generic self-help language.  
* REF-4: All brain dumps are stored locally and can be viewed, edited, or deleted by the user.  
* REF-5: The user can request a different micro-action.  
* REF-6: The tone is practical and non-clinical. If a dump contains signs of serious distress, the response drops the productivity framing and suggests reaching out to a trusted person or professional support (see Risk R7).

### **8.4 Gamification System**

Gamification is a core principle of the product. Its job is to supply the external reward and momentum that internal motivation sometimes does not.

**Mechanics**

* **XP and levels.** All positive actions earn XP toward levels. Baseline XP never decreases. Levels are named after Greek/Roman mythology becoming progressively more powerful as level increases.  
* **Combo multiplier.** Consecutive on-track check-ins increase a multiplier that scales XP. Missing or drifting resets the multiplier, but never reduces total XP, avoiding negative-reinforcement quit loops.  
* **Task Shrinkage.** When drift is detected, difficulty is lowered instead of failing the user. The task is converted into a tiny version (open the file, write one sentence), and partial XP is awarded for starting.  
* **System Integrity.** A health-bar-style meter reflecting consistency across days, plus a calendar heat map in the style of a contribution graph. It decays slowly during inactivity and recovers quickly with engagement. It should never reach an unrecoverable “dead” state, and an explicit rest day can pause decay.  
* **Honesty reward.** Reporting Drifted and completing a micro-action earns small XP, so honesty is never the losing choice.

**Starting values (to be tuned)**

| Event | XP | Combo effect |
| ----- | ----- | ----- |
| On Track pulse | 10 × multiplier | \+0.25 multiplier |
| Pivot pulse | 5 | Multiplier kept |
| Drifted pulse (honest report) | 3 | Multiplier resets to 1.0 |
| Micro-action completed | 5 | None |
| Task completed | By cognitive load: Light 15, Medium 30, Heavy 50 | None |
| Day closed with review | 20 | None |

The multiplier starts at 1.0 and is capped at 3.0.

**Requirements**

* GAME-1: All XP changes are recorded as events in a ledger, so rules can be retuned and totals recalculated.  
* GAME-2: Total XP and level can never decrease.  
* GAME-3: The multiplier, XP, level, and integrity meter are visible on the main dashboard at all times.  
* GAME-4: Gamification parameters live in configuration, not hard-coded in logic.  
* GAME-5: Level-ups and milestones produce clear, satisfying feedback in the interface.

### **8.5 Insights and Calibration**

**Purpose.** Turn logged history into a mirror of the user’s behavior and use it to improve scheduling.

**Capabilities**

* A drift heat map by hour of day and day of week.  
* Completion rate by Daily Profile, showing which energy settings actually work.  
* Weekly trends for consistency, combo length, and integrity.  
* Identification of peak windows, which the planner then protects by placing heavy tasks there.  
* A short end-of-day and end-of-week summary written in plain language.

**Requirements**

* INS-1: Reports are generated from locally logged data only.  
* INS-2: Insights are phrased as observations, never judgments.  
* INS-3: The planner can use detected peak windows when placing tasks, and the user can turn this off.

### **8.6 Settings and Control**

* Check-in interval, interruption level, quiet hours, blocked off time (for classes), and work-day boundaries.  
* Gamification parameters (advanced).  
* On/off switch for AI features.  
* Data export, backup, and full reset.

### **8.7 Habits**

**Purpose.** Recurring commitments (making the bed, taking vitamins, weekly groceries) should not have to be re-entered every morning. Habits are defined once with a schedule, and the system automatically adds them to the Daily Planner as tasks on the days they are due.

**Defining a habit**

| Field | Description |
| ----- | ----- |
| Name | What the habit is (for example, “Make the bed”) |
| Frequency | How often it is due (see below) |
| Preferred time | Optional: a time of day or window (morning, afternoon, evening) used when placing it on the timeline |
| Estimated duration | Used for timeline fitting |
| Cognitive Load | Light, Medium, or Heavy, same scale as other tasks |
| Essential | Optional flag: kept in the plan even on Low-Energy Rescue days |
| Status | Active or Paused (for travel, illness, or breaks) |

**Frequency options**

* Every day.  
* Specific weekdays (for example, Monday, Wednesday, Friday).  
* Every N days.  
* N times per week, on any day (flexible).  
* Weekly, monthly, or on a specific day of the month.

For weekly and “N times per week” habits (such as groceries), the habit is due within a window rather than on a fixed day. It appears in each day’s plan until completed, then stays out of the way until the next window opens.

**Behavior**

* When the user confirms the day’s plan, every habit due that day is already present as a task, tagged as a habit, alongside the tasks entered manually.  
* The Daily Profile controls how many habits appear. Sprinting and Maintenance include all due habits. Low-Energy Rescue includes only habits flagged Essential, and the rest are deferred, not failed.  
* Habit tasks behave like any other task: they can be reordered, shrunk, skipped, or rescheduled for later in the day.  
* Completing a habit earns XP and counts toward Task completion. Each habit also tracks its own streak.  
* A skipped habit never reduces XP. Skipping is logged, and a single skip does not break a streak if the habit has a grace allowance (for example, one miss per week). **\[Assumption\]**  
* Insights (Section 8.5) report completion rate per habit, so the user can see which habits are sticking and which should be shrunk or rescheduled.

**Requirements**

* HAB-1: The user can create, edit, pause, and delete habits at any time.  
* HAB-2: Each habit has a configurable frequency from the options above.  
* HAB-3: Habits due today are added to the day’s plan automatically, with no manual entry.  
* HAB-4: Weekly and flexible habits remain visible until completed within their window.  
* HAB-5: Low-Energy Rescue days include only Essential habits and defer the rest without penalty.  
* HAB-6: Completion, skips, and streaks are logged per habit and available to Insights.  
* HAB-7: Editing or deleting a habit never alters past history.

### **8.8 Screen Time Import (Future)**

**Purpose.** Drift does not only happen on the laptop. Phone use is often where focus quietly leaks. Letting the user bring phone screen time into the product connects that behavior to the same picture as their check-ins, tasks, and habits, so Insights can show the full story.

**Approach.** Import is always **user-initiated and manual**. The product never connects to the phone, an account, or the network. The user brings the data to the laptop, and it is processed and stored locally like everything else (see ARCH-1). This section is not part of the Version 1 phases.

**Supported inputs (to be validated)**

| Input | How it works | Notes |
| ----- | ----- | ----- |
| Screenshot of the phone’s screen time summary | User uploads an image; a local vision-capable model reads app names and durations | Requires a local model with image support; user always reviews extracted values before saving |
| File export | User uploads a CSV or similar file if their phone or a tool produces one | Availability varies by phone platform and needs to be verified before building |
| Manual entry | User types daily totals or top apps | Always available; also serves as the fallback if extraction fails |

**Behavior**

* The user chooses a date (or date range) and uploads or enters data.  
* The system extracts total screen time and per-app or per-category durations, then shows them for confirmation and correction. Nothing is saved until the user approves.  
* Apps can be categorized by the user (for example: Productive, Neutral, Distraction), and categories are remembered for future imports.  
* Imported data feeds Insights: phone time alongside drift patterns, days of high phone use versus plan completion, and trends over weeks.  
* Phone data can optionally contribute to gamification, such as a small reward for a day under a self-set screen time goal. It never subtracts XP. **\[Assumption\]**  
* Data is imported in batches (daily or weekly). Real-time tracking is out of scope.

**Requirements**

* SCR-1: Import is manual and initiated by the user. No automatic phone connection or background sync.  
* SCR-2: All extraction and storage happen locally, with no external calls.  
* SCR-3: The user reviews and can edit all extracted values before they are saved.  
* SCR-4: Imported records can be viewed, edited, and deleted at any time.  
* SCR-5: App-to-category mappings are user-defined and persistent.  
* SCR-6: Insights treat phone data as an observation, never a judgment (see INS-2).  
* SCR-7: Failed or low-confidence extraction falls back to manual entry without losing the upload.

## **9\. Key User Flows**

**Flow A: Start the day**

1. User opens the app and enters or pastes tasks (this could be from the night before).  
2. User selects a Daily Profile.  
3. System proposes a structured task list and timeline.  
4. User edits as needed and confirms.  
5. The plan becomes active and the first check-in is scheduled.

**Flow B: Check-in**

1. The prompt appears at the interval, showing the current task.  
2. User chooses On Track, Pivot, or Drifted (optionally adding a note).  
3. On Track: XP is awarded, combo increases, prompt closes.  
4. Pivot: user picks the next task or accepts a reshuffle; combo preserved.  
5. Drifted: combo resets, honesty XP is awarded, and the Reframe screen opens with a shrunken task already suggested.

**Flow C: Reframe**

1. User triggers the shortcut and writes a brain dump.  
2. System returns the diagnosis and one micro-action.  
3. User accepts, edits, or requests another option.  
4. On completion, XP is awarded and the user is returned to their plan with an adjusted next step.

**Flow D: Close the day**

1. User ends the day (or the system prompts at the configured end time).  
2. A summary shows XP earned, longest combo, check-in stats, and tasks to carry over.  
3. Integrity is updated.  
4. If opted for, the user may be prompted with set up for their next day

## **10\. Conceptual Data Model**

All data is stored in a single local file-based database. These are the main entities at a conceptual level.

| Entity | Description | Key relationships |
| ----- | ----- | ----- |
| Day | One working day, with its chosen profile and summary | Has many plan items, pulses, and XP events |
| Task | A unit of work with estimate, cognitive load, status, and optional parent (for chunks and shrunken versions) | Belongs to a Day; may have prerequisite tasks |
| Plan Item | A task placed on the timeline with a time slot | Links Task to Day |
| Pulse | One check-in: time, response, current task, optional note | Belongs to a Day; references a Task |
| Brain Dump | Raw text, timestamp, and context at time of entry | May produce a Reframe Result |
| Reframe Result | Diagnosis category, micro-action, completion status | Belongs to a Brain Dump; may reference a Task |
| XP Event | A ledger entry: amount, reason, multiplier at the time | References a Pulse, Task, or Reframe Result |
| Player State | Current level, total XP, multiplier, integrity | Derived from the XP ledger; cached for speed |
| Settings | User preferences and gamification configuration | Single record |
| Habit | A recurring commitment with frequency rule, preferred time, duration, cognitive load, essential flag, and status | Generates Tasks on due days |
| Habit Occurrence | One due instance of a habit with outcome: completed, skipped, or deferred | Belongs to a Habit and a Day; links to the Task it generated |
| Screen Time Record (future) | Date, total duration, per-app or per-category durations, source type, import timestamp | Feeds Insights |
| App Category (future) | App name and user-assigned category (Productive, Neutral, Distraction) | Used when categorizing Screen Time Records |

Two design decisions follow from this model: the XP ledger is the source of truth and Player State is derived from it, and raw history (pulses, brain dumps, plans) is never overwritten, because Phase 4 depends on it.

## **11\. System Architecture (High Level)**

### **11.1 Approach**

A **local loopback architecture**: the interface, application logic, database, and AI model all run on the same laptop and communicate only over the local machine. There are no cloud dependencies, no external network calls at runtime, and no recurring cost.

### **11.2 Components**

| Component | Role | Proposed technology |
| ----- | ----- | ----- |
| Client interface | Minimalist, terminal-inspired dashboard: timeline, XP and combo display, check-in prompts, brain dump | Next.js with React |
| Application server | Routes requests, applies game rules, manages the scheduler and background timers | Next.js server layer |
| Data layer | Stores all tasks, pulses, brain dumps, and XP events | SQLite (single local file) |
| Intelligence layer | Task parsing, schedule suggestions, reframing | Ollama serving a local open-source model (such as Llama 3 8B or DeepSeek-R1 8B) on its local port |
| Scheduler | Fires check-ins and end-of-day prompts reliably | Timer service inside the application server |

### **11.3 Key Architectural Requirements**

* ARCH-1: No outbound network access is required for any feature at runtime.  
* ARCH-2: AI features degrade gracefully. If the model is unavailable or slow, the user can still plan manually, check in, and use preset micro-actions.  
* ARCH-3: AI responses must be structured and validated before use. Malformed output is retried or rejected, never trusted.  
* ARCH-4: The AI proposes and the user approves. The model never changes the plan or the data without confirmation.  
* ARCH-5: The scheduler must tolerate sleep, restart, and clock changes without losing or double-counting pulses.  
* ARCH-6: The delivery mechanism for check-ins must be able to reach the user while another application (such as a game) is in focus. This is the main open technical decision (see Risk R1).

## **12\. AI Behavior Design**

**Roles**

* **Planner.** Converts unstructured text into tasks with estimates, cognitive load, and ordering, tuned to the selected profile.  
* **Diagnostician.** Reads a brain dump alongside history, names the blockage, and returns one small, concrete action.

**Behavior rules**

* Responses are short, specific, and grounded in the user’s own logged data rather than generic advice.  
* The tone is that of a practical coach: direct, warm, never scolding and never clinical.  
* Output is structured for the interface, not free-form chat.  
* The user can always override, edit, or reject suggestions.  
* The AI is not presented as a therapist and does not give medical advice.

**Quality assurance.** Build a small test set of realistic messy task inputs and brain dumps early, and evaluate each candidate model against it for structure reliability, usefulness, and response time.

## **13\. Interface and Experience Requirements**

* **Visual style.** Stardew Valley-inspired, game-console in feel.  
* **Dashboard.** Always shows today’s timeline, current task, XP bar, combo multiplier, integrity meter, and time to next check-in.  
* **Check-in prompt.** Visually unmistakable, answerable by mouse or keyboard in one action.  
* **Shortcuts.** A universal shortcut for Reframe and quick keys for the three check-in responses.  
* **Feedback.** XP gains, combo growth, and level-ups are animated and satisfying but quick, so they never slow the flow.  
* **Tone.** Short, plain, lightly playful copy throughout. Failure messages always include the next step.  
* **Accessibility.** Readable contrast, keyboard operability, and no reliance on color alone.

## **14\. Non-Functional Requirements**

| Area | Requirement |
| ----- | ----- |
| Privacy | All data stays on the device; no telemetry; no external calls |
| Reliability | Scheduler survives restarts and sleep; pulses reconcile correctly |
| Performance | Check-in appears within 2 seconds of its scheduled time; non-AI actions feel instant; AI responses show progress and finish within a target to be set after model testing |
| Durability | One-step export and backup of the database file; periodic automatic local backup |
| Maintainability | Game rules and prompts live in configuration and are easy to retune |
| Cost | Zero run cost |

## **15\. Phased Roadmap**

Each phase ends with a working, usable product, and the next phase starts only when the current exit criteria are met.

| Phase | Goal | Scope | Exit criteria |
| ----- | ----- | ----- | ----- |
| 1\. Foundation | Establish the local system | Local app, local database, basic schema for tasks and sessions, manual task entry and list | A task entered in the UI appears in the local database and displays back correctly |
| 2\. Game Loop | Time tracking and reinforcement | Timeline dashboard, 30-minute check-in scheduler, three-state responses, XP ledger, combo, levels, integrity meter, interruption levels, pause, basic habits (create, schedule, auto-add to daily plan) | A full day can be run manually with working check-ins and visibly updating XP |
| 3\. Local AI | Intelligence on the laptop | Ollama connection, Planner and Diagnostician instructions, Reframe feature, Task Shrinkage, validation and fallbacks | Messy text becomes a structured plan, and a brain dump yields a useful diagnosis and micro-action, entirely offline |
| 4\. Telemetry | Learn from history | Insights views, peak-window detection, planner calibration, daily and weekly summaries, per-habit completion and streak insights | The app correctly identifies drift patterns and adjusts scheduling to protect peak windows |

**Backlog (post-v1 ideas):** a desktop wrapper for stronger system-level interruptions, calendar import, a rewards or unlockables store, themes, voice brain dumps, a weekly goal layer. Also: manual screen time import (depends on Phases 3 and 4; see Section 8.8).

## **16\. Risks and Mitigations**

| ID | Risk | Mitigation |
| ----- | ----- | ----- |
| R1 | A web app may not reliably interrupt the user when another app (such as a game) is in focus, especially with the tab in the background. | Decide the delivery method in Phase 2: browser notifications with sound, an installable web app, or a lightweight desktop wrapper. Prototype early. |
| R2 | Small local models may produce unreliable structure or weak advice. | Structured output validation, retries, a model test set, a manual fallback, and the ability to swap models. |
| R3 | Check-ins every 30 minutes may become annoying and get ignored. | Configurable interval and intensity, Pause, quiet hours, and adaptive suggestions based on response history. |
| R4 | The novelty of gamification fades. | Ledger-based, tunable rules and a backlog of new mechanics, reviewed during Phase 4\. |
| R5 | Users stop reporting drift honestly. | Honesty XP and a never-punish design. |
| R6 | Scope creep stalls the project. | Phase gates and this document as the scope reference. |
| R7 | The Reframe feature meets serious distress it should not handle as a productivity problem. | Explicit safety behavior in prompts, non-clinical framing, and a gentle prompt to seek real support. |
| R8 | Data loss from a single database file. | Automatic local backups and easy export. |
| R9 | Local hardware is too slow for the chosen model. | Test on the actual laptop early and select the model by measured performance. |
| R10 | Local vision models may misread screenshots of phone screen time. | Mandatory user review before saving, and manual entry fallback. |
| R11 | Phone export options vary by platform and may change. | Validate options before building; screenshot and manual entry remain as baseline methods. |
| R12 | Too many habits crowd the daily plan and cause overwhelm. | Essential flag, profile-based filtering, and per-habit insights to prune or shrink habits. |

## **17\. Open Questions and Decisions**

| \# | Question | Notes |
| ----- | ----- | ----- |
| 1 | Final product name | See Appendix A |
| 2 | How should “removing scheduled rigidity” be interpreted? | **\[Option\]** The product replaces a rigid timetable with a plan that adapts continuously through Pivot, re-planning, and profiles. Confirm this matches the intent. |
| 3 | Check-in delivery mechanism | Browser notification, installable web app, or desktop wrapper (see R1) |
| 4 | Combo behavior on Drifted | Full reset (current spec) or drop one tier. Playtest in Phase 2\. |
| 5 | Which hardware and model | Confirm laptop specs; benchmark candidate models |
| 6 | Work-day boundaries | Fixed hours, or start and end the day manually? Currently leaning start and end manual options with configured fixed hours. |
| 7 | Rewards beyond XP | Unlockables, themes, or personal rewards the user defines |
| 8 | Check-ins outside planned time | Should the pulse run when no plan is active? |
| 9 | Pause behavior | Confirm that paused time never affects combo or integrity |
| 10 | Grace allowance per habit | Default amount, and whether it is configurable per habit |
| 11 | Habit reminders | Should a habit be able to trigger its own time-based reminder outside the 30-minute pulse? |
| 12 | Phone platform | Which phone is in use, and which import method is most practical day to day? |
| 13 | Screen time goals | Should the user be able to set a self-defined daily limit that feeds into gamification? |

## **Appendix A: Naming Candidates**

Meanings are approximate and offered only as a starting point for the decision.

| Name | Origin | Rough meaning |
| ----- | ----- | ----- |
| Consto | Latin | “I stand firm” or “I am consistent” |
| Constantia | Latin | Steadfastness, constancy |
| Kata | Japanese | A practiced form or pattern, repeated to mastery |
| Niyam | Sanskrit and Hindi | Rule, discipline, observance |
| Ordo | Latin | Order, sequence |
| Sudor | Latin | Sweat, effort |
| Meliora | Latin | “Better things,” continual improvement |

## **Appendix B: Glossary**

* **Pulse:** a periodic check-in prompt.  
* **Combo multiplier:** an XP multiplier that grows with consecutive on-track pulses.  
* **Task Shrinkage:** replacing a task with a much smaller version to lower the barrier to starting.  
* **System Integrity:** a long-term consistency meter shown as a health bar and a heat map.  
* **Cognitive Load:** a Light, Medium, or Heavy rating of a task’s mental demand.  
* **Daily Profile:** the energy setting (Sprinting, Maintenance, Low-Energy Rescue) that shapes the day’s plan.  
* **Reframe:** the brain dump and diagnosis feature.  
* **Micro-action:** a tiny, immediately startable step that creates momentum.