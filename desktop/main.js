// Desktop shell: owns the server child for the app's life, restarts it with
// bounded backoff when it dies, and lives in the tray when the window is closed.
//
// Phase 3 rules (docs/decisions.md): closing the window hides it, the server
// keeps running for a grace period and then stops, and Quit from the tray is the
// only way to end the app. Autostart is deliberately not offered yet.

const { app, BrowserWindow, ipcMain, Notification, session, shell } = require("electron");
const { spawn } = require("node:child_process");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { DEFAULT_GRACE_MS, createGrace } = require("./lifecycle.js");
const {
  MAX_ATTEMPTS,
  classifyExit,
  isAppOrigin,
  nextDelay,
  shouldRetry,
} = require("./supervisor.js");
const { createTray } = require("./tray.js");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const serverEntry = path.join(standalone, "server.js");
const errorPage = path.join(__dirname, "error.html");
const preloadScript = path.join(__dirname, "preload.js");

// The standalone server chdirs into its own folder, so the shell states both
// roots explicitly; otherwise the server would resolve migrations and the
// database against the bundle instead of the project.
const appRootDir = process.env.NIYAM_APP_ROOT || root;
const dataDir = process.env.NIYAM_DATA_DIR || path.join(appRootDir, "data");

// NIYAM_GRACE_MS exists so the grace window can be exercised in seconds.
const GRACE_MS = Number(process.env.NIYAM_GRACE_MS) > 0
  ? Number(process.env.NIYAM_GRACE_MS)
  : DEFAULT_GRACE_MS;

const STARTUP_TIMEOUT_MS = 20_000;
const HEALTH_INTERVAL_MS = 5_000;
const HEALTH_TIMEOUT_MS = 2_000;
const HEALTH_FAILURES_BEFORE_RESTART = 3;
const LOG_LIMIT = 8_000;

// Only what this app actually needs, and only from its own loopback origin.
const ALLOWED_PERMISSIONS = new Set(["notifications", "fullscreen"]);

let server = null;
let serverUrl = null;
let serverLog = "";
let attempts = 0;
let starting = false;
let restartTimer = null;
let healthTimer = null;
let healthFailures = 0;
let quitting = false;
let appWindow = null;
let errorWindow = null;
let tray = null;
// True while the user has deliberately put the app in the tray, so a server
// restart never pops the window back open on its own.
let hiddenByUser = false;

const grace = createGrace(GRACE_MS);
let graceTimer = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function serverPort() {
  if (!serverUrl) {
    return null;
  }
  const port = Number(new URL(serverUrl).port);
  return Number.isFinite(port) && port > 0 ? port : null;
}

async function probe(url, timeoutMs) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Waits for a usable server. A 5xx is a real answer, so it fails fast. */
async function waitForReady(url, child) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      return { ok: false, reason: `the server exited with code ${child.exitCode}` };
    }
    const result = await probe(url, 1_500);
    if (result.ok) {
      return { ok: true };
    }
    if (result.status >= 500) {
      return { ok: false, reason: `the server answered HTTP ${result.status}` };
    }
    await sleep(200);
  }
  return { ok: false, reason: `the server did not answer within ${STARTUP_TIMEOUT_MS / 1000}s` };
}

async function stopServer() {
  stopHealthWatch();
  const child = server;
  server = null;
  if (!child || child.exitCode !== null) {
    return;
  }
  child.expectedExit = true;
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    child.once("exit", finish);
    try {
      child.kill();
    } catch {
      finish();
    }
    const guard = setTimeout(() => {
      if (!settled) {
        try {
          child.kill("SIGKILL");
        } catch {
          // already gone
        }
        finish();
      }
    }, 2_000);
    guard.unref?.();
  });
}

function clearRestartTimer() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
}

async function startServer() {
  if (quitting || starting) {
    return;
  }
  starting = true;
  clearRestartTimer();
  try {
    await stopServer();
    if (quitting) {
      return;
    }

    const port = await freePort();
    const url = `http://127.0.0.1:${port}/`;
    serverLog = "";
    serverUrl = url;

    const child = spawn(process.execPath, [serverEntry], {
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
    child.expectedExit = false;
    const collect = (chunk) => {
      if (serverLog.length < LOG_LIMIT) {
        serverLog += chunk;
      }
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("exit", (code, signal) => {
      if (quitting || child.expectedExit || child !== server) {
        return;
      }
      console.log(`server exited early: ${classifyExit(code, signal)} (code ${code}, signal ${signal})`);
      scheduleRestart("the server stopped");
    });
    server = child;

    console.log(`starting the server for ${appRootDir}`);
    const ready = await waitForReady(url, child);
    if (child !== server || quitting) {
      return;
    }
    if (!ready.ok) {
      await stopServer();
      scheduleRestart(ready.reason);
      return;
    }

    attempts = 0;
    healthFailures = 0;
    console.log(`server ready at ${url}`);
    startHealthWatch(url);
    showApp(url);
  } finally {
    starting = false;
  }
}

function scheduleRestart(reason) {
  stopHealthWatch();
  if (quitting) {
    return;
  }
  if (!shouldRetry(attempts, MAX_ATTEMPTS)) {
    showError(reason);
    return;
  }
  const delay = nextDelay(attempts);
  attempts += 1;
  console.log(`restart ${attempts}/${MAX_ATTEMPTS} in ${delay}ms: ${reason}`);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    void startServer();
  }, delay);
}

function startHealthWatch(url) {
  stopHealthWatch();
  healthTimer = setInterval(async () => {
    const result = await probe(url, HEALTH_TIMEOUT_MS);
    if (result.ok) {
      healthFailures = 0;
      return;
    }
    healthFailures += 1;
    console.log(`health check failed (${healthFailures}/${HEALTH_FAILURES_BEFORE_RESTART})`);
    if (healthFailures >= HEALTH_FAILURES_BEFORE_RESTART) {
      healthFailures = 0;
      await stopServer();
      scheduleRestart("the server stopped answering");
    }
  }, HEALTH_INTERVAL_MS);
  healthTimer.unref?.();
}

function stopHealthWatch() {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
}

function closeErrorWindow() {
  if (errorWindow && !errorWindow.isDestroyed()) {
    errorWindow.destroy();
  }
  errorWindow = null;
}

function createAppWindow() {
  appWindow = new BrowserWindow({
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
  const win = appWindow;
  win.on("closed", () => {
    if (appWindow === win) {
      appWindow = null;
    }
  });
  win.once("ready-to-show", () => {
    win.show();
    console.log("window shown");
  });

  // Closing the window is "hide", never "quit" (docs/decisions.md).
  win.on("close", (event) => {
    if (quitting) {
      return;
    }
    event.preventDefault();
    // Destroy on the next tick: the renderer is freed, and the close event has
    // already returned by then.
    setImmediate(hideWindow);
  });

  // Links leave the app; nothing navigates the shell away from its own server.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!target.startsWith(serverUrl ?? "")) {
      shell.openExternal(target);
    }
    return { action: "deny" };
  });

  return win;
}

function showApp(url) {
  hiddenByUser = false;
  // The replacement window has to exist before anything else is destroyed:
  // Electron emits window-all-closed the moment the last window goes.
  if (!appWindow || appWindow.isDestroyed()) {
    createAppWindow();
  }
  closeErrorWindow();
  disarmGrace();
  if (appWindow.isMinimized()) {
    appWindow.restore();
  }
  console.log(`window loading ${url}`);
  void appWindow.loadURL(url);
}

function hideWindow() {
  const win = appWindow;
  if (!win || win.isDestroyed()) {
    return;
  }
  win.destroy();
  appWindow = null;
  hiddenByUser = true;
  console.log("window hidden to tray");
  armGrace();
  showCloseNoticeOnce();
}

function showWindow() {
  disarmGrace();
  if (appWindow && !appWindow.isDestroyed()) {
    if (appWindow.isMinimized()) {
      appWindow.restore();
    }
    appWindow.show();
    appWindow.focus();
    return;
  }
  if (serverUrl && server && server.exitCode === null) {
    showApp(serverUrl);
    return;
  }
  console.log("window requested with no server running; starting it");
  void startServer();
}

function armGrace() {
  if (quitting) {
    return;
  }
  grace.arm(Date.now());
  clearGraceTimer();
  graceTimer = setTimeout(async () => {
    graceTimer = null;
    if (quitting) {
      return;
    }
    if (appWindow && !appWindow.isDestroyed()) {
      return;
    }
    if (!server || server.exitCode !== null) {
      return;
    }
    console.log(`grace expired after ${Math.round(GRACE_MS / 1000)}s: stopping the server`);
    await stopServer();
    console.log("server stopped while hidden");
  }, GRACE_MS);
  console.log(`grace armed: the server stops in ${Math.round(GRACE_MS / 1000)}s if the window stays closed`);
}

function disarmGrace() {
  grace.disarm();
  clearGraceTimer();
}

function clearGraceTimer() {
  if (graceTimer) {
    clearTimeout(graceTimer);
    graceTimer = null;
  }
}

function closeNoticePath() {
  return path.join(app.getPath("userData"), "desktop-state.json");
}

function closeNoticeAlreadyShown() {
  try {
    return JSON.parse(readFileSync(closeNoticePath(), "utf8")).closeNoticeShown === true;
  } catch {
    return false;
  }
}

function showCloseNoticeOnce() {
  if (closeNoticeAlreadyShown()) {
    return;
  }
  try {
    const file = closeNoticePath();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ closeNoticeShown: true }));
  } catch {
    // A notice is a nicety; never let it break the shell.
  }
  if (!Notification.isSupported()) {
    return;
  }
  new Notification({
    title: "Niyam is still running",
    body: "It keeps going in the tray. Choose Quit there to close it.",
  }).show();
  console.log("close notice shown");
}

function createErrorWindow() {
  errorWindow = new BrowserWindow({
    width: 660,
    height: 480,
    minWidth: 420,
    minHeight: 320,
    autoHideMenuBar: true,
    backgroundColor: "#f3e3c3",
    title: "Niyam could not start",
    webPreferences: {
      preload: preloadScript,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const win = errorWindow;
  win.on("closed", () => {
    if (errorWindow === win) {
      errorWindow = null;
    }
  });
  win.webContents.on("did-finish-load", () => {
    console.log(`failure window loaded: ${win.webContents.getURL().slice(0, 240)}`);
  });
  return win;
}

function showError(reason) {
  const detail = serverLog.trim()
    ? `${reason}.\n\n${serverLog.trim().slice(-1_500)}`
    : `${reason}.`;
  console.log(`showing the failure window: ${reason}`);

  // Same ordering rule as showApp: the replacement window exists before the old
  // one is destroyed, so the shell never passes through zero windows.
  if (!errorWindow || errorWindow.isDestroyed()) {
    createErrorWindow();
  }
  if (appWindow && !appWindow.isDestroyed()) {
    appWindow.destroy();
  }
  appWindow = null;

  void errorWindow.loadFile(errorPage, { query: { reason: detail } });
  errorWindow.show();
  errorWindow.focus();
}

function installPermissionHandlers() {
  const ses = session.defaultSession;
  const allowed = (permission, origin) =>
    ALLOWED_PERMISSIONS.has(permission) && isAppOrigin(origin, serverPort());

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details?.requestingUrl ?? webContents?.getURL() ?? "";
    const granted = allowed(permission, origin);
    if (!granted) {
      console.log(`denied permission "${permission}" for ${origin}`);
    }
    callback(granted);
  });

  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    return allowed(permission, requestingOrigin ?? webContents?.getURL() ?? "");
  });
}

ipcMain.on("niyam:retry", () => {
  console.log("retry requested from the failure window");
  attempts = 0;
  serverLog = "";
  clearRestartTimer();
  void startServer();
});

ipcMain.on("niyam:quit", () => {
  app.quit();
});

if (!app.requestSingleInstanceLock()) {
  // A second launch must not start a second server; it only raises the window.
  app.quit();
} else {
  app.on("second-instance", () => {
    console.log("second launch: showing the existing window");
    showWindow();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId("Niyam");
    installPermissionHandlers();
    tray = createTray({ onOpen: showWindow, onQuit: () => app.quit() });
    console.log(`tray created (grace ${Math.round(GRACE_MS / 1000)}s)`);
    if (process.env.NIYAM_DEBUG_TRAY === "1") {
      // Spike hook for desktop/spike/tray-quit.mjs: hands the live tray (and the
      // menu it shows) to the inspector so the real Quit item can be driven.
      globalThis.__niyamTray = tray;
      console.log(`tray icon ${JSON.stringify(tray.iconSize)} empty=${tray.iconEmpty}`);
    }
    void startServer();
  });

  app.on("window-all-closed", () => {
    // The tray keeps the app alive, so this is not a quit. Without a tray there
    // would be no way back, so fall back to quitting.
    if (!tray) {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    quitting = true;
    console.log(`quit requested (grace ${graceTimer ? "armed" : "idle"})`);
    clearRestartTimer();
    if (graceTimer) {
      clearGraceTimer();
      grace.disarm();
      console.log("grace timer cleared");
    }
    stopHealthWatch();
    if (tray) {
      tray.destroy();
      tray = null;
      console.log("tray removed");
    }
    const child = server;
    server = null;
    if (child && child.exitCode === null) {
      child.expectedExit = true;
      try {
        child.kill();
        console.log("server child stopped");
      } catch {
        // already gone
      }
    }
  });
}
