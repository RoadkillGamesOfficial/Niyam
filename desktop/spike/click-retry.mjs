// Clicks the Retry button on the failure window through a real DOM click, so the
// whole path is exercised: error.html -> window.niyam.retry() (preload) ->
// ipcRenderer "niyam:retry" -> main resets attempts -> startServer.
//
// The shell must be launched with a debugging port:
//   cd desktop
//   NIYAM_APP_ROOT=<root> npm start -- --remote-debugging-port=9223
//   node spike/click-retry.mjs 9223
//
// Prints the preload bridge state and the click result, then exits non-zero if
// no failure window was found.

const port = process.argv[2] ?? "9223";

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((entry) => entry.type === "page" && entry.url.includes("error.html"));
if (!target) {
  console.error("no failure window found; open targets:", targets.map((entry) => entry.url));
  process.exit(2);
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
function evaluate(expression) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener("message", onMessage);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result?.result);
    };
    socket.addEventListener("message", onMessage);
    socket.send(
      JSON.stringify({
        id,
        method: "Runtime.evaluate",
        params: { expression, returnByValue: true, awaitPromise: true },
      }),
    );
    setTimeout(() => reject(new Error("evaluate timed out")), 5_000);
  });
}

const bridge = await evaluate("typeof window.niyam + ':' + typeof window.niyam?.retry");
console.log(`preload bridge: ${bridge.value}`);

const before = await evaluate("document.getElementById('retry') !== null");
console.log(`retry button present: ${before.value}`);

// A real DOM click, which is what a user does.
const clicked = await evaluate("document.getElementById('retry').click(); 'clicked'");
console.log(`click result: ${clicked.value}`);

socket.close();
