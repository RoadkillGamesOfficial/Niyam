// Phase 0d: a shell with no window, to measure what the tray actually costs.
// No BrowserWindow is created, so no renderer or GPU process is started.

const { app } = require("electron");

app.whenReady().then(() => {
  app.setAppUserModelId("Niyam");
  setTimeout(() => {
    console.log(`IDLE_MAIN_RSS_MB ${Math.round(process.memoryUsage().rss / 1048576)}`);
    app.quit();
  }, 6000);
});
