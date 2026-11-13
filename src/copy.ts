// Every user-facing string lives here so it is easy to replace in one place.
// Voice pass 2026-11-08 for Phase 2: short, warm, plain. The rules behind these
// strings are in docs/voice-guide.md.

// The one and only place the product name appears. See docs/decisions.md.
export const PRODUCT_NAME = "Niyam";

export const COPY = {
  metaDescription:
    "A quiet companion for planning the day and keeping momentum. It all stays on this laptop.",
  reminders: {
    // Phase 4: what a check-in says when it reaches the desktop instead of the
    // page. The task title goes into {task} and is shortened before it gets there.
    title: "Check-in",
    noTask: "How is it going?",
    withTask: "Still on {task}?",
  },
  nav: {
    home: "Today",
    settings: "Settings",
    insights: "Insights",
    homeHint: "Back to today",
    sectionsLabel: "Sections",
  },
  home: {
    title: PRODUCT_NAME,
    lede: "One small day at a time.",
    dayLabel: "Today",
    daySeparator: "·",
    profileLabel: "Energy",
    profileHint: "Pick what today can hold. It changes how much is planned.",
    profiles: {
      sprinting: "Sprinting",
      maintenance: "Maintenance",
      low_energy: "Low-energy rescue",
    },
    planHeading: "The plan",
    currentLabel: "On now",
    noCurrent: "Nothing open. Take the gap, or add one small thing.",
    empty: "The plan is clear. Add one small thing to begin.",
    draftBadge: "Draft",
    runningBadge: "Running",
    closedBadge: "Closed",
    pausedBadge: "Paused",
    closedHeading: "Day closed",
    closedLede: "That is today. Tomorrow starts from here.",
  },
  task: {
    addLabel: "Add a task",
    placeholder: "The smallest next thing",
    addButton: "Add",
    loadLabel: "Weight",
    loads: {
      light: "Light",
      medium: "Medium",
      heavy: "Heavy",
    },
    reorderUp: "Move up",
    reorderDown: "Move down",
    markDone: "Mark done",
    markOpen: "Mark open",
    taskDoneMark: "[x]",
    taskOpenMark: "[ ]",
    completionTitle: "Task done",
    completionBody: "One small thing finished.",
    habitTag: "Habit",
    carriedTag: "Carried over",
  },
  plan: {
    start: "Start the day",
    startHint: "Starting sets the plan and begins check-ins.",
    replan: "Re-plan the rest",
    carryHeading: "Still open from before",
    carryLede: "Bring one over, or let it go. Nothing is forced.",
    bringOver: "Bring over",
    emptyCarry: "Nothing waiting.",
  },
  progress: {
    hudLabel: "Progress",
    levelLabel: "Level",
    levelShort: "Lv",
    xpLabel: "XP",
    todayXp: (xp: number) => `${xp} today`,
    comboLabel: "Combo",
    comboHint: "Grows with on-track answers. An unanswered check-in resets it.",
    integrityLabel: "Integrity",
    toNext: "to next level",
    topLevel: "Top level reached",
    integrityHint: "How steady the last two weeks have been.",
  },
  checkin: {
    heading: "Check-in",
    question: "How is it going?",
    onTrack: "On track",
    pivot: "Pivot",
    drifted: "Drifted",
    noteLabel: "Note (optional)",
    notePlaceholder: "One line is plenty",
    submit: "Log it",
    nextIn: "Next check-in",
    every: "every",
    overlayHeading: "Check-in time",
    overlayHint: "Answering puts you back on the page. Nothing else is needed.",
    quietHeading: "Quiet hours",
    quietLede: "This one waited quietly. Answer it if you like, or leave it for the morning.",
    paused: "Check-ins paused",
    idle: "All clear. The next check-in comes on its own.",
    pause: "Pause check-ins",
    resume: "Resume check-ins",
    missedHelper: "An unanswered check-in never costs XP. It only resets the combo.",
    quietHelper: "Quiet hours keep check-ins quiet. They are never counted as unanswered.",
    driftedHeading: "Make it smaller",
    driftedLede: "Pick something easier than the whole task. Starting counts.",
    microActions: [
      "Open the file and read one line",
      "Write one sentence",
      "Set a five-minute timer",
      "Clear one thing from the desk",
      "Say the first step out loud",
    ],
    shrink: "Make it this small",
    quickHint: "Keys: O on track · P pivot · D drifted",
  },
  reframe: {
    nav: "Reframe",
    heading: "Reframe",
    lede: "Say the messy version. You get a short read on what is in the way and one step you can start.",
    inputLabel: "What is actually going on?",
    placeholder: "No need to make it tidy.",
    shortcutHint: "Press R on any page to come back here.",
    taskLabel: "Tied to a task (optional)",
    taskNone: "No particular task",
    submit: "Read this",
    categoryLabel: "In the way",
    categories: {
      clarity: "Clarity",
      overwhelm: "Too much at once",
      fatigue: "Low energy",
      avoidance: "Avoidance",
      distraction: "Pulled away",
      low_mood: "Low mood",
      distress: "Something heavier",
    },
    diagnosisLabel: "The read",
    actionLabel: "One small step",
    accept: "Put this step on the plan",
    accepted: "The step is on the plan.",
    another: "Another angle",
    fromDrift: "Talk it through",
    shrinksLabel: "Shrinks",
    editLabel: "Change the dump",
    save: "Save and read again",
    delete: "Delete",
    deleted: "Deleted.",
    pastHeading: "Past dumps",
    emptyPast: "Nothing here yet.",
    open: "Open",
    refreshed: "A new read.",
    aiOff: "Local AI is off. Turn it on in Settings to use it.",
    error: "That dump needs some words in it.",
    fallbackNotice: "The local model did not answer, so this is the plain version.",
    fallbackDiagnosis: "The dump is carrying more than one thing at once.",
    fallbackAction: "Write one line about the smallest piece, then stop there.",
    safetyDiagnosis: "This sounds heavier than a planning problem.",
    safetyAction: "Tell one person you trust, or reach out to a professional. The plan can wait.",
  },
  ai: {
    heading: "Local AI",
    lead: "A small model on this laptop does the reading. Nothing is sent anywhere.",
    enabled: "Use local AI",
    model: "Model",
    modelHint: "Small is fine. The default runs on a modest laptop.",
    modelError: "That model name did not save. Use the tag Ollama shows, like llama3.2:1b.",
    check: "Check the model",
    ok: "The local model answered. It is ready.",
    down: "The model did not answer. Everything still works by hand.",
    off: "Local AI is off. Turn it on in Settings to use it.",
    shapeHeading: "Shaping a messy list",
    shapeHint: "Paste tasks however they come out. You see the plan before anything saves.",
    shapePlaceholder: "email Sam about the invoice, fix the leak, maybe start the report?",
    shapeButton: "Shape it",
    shapeError: "That list could not be shaped. Try again, or add tasks by hand.",
    busy: "Working…",
    presetToggle: "Pick a preset step",
    replanned: "The rest of the day is re-ordered.",
    replanFallback: "The local model did not answer, so the current order is kept.",
    reviewHeading: "Review the plan",
    reviewLede: "Edit a line, untick what you do not want, or discard the lot. Nothing saves until you add it.",
    fallbackNotice: "The local model was unavailable, so this is a plain split of your list.",
    accept: "Add these to the plan",
    discard: "Discard",
    added: "Added to the plan.",
    itemTitle: "Task",
    itemMinutes: "Minutes",
    itemLoad: "Weight",
    askSmaller: "Ask for a smaller step",
    shrinkNotice: "A smaller step is on the plan.",
  },
  habits: {
    heading: "Habits",
    empty: "No habits yet. Add one you want to keep.",
    addLabel: "New habit",
    name: "Name",
    namePlaceholder: "Make the bed",
    frequency: "How often",
    frequencies: {
      daily: "Every day",
      weekdays: "Certain weekdays",
      every_n: "Every few days",
      times_per_week: "Times per week",
      monthly: "Monthly",
    },
    detail: "Schedule detail",
    detailPlaceholder: "Optional",
    detailHint: "Only some schedules need this. Weekdays are 0–6, Sunday is 0.",
    essential: "Keep on low-energy days",
    load: "Weight",
    addButton: "Add habit",
    streak: "day streak",
    pause: "Pause",
    resume: "Resume",
    archive: "Archive",
    skip: "Skip today",
    pausedTag: "Paused",
    error: "That habit could not be saved. Check the details and try again.",
  },
  settings: {
    heading: "Settings",
    lede: "How often to check in, what the local AI may do, and where your data lives.",
    interval: "Minutes between check-ins",
    intervalHint: "Between 5 and 240. Thirty is the default.",
    level: "Interruption style",
    levels: {
      gentle: "Gentle — a quiet note on the page",
      standard: "Standard — a note and a soft chime",
      firm: "Firm — a full-screen check-in",
    },
    quiet: "Quiet hours",
    quietHint: "Leave either field blank to turn quiet hours off.",
    quietFrom: "From",
    quietTo: "To",
    save: "Save",
    saved: "Saved.",
    error: "That did not save. Check the values and try again.",
    dataHeading: "Your data",
    dataLede:
      "Everything lives in one local database file. Download a snapshot whenever you want. Automatic backups keep a short recent history.",
    exportButton: "Download a snapshot",
    exportHint: "One .db file with all your history. Nothing leaves this laptop.",
    exportError: "The export could not be prepared. Check the data folder and try again.",
    backupHeading: "Automatic backups",
    backupLede: (count: number, hours: number) =>
      count === 0
        ? `No automatic backup yet. One is written when the app opens, then at most every ${hours} hours.`
        : `${count} automatic backup${count === 1 ? "" : "s"} kept. A new one is written at most every ${hours} hours.`,
    backupLatest: (name: string) => `Newest: ${name}.`,
    backupPolicy: (keep: number) =>
      `The newest ${keep} automatic backups are kept. Older ones are removed.`,
    backupNow: "Back up now",
    backedUp: "A backup snapshot was written.",
    backupError: "The backup could not be written. Check the data folder and try again.",
    gameHeading: "Game values",
    gameNote:
      "These numbers live in the code so every change is reviewed. Change them in src/config.ts and restart.",
    gameValues: {
      onTrack: "On-track pulse (times combo)",
      pivot: "Pivot pulse",
      drifted: "Drifted pulse",
      micro: "Micro-action finished",
      light: "Light task finished",
      medium: "Medium task finished",
      heavy: "Heavy task finished",
      closed: "Day closed",
      comboStep: "Combo step",
      comboCap: "Combo cap",
    },
  },
  insights: {
    heading: "The mirror",
    lede: "The patterns your own days have made. They are observations, not a verdict.",
    summaryHeading: "The short version",
    weekHeading: "This week",
    lastWeekHeading: "Last week",
    todayHeading: "Today",
    noData: "No history yet. A few days of check-ins will start the picture.",
    blankDay: "Today is still a blank page. One small task is enough to start.",
    tasksLine: (done: number, total: number) =>
      `${done} of ${total} tasks finished today.`,
    noTasks: "No tasks planned today yet.",
    checkinsLine: (answered: number, onTrack: number) =>
      `${answered} check-ins answered today, ${onTrack} on track.`,
    noCheckins: "No check-ins answered today yet.",
    driftLine: (drifted: number, missed: number) => {
      const parts: string[] = [];
      if (drifted > 0) {
        parts.push(`${drifted} moment${drifted === 1 ? "" : "s"} drifted`);
      }
      if (missed > 0) {
        parts.push(`${missed} check-in${missed === 1 ? "" : "s"} went unanswered`);
      }
      return `${parts.join(" and ")} today. That is information, not a verdict.`;
    },
    xpLine: (xp: number) => `${xp} XP earned today.`,
    weekLine: (days: number, tasks: number) =>
      `${tasks} task${tasks === 1 ? "" : "s"} finished on ${days} ${days === 1 ? "day" : "days"} this week.`,
    lastWeekLine: (days: number, tasks: number) =>
      `${tasks} task${tasks === 1 ? "" : "s"} finished on ${days} ${days === 1 ? "day" : "days"} last week.`,
    weekEmpty: "This week is still open. A single check-in starts the pattern.",
    weekConsistency: (rate: string) => `${rate} of check-ins answered this week.`,
    lastWeekConsistency: (rate: string) =>
      `${rate} of check-ins answered last week.`,
    lastWeekEmpty:
      "No check-ins or finished tasks last week. Your next check-in starts the picture.",
    bestDay: (day: string, tasks: number) =>
      `${day} was the steadiest day, with ${tasks} tasks finished.`,
    heatHeading: "When drift shows up",
    heatLede:
      "Darker squares hold more drift and unanswered check-ins. Empty squares had no check-ins.",
    heatCell: (day: string, hour: number, drifted: number, missed: number) => {
      const parts: string[] = [];
      if (drifted > 0) {
        parts.push(`${drifted} drifted`);
      }
      if (missed > 0) {
        parts.push(`${missed} unanswered`);
      }
      return `${day} ${String(hour).padStart(2, "0")}:00 · ${parts.length > 0 ? parts.join(", ") : "no drift"}`;
    },
    heatAria: (drifts: number, checkins: number) =>
      `${drifts} drift moment${drifts === 1 ? "" : "s"} across ${checkins} check-in${checkins === 1 ? "" : "s"}.`,
    heatEmptyCell: (day: string, hour: number) =>
      `${day} ${String(hour).padStart(2, "0")}:00 · no check-ins`,
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    profileHeading: "Which energy settings work",
    profileLede: "Task completion under the energy you chose that morning.",
    profileLine: (done: number, total: number, rate: string) =>
      `${done} of ${total} tasks · ${rate}`,
    profileEmpty: "No tasks under this setting yet.",
    trendsHeading: "Week by week",
    trendsLede:
      "Consistency is the share of check-ins answered. Combo is the longest on-track run. Integrity blends answered check-ins with finished tasks.",
    tableWeek: "Week",
    tableConsistency: "Consistency",
    tableCombo: "Longest combo",
    tableIntegrity: "Integrity",
    noValue: "—",
    habitsHeading: "Habits",
    habitsLede: "How each habit has gone lately, with a gentle next step where one is slipping.",
    habitLine: (done: number, decided: number, rate: string) =>
      `${done} of ${decided} recent days · ${rate}`,
    habitNoData: "No recent days yet.",
    habitStreak: (days: number) => `${days} day streak`,
    suggestionShrink: "Try a five-minute version.",
    suggestionReschedule: "Give it a time that fits your better hours.",
    peaksHeading: "Peak windows",
    peaksLede:
      "Hours when your check-ins tend to go well. When this is on, the planner places heavy work here.",
    peaksEmpty: "No clear peak yet. A little more history will find one.",
    peakWindow: (start: string, end: string, rate: string) =>
      `${start}:00–${end}:00 · ${rate} on track`,
    peaksOn: "Peak-window planning is on.",
    peaksOff: "Peak-window planning is off.",
    settingsLink: "Change this in Settings",
    planTimes: "Start times are suggestions from your peak windows.",
    settingsHeading: "Insights",
    settingsLede:
      "The mirror reads your own history. You can turn peak-window planning off at any time.",
    peakToggle: "Place heavy work in peak windows",
    peakHint:
      "When this is off, planning keeps its usual order and no suggested times are added.",
  },
  rewards: {
    xp: (xp: number) => `+${xp} XP`,
    levelUp: "Level up!",
    levelUpBody: (name: string) => `You reached ${name}.`,
    dismiss: "Nice",
    freshStart: "Fresh start",
  },
  dayClose: {
    close: "Close the day",
    closeHint: "Closes today and keeps everything for the record.",
    heading: "Today, wrapped",
    xp: "XP earned",
    answered: "Check-ins answered",
    missed: "Left unanswered",
    longest: "Longest on-track run",
    tasks: "Tasks finished",
    carry: "Still open",
  },
};

/** The display name for a stored profile slug, for prompts and AI context. */
export function profileName(profile: string): string {
  return COPY.home.profiles[profile as keyof typeof COPY.home.profiles] ?? profile;
}

/** The display name for a stored pulse response, for prompts and AI context. */
export function responseName(response: string): string {
  switch (response) {
    case "on_track":
      return COPY.checkin.onTrack;
    case "pivot":
      return COPY.checkin.pivot;
    case "drifted":
      return COPY.checkin.drifted;
    default:
      return response;
  }
}
