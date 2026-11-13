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

module.exports = { trayMenuTemplate };
