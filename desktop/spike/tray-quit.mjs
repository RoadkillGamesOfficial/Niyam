// Drives the tray menu's Quit item exactly as Electron does when a user picks
// it: the real MenuItem inside the real menu that the running Tray shows, called
// with Electron's (menuItem, browserWindow, event) signature.
//
//   NIYAM_DEBUG_TRAY=1 npx electron --inspect=9229 .    (in desktop/)
//   node spike/tray-quit.mjs 9229
//
// The hook hands the live tray to the inspector; nothing here rebuilds a menu.
import { setTimeout as delay } from "node:timers/promises";

const port = process.argv[2] ?? "9229";
const base = `http://127.0.0.1:${port}`;

if (typeof WebSocket === "undefined") {
  throw new Error(`this harness needs a Node with global WebSocket (running ${process.version})`);
}

async function findMainTarget() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/json/list`);
      const targets = await response.json();
      const target = targets.find((entry) => entry.type === "node" && entry.webSocketDebuggerUrl);
      if (target) {
        return target;
      }
    } catch {
      // the inspector is not listening yet
    }
    await delay(200);
  }
  throw new Error(`no inspector target answered at ${base}`);
}

const target = await findMainTarget();
console.log(`inspector target: ${target.title || target.id}`);

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = () => reject(new Error("could not attach to the main process"));
});

let nextId = 1;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  const settle = pending.get(message.id);
  if (settle) {
    pending.delete(message.id);
    settle(message);
  }
};

/** Resolves with the evaluation, or null when the process exits mid-call. */
function evaluate(expression, timeoutMs = 3_000) {
  const id = nextId++;
  const reply = new Promise((resolve) => pending.set(id, resolve));
  socket.send(
    JSON.stringify({
      id,
      method: "Runtime.evaluate",
      params: { expression, returnByValue: true, awaitPromise: true },
    }),
  );
  return Promise.race([reply, delay(timeoutMs).then(() => null)]);
}

function valueOf(message) {
  if (!message) {
    return null;
  }
  const result = message.result?.result;
  if (message.result?.exceptionDetails) {
    return { error: message.result.exceptionDetails.text };
  }
  return result?.value ?? result?.description ?? null;
}

const inspected = valueOf(
  await evaluate(`(() => {
    const shell = globalThis.__niyamTray;
    if (!shell) return { ok: false, error: "no tray hook; launch with NIYAM_DEBUG_TRAY=1" };
    return {
      ok: true,
      items: shell.menu.items.map((item) => (item.type === "separator" ? "-" : [item.id, item.label])),
      icon: shell.iconSize,
      iconEmpty: shell.iconEmpty,
    };
  })()`),
);
console.log(`live menu: ${JSON.stringify(inspected)}`);

const clicked = valueOf(
  await evaluate(`(() => {
    const shell = globalThis.__niyamTray;
    const item = shell.menu.getMenuItemById("quit");
    if (!item) return { ok: false, error: "the live menu has no Quit item" };
    item.click(item, undefined, {});
    return { ok: true, clicked: item.label };
  })()`),
);
console.log(
  clicked
    ? `click result: ${JSON.stringify(clicked)}`
    : "click result: no reply, the process exited during the click (expected)",
);
socket.close();
