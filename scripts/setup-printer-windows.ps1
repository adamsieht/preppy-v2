<#
.SYNOPSIS
    One-time setup: creates a "Zebra ZPL" Windows print queue using the built-in
    Generic / Text Only driver so Preppy can send raw ZPL without a Zebra driver.

.DESCRIPTION
    Run this script ONCE with the Zebra printer already connected via USB and
    powered on. After it completes, open Preppy > Settings > Printer and select
    "Zebra ZPL" from the device list.

    The Generic / Text Only driver ships with every Windows install — no download
    required. It passes bytes straight through to the printer without rendering,
    which is exactly what ZPL needs.

.PARAMETER PrinterName
    The name to give the print queue. Default: "Zebra ZPL"
    Must match what you configure in Preppy Settings > Printer.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File setup-printer-windows.ps1

    powershell -ExecutionPolicy Bypass -File setup-printer-windows.ps1 -PrinterName "Label Printer"
#>
[CmdletBinding()]
param(
    [string] $PrinterName = "Zebra ZPL"
)

#Requires -RunAsAdministrator

$ErrorActionPreference = 'Stop'
$DriverName = "Generic / Text Only"

Write-Host ""
Write-Host "=== Preppy Printer Setup ===" -ForegroundColor Cyan
Write-Host ""

# ── 1. Ensure the Generic / Text Only driver is installed ─────────────────────
Write-Host "Checking printer driver..." -ForegroundColor Yellow
if (-not (Get-PrinterDriver -Name $DriverName -ErrorAction SilentlyContinue)) {
    Write-Host "  Installing '$DriverName' driver..."
    try {
        Add-PrinterDriver -Name $DriverName
        Write-Host "  Driver installed." -ForegroundColor Green
    } catch {
        Write-Error "Could not install '$DriverName' driver: $_"
        exit 1
    }
} else {
    Write-Host "  Driver already present." -ForegroundColor Green
}

# ── 2. Find the USB printer port ──────────────────────────────────────────────
Write-Host "Looking for USB printer port..." -ForegroundColor Yellow

# Wait briefly in case Windows is still enumerating the device
Start-Sleep -Milliseconds 500

$usbPorts = @(Get-PrinterPort -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^USB\d' } |
    Sort-Object Name)

if ($usbPorts.Count -eq 0) {
    Write-Host ""
    Write-Error @"
No USB printer port found (USB001, USB002, ...).

Make sure the Zebra printer is:
  1. Connected via USB
  2. Powered on
  3. Showing a solid ready light

Then re-run this script.
"@
    exit 1
}

# Prefer a port that doesn't already have a queue attached
$port = $usbPorts | Where-Object {
    $portName = $_.Name
    -not (Get-Printer -ErrorAction SilentlyContinue | Where-Object { $_.PortName -eq $portName })
} | Select-Object -First 1

if (-not $port) {
    # All USB ports have queues — just use the first one
    $port = $usbPorts[0]
    Write-Host "  Using port $($port.Name) (already has a queue attached)." -ForegroundColor DarkYellow
} else {
    Write-Host "  Found free port: $($port.Name)" -ForegroundColor Green
}

# ── 3. Remove stale queue with the same name ──────────────────────────────────
if (Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue) {
    Write-Host "Removing existing '$PrinterName' queue..." -ForegroundColor Yellow
    Remove-Printer -Name $PrinterName -ErrorAction SilentlyContinue
}

# ── 4. Create the print queue ─────────────────────────────────────────────────
Write-Host "Creating print queue '$PrinterName' on port $($port.Name)..." -ForegroundColor Yellow
try {
    Add-Printer -Name $PrinterName -DriverName $DriverName -PortName $port.Name
    Write-Host "  Queue created." -ForegroundColor Green
} catch {
    Write-Error "Could not create printer queue: $_"
    exit 1
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Printer setup complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Printer name : $PrinterName"
Write-Host "Port         : $($port.Name)"
Write-Host "Driver       : $DriverName"
Write-Host ""
Write-Host "Next step: open Preppy > Settings > Printer and select '$PrinterName'." -ForegroundColor White
Write-Host ""
