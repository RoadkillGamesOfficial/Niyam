// The tray menu as data, so the decision is testable without Electron.
// Open, one reminder switch, Quit. Autostart is not a tray item: it belongs to
// the installer and Windows' own startup settings (see docs/decisions.md).

function trayMenuTemplate({ snoozed = false } = {}) {
  return [
    { id: "open", label: "Open" },
    snoozed
      ? { id: "resume", label: "Resume reminders" }
      : { id: "snooze", label: "Snooze for an hour" },
    { type: "separator" },
    { id: "quit", label: "Quit" },
  ];
}

/**
 * Turns the data into a template Electron can build, keeping the ids so the
 * live menu can be found by id and driven the way a click drives it.
 */
function toMenuTemplate(items, actions) {
  return items.map((item) =>
    item.type === "separator"
      ? { type: "separator" }
      : { id: item.id, label: item.label, click: () => actions[item.id]?.() },
  );
}

module.exports = { toMenuTemplate, trayMenuTemplate };
