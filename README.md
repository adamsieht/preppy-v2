# Preppy v2

A touch-first food service kiosk application built on Electron + React. Designed to run on Windows tablets, Raspberry Pi, or any embedded Linux device with a 7–10" touchscreen. Prints food prep and expiry labels to Zebra thermal printers, manages quick-access item lists, and keeps itself up to date — all from a clean, tap-friendly interface built for kitchen use.

---

## Features

### Print Labels
Select a ZPL label template and a time preset — 4 HR through 30 DAY. A live preview renders immediately. Tap print, choose a quantity, and it goes straight to the printer. Presets are fully customizable: add, remove, and drag to reorder. Templates ship as IX (In Use), OX (Opened/Prepped), and UX (Unopened).

### Custom Labels
Enter any hour duration manually via a large numpad, pick a quantity and template, and print. Useful for edge cases or items that don't fit a standard preset.

### Quick Items
A panel of pre-configured items, each with its own duration and template. Tap an item to print it immediately, or bundle multiple items into a single print run. Items are grouped into categories and support per-template hour overrides.

### Label Date Calculation
Configurable expiry logic to match how your kitchen counts shelf life. Day-first counting mode subtracts 24 h so a "2 day" label prints for tomorrow rather than the day after. Includes a cutoff time (default 11 PM) after which labels revert to standard calculation, minute rounding for same-day labels (5 / 10 / 15 / 30 min), and an option to automatically substitute the static EOD label when a same-day expiry would cross midnight.

### Settings
Unified settings hub with tabs for:
- **Printer** — device selection, test print, simulate mode
- **Labels** — categories, custom presets, date calculation behavior
- **Network** — WiFi scanning and credential management
- **Date & Time** — NTP sync and manual time set
- **Updates** — automatic update status, check now, restart & update now

### Automatic Updates
New releases are detected, downloaded in the background, and installed silently on the next app restart (via `electron-updater` + GitHub Releases). Settings → Updates shows live status with a progress bar and an immediate "Restart & Update Now" option.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | [Electron 32](https://www.electronjs.org/) |
| UI | React 18 + TypeScript 5 |
| Bundler | Vite 5 + `vite-plugin-electron` |
| State | Redux Toolkit |
| Database | `better-sqlite3` (WAL mode, single-file SQLite) |
| Date logic | Day.js |
| Testing | Vitest 2 + Testing Library |

---

## Architecture

```
src/
├── main/                        # Electron main process (Node.js)
│   ├── index.ts                 # App bootstrap, kiosk flag, IPC registration
│   ├── logger.ts                # electron-log wrapper
│   ├── ipc/
│   │   ├── channels.ts          # All IPC channel name constants
│   │   └── handlers/            # One file per domain
│   │       ├── db.handler.ts
│   │       ├── debug.handler.ts
│   │       ├── printer.handler.ts
│   │       ├── printer-setup.handler.ts
│   │       ├── sensor.handler.ts
│   │       ├── system.handler.ts
│   │       ├── updater.handler.ts
│   │       └── wifi.handler.ts
│   └── services/
│       ├── config.service.ts    # Loads config.json, exposes resourcePath()
│       ├── db.service.ts        # SQLite schema + all CRUD functions
│       ├── printer.service.ts   # ZPL template fill, print, simulate mode
│       ├── sensor.service.ts    # Polls /templogs, falls back to mock
│       ├── updater.service.ts   # GitHub Releases check, download, apply
│       └── wifi.service.ts      # nmcli scan, wpa_supplicant write
│
├── preload/
│   └── index.ts                 # contextBridge — typed API surface for renderer
│
└── renderer/                    # React app (no Node/Electron access)
    ├── App.tsx                  # Router
    ├── components/              # Shared components (Clock, LabelPreview, etc.)
    ├── pages/
    │   ├── Preppy/              # Main label printing page
    │   │   ├── labelDateCalc.ts # Expiry calculation logic + settings
    │   │   ├── labelZpl.ts      # ZPL generation + preview helpers
    │   │   └── staticPresets.ts # Built-in and user-defined time presets
    │   ├── PrintX/              # Custom duration printing
    │   ├── Settings/
    │   │   └── tabs/            # GeneralTab, PrinterTab, LabelsTab, NetworkTab,
    │   │                        # DateTimeTab, UpdatesTab
    │   ├── Reports/             # Print history and analytics
    │   └── Debug/               # System info, DB stats, raw ZPL sender
    └── store/                   # Redux slices
```

---

## IPC Channels

All renderer↔main communication goes through the typed bridge in `src/preload/index.ts`. Channel constants are in `src/main/ipc/channels.ts`.

| Channel | Description |
|---|---|
| `printer:print` | Print N labels from a template + resolved expiry |
| `printer:preview` | Return filled ZPL without printing |
| `printer:scan` | Discover connected USB printers |
| `printer:set-device` | Set the active printer device path |
| `printer:test` | Send a test print |
| `printer:history` | Return last N print jobs |
| `sensor:list` | Return current readings for all sensors |
| `sensor:update` | Push — real-time sensor reading broadcast |
| `wifi:scan` | Run `nmcli` scan, return sorted network list |
| `wifi:save` | Write credentials to `wpa_supplicant.conf` |
| `wifi:get` | Return last saved SSID |
| `system:set-time` | Set system clock |
| `system:enable-ntp` | Enable/disable NTP sync |
| `update:check` | Trigger an update check (auto-download follows) |
| `update:get-state` | Return the full updater state snapshot |
| `update:state` | Push — updater state on every transition |
| `update:install` | Quit and install the downloaded update now |
| `setup:get-state` | Should the first-run setup wizard be shown? |
| `setup:run` | Run the elevated kiosk-hardening script |
| `setup:complete` / `setup:reset` | Mark wizard done / show it again |
| `app:version` | Return the running app version |
| `debug:info` | Return system info, hardware checks, DB stats |
| `debug:send-zpl` | Send raw ZPL string directly to printer |

---

## Configuration

The app reads `resources/config.json` at startup and deep-merges it with `{userData}/config.local.json` if present. Override any key in `config.local.json` without touching the shipped defaults.

```json
{
  "printer": {
    "device": "/dev/usb/lp0",
    "zplTemplateDir": "resources/zpl",
    "simulate": false
  },
  "sensor": {
    "pollIntervalMs": 10000,
    "logDir": "/templogs"
  },
  "wifi": {
    "interface": "wlan0",
    "supplicantPath": "/etc/wpa_supplicant/wpa_supplicant.conf"
  }
}
```

**Simulate mode** activates automatically when `printer.device` doesn't exist (e.g. in development). Labels are written as `.zpl` files to `simulated-labels/` in the project root instead of sent to the printer.

---

## ZPL Templates

Templates live in `resources/zpl/` and use `{{PLACEHOLDER}}` substitution:

| Placeholder | Value |
|---|---|
| `{{DATE}}` | Print date (`MM/DD/YY`) |
| `{{TIME}}` | Print time (`hh:mm A`) |
| `{{EXPIRY_DATE}}` | Expiry date (`MM/DD/YY`) |
| `{{EXPIRY_TIME}}` | Expiry time (`hh:mm A`) |
| `{{DURATION}}` | Duration label text |

Three templates ship by default: **IX** (In Use), **OX** (Opened/Prepped), **UX** (Unopened).

---

## Deployment

### Windows Tablets

**Step 1 — Install.** Download `Preppy-Setup-<version>.exe` from the [latest release](https://github.com/adamsieht/preppy-v2/releases/latest) and double-click it. It's a one-click per-user installer (no admin prompt) that installs Preppy, creates Start Menu/desktop shortcuts, and launches the app when done.

**Step 2 — First-run setup wizard.** On first launch Preppy shows an in-app setup wizard for kiosk tablets. It configures Windows Update to never auto-restart (or disables updates), disables sleep/lock screen/screensaver, optionally sets up auto-login, registers Preppy to start at login, and installs the printer driver — all through a single UAC prompt. Skippable on non-kiosk machines, and re-runnable any time from **Settings → Updates → Re-run Setup Wizard**.

**Step 3 — Connect the Zebra printer and open Preppy → Settings → Printer.** The app auto-detects the printer, creates a "Zebra ZPL" print queue using Windows' built-in Generic Text Only driver, and selects it. No Zebra drivers needed, no manual configuration.

**To uninstall:** use *Add or remove programs* → Preppy (or `%LOCALAPPDATA%\Programs\Preppy\Uninstall Preppy.exe`).

---

### Linux (Raspberry Pi / Debian / Ubuntu)

Run the installer as your normal user (no `sudo` required). It detects architecture automatically (`x86_64` → x64, `aarch64` → arm64), downloads the matching AppImage from GitHub Releases, and creates a `~/.config/autostart/preppy.desktop` entry so Preppy starts in kiosk mode on login.

```bash
bash scripts/install-linux.sh
```

For a private repository:

```bash
bash scripts/install-linux.sh --token=ghp_...
```

To install without kiosk mode (normal windowed):

```bash
bash scripts/install-linux.sh --no-kiosk
```

**To uninstall:**

```bash
rm ~/.config/autostart/preppy.desktop
rm -rf ~/.local/share/preppy
```

---

### Auto-Updates

Updates are fully automatic (powered by `electron-updater`): the app checks GitHub Releases on launch and every 4 hours, downloads new versions in the background, and installs them silently the next time the app quits or restarts. **Settings → Updates** shows the current status and offers *Check Now* and *Restart & Update Now*. Works on Windows (NSIS) and Linux (AppImage).

---

## Development Setup

**Prerequisites:** Node.js 20+, npm 10+

```bash
git clone https://github.com/adamsieht/preppy-v2.git
cd preppy-v2
npm install          # also runs electron-rebuild for better-sqlite3
npm run dev          # starts Electron with hot reload
```

> On first install, `postinstall` automatically runs `@electron/rebuild` to compile `better-sqlite3` against Electron's Node ABI. This is required — do not skip.

**Linux / Raspberry Pi only:**
- WiFi scanning requires `nmcli` (`network-manager` package)
- Printer writes to `/dev/usb/lp0` — requires user in the `lp` group
- Sensor logs expected at `/templogs/*.log` (tab-delimited: `mac\ttime\ttemp\thumidity\tbattery`)

---

## Testing

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

---

## Building

```bash
npm run build                 # TypeScript compile + Vite bundle only
npm run package:win           # Windows NSIS installer → release/
npm run package:linux         # Linux AppImage x64     → release/
npm run package:linux:arm64   # Linux AppImage arm64   → release/
```

Pushing a `v*` tag triggers the GitHub Actions workflows in `.github/workflows/` which build all platforms and attach the artifacts to a GitHub Release automatically.

---

## License

MIT
