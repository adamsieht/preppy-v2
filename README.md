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
- **Updates** — check for, download, and install app updates

### In-App Updates
Check for new releases from GitHub, download in the background with a live progress bar, and install on next quit. The app swaps itself out automatically — no reinstall or USB drive needed. Update source is configurable for private repositories.

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
| `update:check` | Query GitHub Releases for a newer version |
| `update:download` | Stream download of the update file |
| `update:progress` | Push — download progress events |
| `update:apply` | Write swap script and quit to apply update |
| `update:get-settings` | Return saved update source settings |
| `update:save-settings` | Persist update source settings |
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

#### Option A — Graphical wizard (recommended for end users)

Download `Install Preppy.bat` and `install-wizard.ps1` from the [latest release](https://github.com/adamsieht/preppy-v2/releases/latest), place them in the same folder, and double-click **`Install Preppy.bat`**. It handles UAC elevation automatically, shows a step-by-step wizard to collect options (auto-login, update policy, GitHub token), downloads Preppy, hardens Windows, and registers the boot autostart — no terminal access required.

#### Option B — Command line

Run from an **Administrator** PowerShell session. Note: if you see "running scripts is disabled on this system", use `powershell -ExecutionPolicy Bypass -File ...` rather than running the `.ps1` directly.

**Step 1 — Install Preppy** (OS hardening + download + autostart in one command):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

Common options:

```powershell
# Disable automatic Windows Update downloads (recommended if updates have caused printer issues):
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1 -DisableUpdates

# Auto-login so the tablet boots straight into Preppy without a password prompt:
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1 `
    -AutoLogin -AutoLoginUser "Kiosk" -AutoLoginPassword "yourpassword"

# Private GitHub repository:
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1 -GitHubToken "ghp_..."
```

---

**After either method:** Preppy starts automatically in fullscreen kiosk mode after the next login.

**Step 2 — Connect the Zebra printer and open Preppy → Settings → Printer.** The app auto-detects the printer, creates a "Zebra ZPL" print queue using Windows' built-in Generic Text Only driver, and selects it. No Zebra drivers needed, no manual configuration.

> **Re-applying OS hardening** (e.g. after a Windows feature update resets policies) without reinstalling Preppy:
> ```powershell
> powershell -ExecutionPolicy Bypass -File scripts\configure-windows-kiosk.ps1
> ```

**To uninstall:**

```powershell
Unregister-ScheduledTask -TaskName 'Preppy' -Confirm:$false
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Preppy"
```

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

### In-App Updates

Once installed, open **Settings → Updates** to check for new releases, download, and apply them. The app swaps itself out on next quit — no reinstall needed.

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
npm run package:win           # Windows portable .exe  → release/
npm run package:linux         # Linux AppImage x64     → release/
npm run package:linux:arm64   # Linux AppImage arm64   → release/
```

Pushing a `v*` tag triggers the GitHub Actions workflows in `.github/workflows/` which build all platforms and attach the artifacts to a GitHub Release automatically.

---

## License

MIT
