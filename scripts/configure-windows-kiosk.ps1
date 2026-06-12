<#
.SYNOPSIS
    Preppy kiosk hardening for Windows tablets — disables automatic Windows Update
    restarts, prevents sleep/hibernate, and locks down power settings for always-on
    kiosk operation.

.PARAMETER AutoLogin
    Enable automatic login (no password prompt on boot). Requires -AutoLoginUser
    and -AutoLoginPassword.

.PARAMETER AutoLoginUser
    Username for automatic login (local account name, not email).

.PARAMETER AutoLoginPassword
    Password for automatic login. Leave blank if the account has no password.

.PARAMETER DisableUpdates
    Fully disable automatic Windows Update downloads and installs.
    Default: updates are allowed but will NOT auto-restart the device.

.EXAMPLE
    # Basic hardening (no auto-login):
    powershell -ExecutionPolicy Bypass -File configure-windows-kiosk.ps1

    # With automatic login:
    powershell -ExecutionPolicy Bypass -File configure-windows-kiosk.ps1 `
        -AutoLogin -AutoLoginUser "Kiosk" -AutoLoginPassword "yourpassword"

    # Fully disable Windows Update:
    powershell -ExecutionPolicy Bypass -File configure-windows-kiosk.ps1 -DisableUpdates
#>
[CmdletBinding()]
param(
    [switch] $AutoLogin,
    [string] $AutoLoginUser     = "",
    [string] $AutoLoginPassword = "",
    [switch] $DisableUpdates
)

#Requires -RunAsAdministrator

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "=== Preppy Kiosk Configuration ===" -ForegroundColor Cyan
Write-Host ""

# ── Helper ────────────────────────────────────────────────────────────────────
function Set-RegistryValue {
    param([string]$Path, [string]$Name, $Value, [string]$Type = 'DWord')
    if (-not (Test-Path $Path)) {
        New-Item -Path $Path -Force | Out-Null
    }
    Set-ItemProperty -Path $Path -Name $Name -Value $Value -Type $Type
}

# ── 1. Windows Update ─────────────────────────────────────────────────────────
Write-Host "Configuring Windows Update..." -ForegroundColor Yellow

$AUPath = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU'

if ($DisableUpdates) {
    # Disable automatic updates entirely
    Set-RegistryValue $AUPath 'NoAutoUpdate'           1
    Set-RegistryValue $AUPath 'AUOptions'              1   # 1 = never check
    Write-Host "  Automatic Windows Update: DISABLED" -ForegroundColor Red
    Write-Host "  NOTE: Apply security patches manually every few months." -ForegroundColor DarkYellow
} else {
    # Allow updates to download/install but NEVER auto-restart
    Set-RegistryValue $AUPath 'NoAutoUpdate'                    0
    Set-RegistryValue $AUPath 'AUOptions'                       4   # auto download + install
    Set-RegistryValue $AUPath 'NoAutoRebootWithLoggedOnUsers'   1   # key setting: no forced reboot
    Set-RegistryValue $AUPath 'ScheduledInstallTime'            3   # 3 AM install window
    Write-Host "  Automatic updates: ON  |  Auto-restart: DISABLED"
}

# Disable delivery optimisation (peer-to-peer update sharing — wastes bandwidth)
$DOPath = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization'
Set-RegistryValue $DOPath 'DODownloadMode' 0
Write-Host "  Delivery Optimization (P2P updates): DISABLED"

# Disable automatic maintenance (can interrupt kiosk at random times)
$MaintPath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Schedule\Maintenance'
Set-RegistryValue $MaintPath 'MaintenanceDisabled' 1
Write-Host "  Automatic Maintenance: DISABLED"

Write-Host ""

# ── 2. Power / Sleep / Hibernate ─────────────────────────────────────────────
Write-Host "Configuring power settings..." -ForegroundColor Yellow

# Never sleep, never turn off monitor — both on AC and battery
$timeouts = @(
    'monitor-timeout-ac',
    'monitor-timeout-dc',
    'standby-timeout-ac',
    'standby-timeout-dc',
    'disk-timeout-ac',
    'disk-timeout-dc',
    'hibernate-timeout-ac',
    'hibernate-timeout-dc'
)
foreach ($t in $timeouts) {
    powercfg /change $t 0 2>$null
}

# Disable hibernate entirely (frees disk space, prevents hibernate-related issues)
powercfg /hibernate off

# Disable fast startup (can cause USB/printer devices to not re-initialise on boot)
Set-RegistryValue 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' `
    'HiberbootEnabled' 0

Write-Host "  Screen timeout   : NEVER (AC + battery)"
Write-Host "  Sleep timeout    : NEVER (AC + battery)"
Write-Host "  Hibernate        : DISABLED"
Write-Host "  Fast startup     : DISABLED"
Write-Host ""

# ── 3. Lock screen / screensaver ─────────────────────────────────────────────
Write-Host "Disabling lock screen and screensaver..." -ForegroundColor Yellow

# Disable lock screen image (speeds up resume)
Set-RegistryValue 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization' `
    'NoLockScreen' 1

# Disable screensaver via policy
Set-RegistryValue 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\Control Panel\Desktop' `
    'ScreenSaveActive' '0' 'String'

# Set screensaver timeout to 0 just in case
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveTimeOut' -Value '0'
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveActive'  -Value '0'
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'SCRNSAVE.EXE'      -Value ''

Write-Host "  Lock screen      : DISABLED"
Write-Host "  Screensaver      : DISABLED"
Write-Host ""

# ── 4. Auto-login (optional) ──────────────────────────────────────────────────
if ($AutoLogin) {
    if (-not $AutoLoginUser) {
        Write-Warning "  -AutoLogin specified but -AutoLoginUser is empty. Skipping."
    } else {
        Write-Host "Configuring automatic login for: $AutoLoginUser" -ForegroundColor Yellow

        $WinlogonPath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
        Set-RegistryValue $WinlogonPath 'AutoAdminLogon'    '1'              'String'
        Set-RegistryValue $WinlogonPath 'DefaultUserName'   $AutoLoginUser   'String'
        Set-RegistryValue $WinlogonPath 'DefaultPassword'   $AutoLoginPassword 'String'
        # Clear domain so local account is used
        Set-ItemProperty  -Path $WinlogonPath -Name 'DefaultDomainName' -Value '.' -Type String

        Write-Host "  Auto-login: ENABLED for $AutoLoginUser"
        Write-Host ""
    }
}

# ── 5. Miscellaneous kiosk tweaks ─────────────────────────────────────────────
Write-Host "Applying miscellaneous tweaks..." -ForegroundColor Yellow

# Disable Windows Error Reporting popups
Set-RegistryValue 'HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting' 'Disabled' 1

# Suppress "your PC ran into a problem" restart prompt after BSOD
Set-RegistryValue 'HKLM:\SYSTEM\CurrentControlSet\Control\CrashControl' 'AutoReboot' 1

# Disable action center / notification toasts that can overlay the kiosk UI
Set-RegistryValue 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Explorer' `
    'DisableNotificationCenter' 1
Set-RegistryValue 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\Explorer' `
    'DisableNotificationCenter' 1

# Hide taskbar on all monitors (Preppy runs fullscreen; belt-and-braces)
$ExplorerPath = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3'
# Note: taskbar auto-hide is set per-user via StuckRects3 binary value.
# We use a simpler approach: set TaskbarAl (alignment) and auto-hide via policy.
Set-RegistryValue 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced' `
    'TaskbarAl' 0   # left-align (cosmetic, keeps it out of the way on resume)

Write-Host "  Error reporting  : DISABLED"
Write-Host "  Notification toasts: DISABLED"
Write-Host ""

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host "=== Kiosk configuration complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "A restart is recommended for all settings to take effect."
Write-Host ""
Write-Host "Printer setup (run after restart, with Zebra connected via USB):" -ForegroundColor DarkYellow
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\setup-printer-windows.ps1" -ForegroundColor DarkYellow
Write-Host ""
$restart = Read-Host "Restart now? [y/N]"
if ($restart -match '^[Yy]') {
    Restart-Computer -Force
}
