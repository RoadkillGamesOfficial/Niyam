// Electron glue for the tray. The menu itself is data from tray-menu.js.

const { Menu, Tray, nativeImage } = require("electron");
const path = require("node:path");
const { trayMenuTemplate } = require("./tray-menu.js");

function createTray({ onOpen, onQuit }) {
  const image = nativeImage.createFromPath(path.join(__dirname, "assets", "tray.png"));
  const tray = new Tray(image);
  tray.setToolTip("Niyam");

  const actions = { open: onOpen, quit: onQuit };
  tray.setContextMenu(
    Menu.buildFromTemplate(
      trayMenuTemplate().map((item) =>
        item.type === "separator"
          ? { type: "separator" }
          : { label: item.label, click: () => actions[item.id]?.() },
      ),
    ),
  );

  // A single left click should bring the window back, as every tray app does.
  tray.on("click", onOpen);
  return tray;
}

module.exports = { createTray };
