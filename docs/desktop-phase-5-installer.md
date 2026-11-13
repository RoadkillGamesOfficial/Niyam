# Desktop phase 5 — the installer

Status: **implemented and verified on this machine**. The four questions were
answered as recommended, the installer is built from the production bundle, and
the installed build was run, reminded, quit and uninstalled (both ways).

## What the build taught us (the plan was wrong in three places)

1. **`extraResources` flattens.** Mapping the bundle `to: "app"` put `server.js`
at the app root, so the shell looked for `.next/standalone/server.js` and found
nothing. The mapping now mirrors the repo (`app/.next/standalone`), with
`migrations`, `prompts` and `src` beside it.
2. **electron-builder drops `node_modules` from `extraResources`.** The first
installed build died with `Cannot find module 'next'`. `node_modules` is now its
own entry, from the bundle's own folder, which no exclusion pattern matches.
3. **Electron keys `userData` on the package name.** The first run wrote to
`%APPDATA%\niyam-desktop`, not `%APPDATA%\Niyam`; `app.setName("Niyam")` runs
before `getPath` now, so data and the uninstaller agree.

A fourth defect came from the uninstall run itself: removing the app left the
autostart registry value pointing at a deleted exe. `customUnInstall` deletes
`HKCU\...\Run\Niyam` first.

## What was demonstrated

- Silent install (`/S`) put the app in `%LOCALAPPDATA%\Programs\Niyam` with no
elevation; the installer is unsigned and SmartScreen was not bypassed by force.
- The installed exe logged `app root ...\resources\app` and
`data root ...\AppData\Roaming\Niyam`, started the server, showed the window,
created the tray and registered `login item openAtLogin=true`.
- With the window hidden, the installed build posted `Check-in | Still on Ship the
installer?` from the packaged roots and stopped its server after the grace.
- A second launch exited 0, logged `second launch: showing the existing window`
and started no second server.
- Tray Quit logged `reminder loop stopped`, `tray removed`, `server child stopped`
and left zero processes.
- Silent uninstall removed the program folder and the autostart entry and **kept**
`%APPDATA%\Niyam`; the same uninstall with `NIYAM_UNINSTALL_DELETE_DATA=1`
removed the data too.

Not verified: the NSIS wizard pages and the uninstall dialog's buttons were never
clicked by a human. The dialog's Yes branch is the same `RMDir` the environment
flag exercises, so what remains unchecked is the prompt's wording and layout.

## Goal

Niyam becomes an installed Windows app: a per-user installer that needs no admin
prompt, an installed app that runs the same shell and server it runs today, an
uninstaller that asks before it deletes history, and no updater in this version.

## Settled decisions

| Question | Answer |
| --- | --- |
| Installer | **Per-user NSIS**, no elevation, into `%LOCALAPPDATA%\Programs\Niyam` |
| Signing | **Unsigned**, with the SmartScreen warning documented |
| Updates | **None** in this version: a new build is a new installer |
| Paths | App in `%LOCALAPPDATA%\Programs`, data in `%APPDATA%\Niyam` |

Phase 3 already fixed the uninstall rule: **ask** before deleting
`%APPDATA%\Niyam`.

## The one structural problem: what "app root" means when installed

Today `main.js` resolves the app root as the folder above `desktop/`, which is
the repo. Installed, nothing may depend on a repo, and the server must still be a
real file on disk: it is spawned as a child process and `chdir`s into its own
folder, which asar cannot be relied on to survive.

So the packaged layout is:

```
%LOCALAPPDATA%\Programs\Niyam\
  Niyam.exe                        Electron + desktop/* (asar)
  resources\
    app\                           extraResources: the app root
      .next\standalone\            server.js, node_modules, static, public
      migrations\                  schema, read by openDatabase on every start
      prompts\
    app.asar                       desktop/main.js, tray assets, and src\ for the
                                   reminder rules (Electron strips the types)
```

`appRootDir` becomes `app.isPackaged ? path.join(process.resourcesPath, "app") : <repo>`,
and `dataDir` becomes `app.isPackaged ? app.getPath("userData") : <repo>/data`.
`userData` is already `%APPDATA%\Niyam` because that is the product name, which is
exactly the folder the uninstaller asks about — no new path logic beyond those two
lines, and the child keeps receiving `NIYAM_APP_ROOT` / `NIYAM_DATA_DIR`.

**Risk worth naming:** the reminder loop requires `../src/**.ts` from inside the
asar. Electron's Node can read asar and strip types, but this is not proven in a
packaged build yet. If it fails, `src/` moves to `resources\app\src` and the
require prefers that path when packaged. The live check below is what decides.

## Files

| File | Change |
| --- | --- |
| `desktop/package.json` | Add `electron-builder` as a devDependency and `build` config: `appId`, `productName: Niyam`, `directories.output: dist`, `files` (main, preload, tray assets, `error.html`, `src/**/*.ts`), `extraResources` mapping the prepared bundle, `migrations/` and `prompts/` into `resources/app`, `win.target: nsis`, `nsis` options (`oneClick: false`, `perMachine: false`, `allowToChangeInstallationDirectory: true`, `createDesktopShortcut`, `include: installer.nsh`). |
| `desktop/installer.nsh` | `!macro customUnInstall`: a `MessageBox MB_YESNO` asking whether to delete history, and `RMDir /r "$APPDATA\Niyam"` only on yes. Silent uninstall skips the prompt and keeps data. |
| `desktop/prepare.mjs` | Keep copying `.next/static` and `public` into the standalone bundle; add a `--packaged` mode that also verifies the bundle is complete before `electron-builder` runs. |
| `desktop/assets/make-icon.mjs` | New. Writes `desktop/assets/icon.ico` (PNG-in-ICO container, 256/64/32/16) from the same palette as the tray sprout, so the installer and the exe have a real icon and nothing is downloaded. |
| `desktop/main.js` | Packaged-aware `appRootDir` / `dataDir`; log both on start so an installed run says where it thinks it lives. |
| `desktop/package.json` scripts | `dist` = prepare + `electron-builder --win nsis`; keep `start` and `test` untouched. |
| `docs/decisions.md`, `README.md` | How to install, the SmartScreen warning, where data lives, what uninstall asks. |

## Behaviour, case by case

1. Fresh install, no admin prompt → Start Menu entry, app launches from the installer's last page.
2. First run on a clean machine → `%APPDATA%\Niyam\discipline.db` is created, migrations run against `resources\app\migrations`, window shows today.
3. Reminders installed → the loop loads `src` from the asar (or the fallback path), notifications still work with the window hidden.
4. Start with Windows → `setLoginItemSettings` registers the installed exe; verified through `getLoginItemSettings().openAtLogin`.
5. Upgrade in place → a second installer run keeps `%APPDATA%\Niyam` untouched.
6. Uninstall, "keep my history" → program files and shortcuts go, `%APPDATA%\Niyam` stays.
7. Uninstall, "delete my history" → `%APPDATA%\Niyam` goes with it.
8. Silent uninstall (`/S`) → no prompt, data kept, nothing left in Program Files.
9. Browser version untouched → `npm run dev`, `npm test`, `npm run build` behave exactly as before.

## Verification

- Unit: unchanged suites stay green (`npm test` 171, `npm run test:desktop` 20).
- Build: `npm run dist` in `desktop/` produces `desktop/dist/Niyam Setup 0.1.0.exe`; inspect size and that the archive contains `resources/app/.next/standalone/server.js`, `migrations`, `prompts`, and the asar entries.
- Installed run on this machine: silent install (`/S`), then launch the installed exe with a **temporary** `NIYAM_DATA_DIR` so no real history is touched, and check the log for the packaged roots, server ready, window shown, tray created, reminder loop started, and `login item openAtLogin=true`.
- Uninstall: silent uninstall, confirm the program folder and shortcuts are gone and `%APPDATA%\Niyam` is untouched, then remove any test data by hand.
- Not automatable, so reported as unverified: the NSIS wizard's pages and the uninstall dialog's buttons; those are inspected in the script and listed as manual checks.

## Expected commits

1. `feat(desktop): resolve the app and data roots when packaged` — `main.js`, packaged logging.
2. `build(desktop): package a per-user NSIS installer` — `package.json` build config, `prepare.mjs`, `installer.nsh`, `make-icon.mjs`, `icon.ico`.
3. `docs: how to install Niyam` — decisions, README.
