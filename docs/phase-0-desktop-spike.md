# Phase 0 — desktop shell spike results

Run 2026-11-13 on this laptop (Node v24.21.0, Electron 45.3.2, Next 16.4.5).
Each probe is a script under `desktop/spike/` and is repeatable:

```sh
npm run build
node desktop/spike/check-node.mjs        # 0b
node desktop/spike/check-server.mjs      # 0c + server RSS
SPIKE_NODE=electron node desktop/spike/check-server.mjs   # 0c alternative
node desktop/spike/check-electron.mjs    # 0d
```

## 0a — standalone build

`output: "standalone"` produces `.next/standalone/server.js` and serves the app.

Two findings for later phases:

- `.next/static` is **not** copied into the standalone folder. It has to be
  copied in by the packaging step (`public/` happens to be there, but only for
  the reason below, so it must be copied explicitly too).
- The bundle was **1.8 GB** because the whole project root was traced: the
  audit included `data/`, which holds a 1.8 GB `OllamaSetup.exe` from an earlier
  install. The cause is `process.cwd()` in the data layer and prompts
  (`docs/handoff.md` already records the Turbopack warning). Phase 1's
  `appRoot()` removes the cause, and packaging must never include `data/`.

## 0b — node:sqlite inside Electron's Node

Electron 45.3.2 ships **Node 24.22.2** (modules 150) and `node:sqlite` works
with **no flags**: a table was created, a row inserted and counted.

**Decision: drop the `node.exe` sidecar from the plan.** The shell runs the
server with `process.execPath` and `ELECTRON_RUN_AS_NODE=1`, so there is one
runtime to ship instead of two, and the 80 MB sidecar plus its version drift
are gone.

## 0c — spawn, serve, stop

The standalone server, spawned the way the shell will spawn it:

| Runtime | HTTP | Ready | RSS | Rendered the app | Clean stop |
| --- | --- | --- | --- | --- | --- |
| plain `node` | 200 | 624 ms | 89 MB | yes (45,667 B HTML) | process gone, port freed |
| Electron as Node | 200 | 496 ms | 81 MB | yes (45,667 B HTML) | process gone, port freed |

Cold start is under a second on both, which is what makes the
"stop the server when the window closes" rule feel instant.

## 0d — idle footprint with no window

A windowless Electron app is **one process, 59 MB**, with no renderer and no
GPU process. That is the number the tray has to earn.

Notes:

- 59 MB is inside the **under 60 MB closed** budget, but with no headroom. The
  sample was taken 5 s after launch; a real tray that has opened and closed a
  window may sit slightly higher, because freed renderer memory is not always
  returned to the OS. Phase 3 re-measures this as its acceptance check and the
  honest published figure will be **55–75 MB**, not 59.
- For scale: Discord idles at 200–400 MB, so this design beats the comparison
  it was asked to match.

## What Phase 1 inherits from this

1. `appRoot()` / `dataRoot()` are now load-bearing for **bundle size** as well as
   correctness: until the `process.cwd()` trace is gone, the standalone output
   carries the whole project, including `data/`.
2. The server child is `process.execPath` + `ELECTRON_RUN_AS_NODE=1`; no second
   runtime, no `node.exe` in `extraResources`.
3. Packaging must copy `.next/static` and `public/` explicitly.
4. Idle budget to verify after the tray lands: **55–75 MB** with the window
   closed, ~180–250 MB while open (81 MB server + renderer).

## Not tested here

- A real `BrowserWindow` (phase 2), the tray (phase 3), notifications (phase 4),
  packaging and the installer (phase 5).
- Whether the page renders correctly with `.next/static` missing: the spike only
  asserts HTTP 200 and that the HTML contains the product name.
