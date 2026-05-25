# Preppy-React Migration Plan

## Overview

Preppy-React is an Electron 8 + React 16 + Redux desktop application for food service operations:
label printing (Zebra USB printer via ZPL), temperature sensor monitoring, and prep-list tracking.

This plan migrates it to a modern, flexible architecture with structured logging and a reporting layer.

---

## Problems Being Solved

| Problem | Impact |
|---|---|
| Filesystem + shell I/O inside React components | Fragile, untestable, hard to reason about |
| Multiple independent lowdb instances | Race conditions, stale reads |
| Shell commands built by string concatenation | Security vulnerability |
| No structured logging | Zero operational visibility |
| Hardcoded thresholds/paths | Cannot change behavior without code change |
| `console.log` scattered everywhere | Noise in production, no log levels |
| Electron 8, React 16, Webpack 4 | EOL toolchain — no security patches |

---

## Target Architecture

```
preppy-v2/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Entry point, BrowserWindow creation
│   │   ├── menu.ts              # App menu
│   │   ├── ipc/
│   │   │   ├── channels.ts      # All IPC channel name constants
│   │   │   └── handlers/
│   │   │       ├── printer.handler.ts
│   │   │       ├── sensor.handler.ts
│   │   │       ├── wifi.handler.ts
│   │   │       └── db.handler.ts
│   │   └── services/
│   │       ├── db.service.ts    # Singleton better-sqlite3 wrapper
│   │       ├── printer.service.ts
│   │       ├── sensor.service.ts
│   │       ├── wifi.service.ts
│   │       └── config.service.ts
│   ├── preload/
│   │   └── index.ts             # contextBridge typed API surface
│   └── renderer/                # React app
│       ├── index.tsx
│       ├── App.tsx
│       ├── routes.tsx
│       ├── store/
│       │   ├── index.ts
│       │   └── slices/
│       │       ├── alerts.slice.ts
│       │       └── sensors.slice.ts
│       ├── components/
│       │   ├── ErrorBoundary.tsx
│       │   ├── Clock.tsx
│       │   ├── Label.tsx
│       │   ├── NumPad.tsx
│       │   └── Keyboard.tsx
│       ├── pages/
│       │   ├── Home/
│       │   ├── Preppy/          # Label printing
│       │   ├── PrintX/          # Custom label printing
│       │   ├── Tempy/           # Temperature monitoring
│       │   ├── Tally/           # Prep list
│       │   ├── WiFi/            # WiFi config
│       │   └── Reports/         # NEW: print history, temp trends, log viewer
│       └── hooks/
│           ├── useIpc.ts
│           └── useConfig.ts
├── resources/
│   ├── config.json              # Operator-configurable defaults
│   └── zpl/                    # ZPL label templates
├── logger.ts                    # Shared electron-log configuration
├── vite.config.ts               # Replaces 5 webpack configs
├── tsconfig.json
├── package.json
└── MIGRATION_PLAN.md
```

---

## Phase 1 — Dependency Modernization

**Goal:** Upgrade the toolchain. No behavior changes.

- Electron 8 → 32
- React 16 → 18 (concurrent rendering)
- TypeScript 3.9 → 5.x
- Webpack 4 → Vite + `vite-plugin-electron`
- Redux → Redux Toolkit 2.x
- `lowdb` → `better-sqlite3` (atomic writes, transactions, no race conditions)
- Add `zod` for runtime schema validation at IPC boundaries
- Add `electron-log` structured transport

**Files:** `package.json`, remove all webpack configs, add `vite.config.ts`, `tsconfig.json`.

---

## Phase 2 — Service Layer

**Goal:** All I/O and hardware interaction move into `src/main/services/`. Components become pure UI.

### `db.service.ts`
- Singleton `better-sqlite3` connection
- Typed methods: `getSensors()`, `insertLog()`, `getAlerts()`, `getPrintJobs()`, etc.
- All writes in transactions

### `printer.service.ts`
- Reads ZPL templates from `resources/zpl/`
- Injects date/time values (no string concatenation of user input)
- Writes to printer device via `fs.writeFileSync` (not `exec`)
- Records each job to `print_jobs` table

### `sensor.service.ts`
- `setInterval` polling of `/templogs` directory
- Parses tab-delimited files (mac, time, temp, humidity, battery)
- Persists to SQLite via `db.service`
- Emits IPC events to renderer on new data

### `wifi.service.ts`
- Validates SSID/password (rejects shell metacharacters via allowlist regex)
- Reads/writes wpa_supplicant.conf via `fs` (not shell)
- Calls `execFile('wpa_cli', ['-i', 'wlan0', 'reconfigure'])` (no injection risk)

### `config.service.ts`
- Deep-merges `resources/config.json` (shipped defaults) with `userData/config.local.json` (operator overrides)
- Typed `getConfig()` singleton

---

## Phase 3 — IPC Bridge

**Goal:** Enforce context isolation. No `require('fs')` or `require('child_process')` in renderer.

### `src/main/ipc/channels.ts`
```typescript
export const IPC = {
  PRINT: 'printer:print',
  SENSOR_UPDATE: 'sensor:update',
  SENSOR_LIST: 'sensor:list',
  WIFI_SAVE: 'wifi:save',
  WIFI_STATUS: 'wifi:status',
  CONFIG_GET: 'config:get',
  LOGS_TAIL: 'logs:tail',
  REPORT_PRINTS: 'report:prints',
  REPORT_TEMPS: 'report:temps',
} as const
```

### `src/preload/index.ts`
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  print: (args) => ipcRenderer.invoke(IPC.PRINT, args),
  onSensorUpdate: (cb) => ipcRenderer.on(IPC.SENSOR_UPDATE, (_, data) => cb(data)),
  saveWifi: (args) => ipcRenderer.invoke(IPC.WIFI_SAVE, args),
  getConfig: () => ipcRenderer.invoke(IPC.CONFIG_GET),
  tailLogs: (cb) => ipcRenderer.on(IPC.LOGS_TAIL, (_, line) => cb(line)),
  // ...
})
```

All payloads validated with Zod schemas in handlers before reaching services.

---

## Phase 4 — Structured Logging

**Goal:** Replace all `console.log` with leveled, rotating log files. No sensitive values logged.

### Log Levels

| Event | Level |
|---|---|
| App startup, IPC registration | `info` |
| Print job dispatched | `info` |
| Shell command stdout | `debug` |
| Temperature alert triggered | `warn` |
| Sensor offline > 60s | `warn` |
| WiFi credential update | `warn` (no password values) |
| Print failure, DB error | `error` |
| Unexpected exception | `error` |

### Transport config
```typescript
// logger.ts
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
log.transports.file.level = 'debug'         // file always captures debug+
log.transports.console.level = isDev ? 'debug' : false   // silent in production
log.transports.file.maxSize = 10 * 1024 * 1024  // 10 MB
log.transports.file.archiveLog = true
```

Log file path: `{userData}/logs/preppy-{YYYY-MM-DD}.log`, 30-day retention.

---

## Phase 5 — Config Service

**Goal:** Operators can tune thresholds and paths without touching code.

### `resources/config.json` (shipped defaults)
```json
{
  "temperature": {
    "dangerLow": 31,
    "dangerHigh": 41,
    "warningLow": 37,
    "units": "F"
  },
  "printer": {
    "device": "/dev/usb/lp0",
    "zplTemplateDir": "resources/zpl"
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

Operators create `{userData}/config.local.json` to override any value. Config service deep-merges at startup.

---

## Phase 6 — Reports Page

**Goal:** New `Reports` page in the renderer with three tabs.

### Tab 1: Print History
- SQLite table: `print_jobs(id, template, duration_hrs, qty, printed_at, success, error_msg)`
- Filterable table: date range, template type
- CSV export

### Tab 2: Temperature Report
- Chart.js time-series per sensor (data already being collected)
- Alert event log: timestamp, sensor, threshold type, recovery time
- Summary cards: alert count last 24h, uptime %, min/max readings

### Tab 3: System Logs
- Tails current log file via IPC stream
- Filter by level (info / warn / error)
- Copy-to-clipboard for support

---

## Phase 7 — Component Cleanup

| File | Change |
|---|---|
| `Tempy.tsx` | Remove `fs`/`readline`; subscribe to `sensor:update` IPC events |
| `Printer.tsx` | Delete — logic in `printer.service.ts` |
| `WifiHandler.tsx` | Remove shell calls; call service via IPC |
| `Label.tsx` | Fix `useEffect` missing dependency arrays |
| `Clock.tsx` | Fix `useEffect` missing dependency arrays |
| `Home.tsx` | Remove dead commented-out code |
| `features/counter/` | Delete (unused demo slice) |
| `app/utils/` | Populate: `dateUtils.ts`, `zplUtils.ts`, `formatters.ts` |

---

## Phase 8 — Error Handling & Validation

- Wrap each page in `<ErrorBoundary fallback={<ErrorScreen />}>`
- `useIpcError` hook normalizes IPC errors for toast/alert display
- Zod schemas validate all IPC payloads in both directions
- WiFi: allowlist regex on SSID/password before any write

---

## Implementation Order

```
Phase 1 (Toolchain) ──────────────────────────────────────────┐
                                                               ▼
Phase 2 (Services) ──► Phase 3 (IPC) ──────────────────► Phase 7 (Cleanup)
                              │
                    ┌─────────┼──────────┐
                    ▼         ▼          ▼
               Phase 4    Phase 5    Phase 6
              (Logging)  (Config)  (Reports)
                    └─────────┴──────────┘
                                 │
                                 ▼
                          Phase 8 (Errors)
```

Phases 4, 5, and 6 can be parallelized once Phase 3 IPC channels are in place.

---

## Success Criteria

- [ ] No `require('fs')` or `require('child_process')` in any renderer file
- [ ] All shell calls use `execFile` with argument arrays (no string concatenation)
- [ ] Single SQLite connection (no race conditions)
- [ ] Structured log file generated on every run with correct levels
- [ ] Config values changeable without redeployment
- [ ] Reports page shows print history, temperature trends, and live logs
- [ ] All `useEffect` dependency arrays correct (no infinite loops)
- [ ] Error boundaries on every page
