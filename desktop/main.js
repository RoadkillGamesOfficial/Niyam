// First slice of the desktop shell: start the standalone server, then show it
// in a window. The tray, the grace-period shutdown and the background check-in
// arrive in phases 3 and 4; for now closing the window quits the app.

const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const serverEntry = path.join(standalone, "server.js");

// The standalone server chdirs into its own folder, so the shell states both
// roots explicitly; otherwise the server would resolve migrations and the
// database against the bundle instead of the project.
const appRootDir = process.env.NIYAM_APP_ROOT || root;
const dataDir = process.env.NIYAM_DATA_DIR || path.join(appRootDir, "data");

let server = null;
let log = "";

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server && server.exitCode !== null) return false;
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

async function start() {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;

  server = spawn(process.execPath, [serverEntry], {
    cwd: standalone,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NIYAM_APP_ROOT: appRootDir,
      NIYAM_DATA_DIR: dataDir,
      ...(process.env.NIYAM_DB ? { NIYAM_DB: process.env.NIYAM_DB } : {}),
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => (log += chunk));
  server.stderr.on("data", (chunk) => (log += chunk));

  if (!(await waitForServer(url))) {
    dialog.showErrorBox("Niyam could not start", log.trim().slice(-1200) || "No output from the server.");
    app.quit();
    return;
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 375,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f3e3c3",
    title: "Niyam",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once("ready-to-show", () => {
    win.show();
    console.log(`window open at ${url}`);
  });

  // Links leave the app; nothing navigates the shell away from its own server.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!target.startsWith(url)) require("electron").shell.openExternal(target);
    return { action: "deny" };
  });

  await win.loadURL(url);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(start);

  // Phase 3 replaces this with hide-to-tray.
  app.on("window-all-closed", () => app.quit());

  app.on("before-quit", () => {
    if (server && server.exitCode === null) server.kill();
  });
}
