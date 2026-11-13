// Electron glue for the tray. The menu itself is data from tray-menu.js.

const { Menu, Tray, nativeImage } = require("electron");
const path = require("node:path");
const { toMenuTemplate, trayMenuTemplate } = require("./tray-menu.js");

const iconPath = path.join(__dirname, "assets", "tray.png");

/**
 * Returns the tray together with the menu it shows, so a caller can reach the
 * real items (`menu.getMenuItemById`) instead of rebuilding them.
 */
function createTray({ onOpen, onQuit }) {
  const image = nativeImage.createFromPath(iconPath);
  const menu = Menu.buildFromTemplate(
    toMenuTemplate(trayMenuTemplate(), { open: onOpen, quit: onQuit }),
  );

  const tray = new Tray(image);
  tray.setToolTip("Niyam");
  tray.setContextMenu(menu);

  // A single left click should bring the window back, as every tray app does.
  tray.on("click", onOpen);

  return {
    tray,
    menu,
    iconSize: image.getSize(),
    iconEmpty: image.isEmpty(),
    destroy() {
      tray.destroy();
    },
  };
}

module.exports = { createTray, iconPath };
