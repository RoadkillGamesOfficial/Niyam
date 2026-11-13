// Electron glue for the tray. The menu itself is data from tray-menu.js.

const { Menu, Tray, nativeImage } = require("electron");
const path = require("node:path");
const { toMenuTemplate, trayMenuTemplate } = require("./tray-menu.js");

const iconPath = path.join(__dirname, "assets", "tray.png");

/**
 * Returns the tray together with the menu it shows, so a caller can reach the
 * real items (`menu.getMenuItemById`) instead of rebuilding them.
 */
function createTray({ onOpen, onQuit, onSnooze, snoozed = false }) {
  const image = nativeImage.createFromPath(iconPath);
  const actions = { open: onOpen, snooze: onSnooze, resume: onSnooze, quit: onQuit };

  const tray = new Tray(image);
  tray.setToolTip("Niyam");
  tray.on("click", onOpen);

  let menu = null;
  function apply(nextSnoozed) {
    menu = Menu.buildFromTemplate(
      toMenuTemplate(trayMenuTemplate({ snoozed: nextSnoozed }), actions),
    );
    tray.setContextMenu(menu);
    return menu;
  }
  apply(snoozed);

  return {
    tray,
    get menu() {
      return menu;
    },
    iconSize: image.getSize(),
    iconEmpty: image.isEmpty(),
    setSnoozed(next) {
      apply(next);
    },
    destroy() {
      tray.destroy();
    },
  };
}

module.exports = { createTray, iconPath };
