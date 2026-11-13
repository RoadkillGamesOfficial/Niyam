// The one Electron-specific part of a reminder: a native notification whose
// click brings the window back. Everything interesting lives in
// src/reminders/decide.ts, which is why this file stays tiny.

const { Notification } = require("electron");

function createNotifier({ onOpen }) {
  // Kept so the spike can invoke the last toast's click handler; Electron
  // exposes no way to click a Windows toast from a script.
  let last = null;
  return {
    last: () => last,
    supported() {
      return Notification.isSupported();
    },
    show({ title, body }) {
      if (!Notification.isSupported()) {
        console.log("notifications are not available on this machine");
        return false;
      }
      const notification = new Notification({ title, body });
      notification.on("click", onOpen);
      last = notification;
      notification.show();
      console.log(`notification shown: ${title} | ${body}`);
      return true;
    },
  };
}

module.exports = { createNotifier };
