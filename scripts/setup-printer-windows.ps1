<#
.SYNOPSIS
    Preppy printer setup. Installs the "Generic / Text Only" driver and creates a
    "Zebra ZPL" print queue on the connected USB printer port so Preppy can send
    raw ZPL straight through. This is the ONLY thing it does — no power, update,
    lock-screen, auto-login or other Windows settings are touched.

.PARAMETER Quiet
    Run hidden with no prompts (used by Preppy's automatic on-launch setup).
    Without it, a console window shows the result and waits for a keypress.
#>
param([switch] $Quiet)

# -- Self-elevation -----------------------------------------------------------
# Creating a printer/driver requires administrator rights; relaunch with UAC.
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$pr = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    if ($Quiet) { $a += '-Quiet' }
    $style = if ($Quiet) { 'Hidden' } else { 'Normal' }
    Start-Process powershell -Verb RunAs -WindowStyle $style -ArgumentList $a
    exit 0
}

$ErrorActionPreference = 'Stop'
$queueName  = 'Zebra ZPL'
$driverName = 'Generic / Text Only'

function Done($code, $msg) {
    Write-Output $msg
    if (-not $Quiet) {
        Write-Host ""
        Write-Host $msg
        Read-Host "Press Enter to close"
    }
    exit $code
}

try {
    # 1. Driver — ships with every Windows install, no internet required.
    if (-not (Get-PrinterDriver -Name $driverName -ErrorAction SilentlyContinue)) {
        Add-PrinterDriver -Name $driverName
    }

    # 2. Find a connected USB printer port.
    $ports = @(Get-PrinterPort -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^USB' } |
        Select-Object -ExpandProperty Name)
    if ($ports.Count -eq 0) {
        Done 2 "Driver is installed, but no USB printer port was found. Connect the printer (powered on) and run setup again."
    }

    # 3. Create or repoint the queue.
    $existing = Get-Printer -Name $queueName -ErrorAction SilentlyContinue
    if ($existing) {
        if ($ports -notcontains $existing.PortName) {
            Set-Printer -Name $queueName -PortName $ports[0]
        }
    } else {
        Add-Printer -Name $queueName -DriverName $driverName -PortName $ports[0]
    }

    Done 0 "Printer setup complete: '$queueName' on $($ports[0]). Open Settings > Printer and Scan."
} catch {
    Done 1 "Printer setup failed: $_"
}
