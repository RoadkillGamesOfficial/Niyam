// The tray menu as data, so the decision is testable without Electron.
// Deliberately two items: Open and Quit. Autostart is deferred until the
// background check-in gives it a purpose (see docs/decisions.md).

function trayMenuTemplate() {
  return [
    { id: "open", label: "Open" },
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
