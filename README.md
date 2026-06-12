# preppy-v2

A touch-first food service kiosk application built on Electron + React. Designed to run on Windows tablets, Raspberry Pi, or any embedded Linux device with a 7–10" touchscreen. Manages label printing, temperature monitoring, prep lists, and WiFi configuration — all from a clean, tap-friendly interface optimized for kitchen use.

---

## Features

| Page | Description |
|---|---|
| **Print Labels** | Select a ZPL template (IX/OX/UX) and a time preset (4 HR → 30 DAY). Live label preview updates as you choose. Prints to a Zebra-compatible thermal printer or writes `.zpl` files in simulate mode. |
| **Print Custom** | Enter an exact duration via numpad and print any quantity. |
| **Temperatures** | Real-time dashboard of all connected BLE/file-based temperature sensors. Color-coded danger/warning/normal zones. Tap any sensor for a 100-point history chart. |
| **Prep List (Tally)** | Shift-timed prep checklist. Tap items to add to cart, adjust quantities, and print a prep sheet. |
| **WiFi** | Scan for nearby networks, tap to select, enter password via on-screen keyboard. Writes directly to `wpa_supplicant.conf`. |
| **Reports** | Multi-tab analytics dashboard: summary stats, print analytics (by template/preset/hour), temperature stats (min/max/avg per sensor, out-of-range events), raw print history, temperature charts, and system logs. |
| **Debug** | System info, hardware path checks, database row counts, config viewer, Redux state inspector, raw ZPL sender. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | [Electron 32](https://www.electronjs.org/) |
| UI | React 18 + TypeScript 5 |
| Bundler | Vite 5 + `vite-plugin-electron` |
| State | Redux Toolkit |
| Database | `better-sqlite3` (WAL mode, single-file SQLite) |
| Charts | Chart.js 4 + react-chartjs-2 |
| Logging | `electron-log` with daily rotation |
| Testing | Vitest 2 + Testing Library |

---

## Architecture

```
src/
├── main/                        # Electron main process (Node.js)
│   ├── index.ts                 # App bootstrap, GPU flags, IPC registration
│   ├── logger.ts                # electron-log wrapper
│   ├── ipc/
│   │   ├── channels.ts          # All IPC channel name constants
│   │   └── handlers/            # One handler file per domain
│   │       ├── db.handler.ts
│   │       ├── debug.handler.ts
│   │       ├── printer.handler.ts
│   │       ├── sensor.handler.ts
│   │       └── wifi.handler.ts
│   └── services/                # Pure business logic — no IPC or Electron UI here
│       ├── config.service.ts    # Loads config.json, exposes resourcePath()
│       ├── db.service.ts        # SQLite schema + all CRUD functions
│       ├── mock-sensor.service.ts # Simulated sensor for dev/no-hardware
│       ├── printer.service.ts   # ZPL template fill, print, simulate
│       ├── sensor.service.ts    # Polls /templogs, falls back to mock
│       └── wifi.service.ts      # nmcli scan, wpa_supplicant write
│
├── preload/
│   └── index.ts                 # contextBridge — typed API surface for renderer
│
└── renderer/                    # React app (no Node/Electron access)
    ├── App.tsx                  # Router
    ├── components/              # Shared components
    │   ├── AutoDismissAlert.tsx # Success auto-dismiss, errors require tap
    │   ├── Clock.tsx            # Live date/time bar
    │   ├── DebugButton.tsx      # Fixed debug entry point
    │   ├── LabelPreview.tsx     # Client-side live label mock (no IPC)
    │   ├── PageLayout.tsx       # Full-height shell with header + sticky footer
    │   └── PrintPreview.tsx     # Full ZPL viewer + substitution table
    ├── hooks/
    │   ├── useErrorMsg.ts       # Verbose vs. friendly error messages
    │   └── useIpc.ts
    ├── pages/                   # One directory per route
    │   ├── Home/
    │   ├── Preppy/              # Print Labels
    │   ├── PrintX/              # Custom duration
    │   ├── Reports/
    │   ├── Tally/
    │   ├── Tempy/               # Temperature monitor
    │   ├── WiFi/
    │   └── Debug/
    └── store/                   # Redux slices
        └── slices/
            ├── alerts.slice.ts
            ├── devSettings.slice.ts  # verboseErrors toggle
            └── sensors.slice.ts
```

---

## IPC Channels

All renderer↔main communication goes through the typed bridge in `src/preload/index.ts`. The full channel list is in `src/main/ipc/channels.ts`:

| Channel | Direction | Description |
|---|---|---|
| `printer:print` | invoke | Print N labels from a template + duration |
| `printer:preview` | invoke | Return filled ZPL + field values without printing |
| `printer:history` | invoke | Return last N print jobs |
| `sensor:list` | invoke | Return current sensor state for all sensors |
| `sensor:update` | push | Real-time sensor reading broadcast |
| `wifi:save` | invoke | Validate, write supplicant.conf, reconfigure |
| `wifi:get` | invoke | Return last saved SSID (no password) |
| `wifi:scan` | invoke | Run `nmcli` scan, return sorted network list |
| `config:get` | invoke | Return full merged config |
| `logs:tail` | push | Stream log lines to renderer |
| `report:prints` | invoke | Return print job history |
| `report:temps` | invoke | Return temperature log (optionally filtered by MAC) |
| `debug:info` | invoke | Return system info, hardware checks, DB stats |
| `debug:send-zpl` | invoke | Send raw ZPL string directly to printer |

---

## Configuration

The app reads `resources/config.json` at startup and deep-merges it with `{userData}/config.local.json` if present. Override any key in `config.local.json` without editing the shipped defaults.

```json
{
  "printer": {
    "device": "/dev/usb/lp0",
    "zplTemplateDir": "resources/zpl",
    "simulate": false
  },
  "temperature": {
    "dangerLow": 31,
    "dangerHigh": 41,
    "warningLow": 37,
    "units": "F"
  },
  "sensor": {
    "pollIntervalMs": 10000,
    "logDir": "/templogs"
  },
  "wifi": {
    "interface": "wlan0",
    "supplicantPath": "/etc/wpa_supplicant/wpa_supplicant.conf"
  },
  "logging": {
    "retentionDays": 30,
    "maxFileSizeMb": 10
  }
}
```

**Simulate mode** activates automatically when `printer.device` doesn't exist (e.g. in development). Labels are written as `.zpl` files to `simulated-labels/` in the project root.

**Mock sensor** activates automatically when `sensor.logDir` doesn't exist. Two virtual sensors with realistic fridge-range temperatures (33–41°F) emit live updates via IPC.

---

## ZPL Templates

Templates live in `resources/zpl/` with `{{PLACEHOLDER}}` substitution:

| Placeholder | Value |
|---|---|
| `{{DATE}}` | Print date (`MM/DD/YY`) |
| `{{TIME}}` | Print time (`hh:mm A`) |
| `{{EXPIRY_DATE}}` | Expiry date (`MM/DD/YY`) |
| `{{EXPIRY_TIME}}` | Expiry time (`hh:mm A`) |
| `{{DURATION}}` | Duration in hours |

Three templates ship by default:
- **IX** — Internal Use
- **OX** — Opened/Expiry
- **UX** — Use First

---

## Deployment

### Windows Tablets

Run both scripts from an **Administrator** PowerShell session. The kiosk configuration script must come first and requires a restart before Preppy is installed.

**Step 1 — Harden the OS** (disables auto-restart on Windows Update, prevents sleep/hibernate, disables screensaver and lock screen, disables fast startup):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\configure-windows-kiosk.ps1
```

To also disable automatic update downloads entirely (recommended if updates have caused printer issues):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\configure-windows-kiosk.ps1 -DisableUpdates
```

To configure passwordless auto-login so the tablet boots straight into Preppy:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\configure-windows-kiosk.ps1 `
    -AutoLogin -AutoLoginUser "Kiosk" -AutoLoginPassword "yourpassword"
```

The script will prompt to restart. **Restart before continuing.**

**Step 2 — Install Preppy** (downloads the latest release from GitHub, installs to `%LOCALAPPDATA%\Preppy`, registers a Task Scheduler autostart task that launches in kiosk mode at every login):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

For a private repository, pass your GitHub token:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1 -GitHubToken "ghp_..."
```

After the next login, Preppy starts automatically in fullscreen kiosk mode.

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
- Printer writes to `/dev/usb/lp0` — requires user in `lp` group
- Sensor logs expected at `/templogs/*.log` (tab-delimited: `mac\ttime\ttemp\thumidity\tbattery`)

---

## Testing

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

**61 tests** across 8 test files:

| Suite | Coverage |
|---|---|
| `config.service` | `deepMerge` — scalar, nested, mutation safety |
| `wifi.service` | SSID/password regex validation |
| `printer.service` | Template fill, expiry math, simulate mode, file errors |
| `db.service` | WAL init, all CRUD functions |
| `mock-sensor.service` | Tick behavior, range clamping, IPC emission, timer cleanup |
| `LabelPreview` | All 3 templates, date math, duration text |
| `AutoDismissAlert` | Auto-dismiss timing, manual close, custom delay |
| `useErrorMsg` | Verbose vs. friendly mode, fallback, non-Error types |

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
