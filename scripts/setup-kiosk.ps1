<#
.SYNOPSIS
    Preppy kiosk hardening — headless, driven by the in-app setup wizard.

.DESCRIPTION
    Applies the OS tweaks a dedicated Preppy tablet needs: Windows Update
    restart policy, always-on power settings, no lock screen/screensaver,
    quiet kiosk behavior, optional auto-login, and the Generic/Text Only
    printer driver.

    Installation itself is handled by the Preppy installer (NSIS) and
    launch-at-login by the app — this script only touches OS settings.

    Options come from a JSON file (written by the app, deleted after read):
        { "windowsUpdatePolicy": "no-reboot" | "disable",
          "autoLogin": bool, "autoLoginUser": "...", "autoLoginPassword": "..." }

    Exit code 0 = success; 1 = failure (details in the log file).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File setup-kiosk.ps1 -OptionsFile opts.json
#>
[CmdletBinding()]
param(
    [string] $OptionsFile = "",
    [string] $LogFile = "$env:TEMP\preppy-kiosk-setup.log"
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

function Log($msg) {
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg" | Out-File $LogFile -Append -Encoding utf8
}

"" | Out-File $LogFile -Encoding utf8 -Force
Log "Preppy kiosk setup started"

# -- Self-elevate if launched by hand without admin ----------------------------
$identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Log "Not elevated — relaunching with UAC prompt"
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-LogFile', "`"$LogFile`"")
    if ($OptionsFile) { $argList += @('-OptionsFile', "`"$OptionsFile`"") }
    $p = Start-Process powershell -Verb RunAs -Wait -PassThru -ArgumentList $argList
    exit $p.ExitCode
}

# -- Read options ---------------------------------------------------------------
$opts = [pscustomobject]@{
    windowsUpdatePolicy = 'no-reboot'
    autoLogin           = $false
    autoLoginUser       = ''
    autoLoginPassword   = ''
}
if ($OptionsFile -and (Test-Path -LiteralPath $OptionsFile)) {
    try {
        $opts = Get-Content -LiteralPath $OptionsFile -Raw | ConvertFrom-Json
        Remove-Item -LiteralPath $OptionsFile -Force -ErrorAction SilentlyContinue
        Log "Options loaded (updatePolicy=$($opts.windowsUpdatePolicy), autoLogin=$($opts.autoLogin))"
    } catch {
        Log "WARNING: could not parse options file, using defaults: $_"
    }
} else {
    Log "No options file — using defaults"
}

function Reg($path, $name, $value, $type = 'DWord') {
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    Set-ItemProperty -Path $path -Name $name -Value $value -Type $type
}

$failed = $false

try {
    Log "=== Configuring Windows Update ==="
    $au = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU'
    if ($opts.windowsUpdatePolicy -eq 'disable') {
        Reg $au 'NoAutoUpdate' 1
        Reg $au 'AUOptions'    1
        Log "  Automatic updates: DISABLED"
    } else {
        Reg $au 'NoAutoUpdate'                  0
        Reg $au 'AUOptions'                     4
        Reg $au 'NoAutoRebootWithLoggedOnUsers' 1
        Reg $au 'ScheduledInstallTime'          3
        Log "  Updates at 3 AM  |  Auto-restart: DISABLED"
    }
    Reg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization' 'DODownloadMode' 0
    Reg 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Schedule\Maintenance' 'MaintenanceDisabled' 1
    Log "  Delivery Optimization: DISABLED  |  Automatic Maintenance: DISABLED"

    Log "=== Configuring power settings ==="
    @('monitor-timeout-ac','monitor-timeout-dc',
      'standby-timeout-ac','standby-timeout-dc',
      'disk-timeout-ac','disk-timeout-dc',
      'hibernate-timeout-ac','hibernate-timeout-dc') |
        ForEach-Object { powercfg /change $_ 0 2>$null }
    powercfg /hibernate off
    Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' 'HiberbootEnabled' 0
    Log "  Screen/sleep/hibernate: NEVER  |  Fast startup: DISABLED"

    Log "=== Disabling lock screen and screensaver ==="
    Reg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization' 'NoLockScreen' 1
    Reg 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\Control Panel\Desktop' 'ScreenSaveActive' '0' 'String'
    Set-ItemProperty 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveTimeOut' -Value '0'
    Set-ItemProperty 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveActive'  -Value '0'
    Set-ItemProperty 'HKCU:\Control Panel\Desktop' -Name 'SCRNSAVE.EXE'      -Value ''
    Log "  Lock screen: DISABLED  |  Screensaver: DISABLED"

    Log "=== Applying kiosk tweaks ==="
    Reg 'HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting' 'Disabled' 1
    Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\CrashControl' 'AutoReboot' 1
    Reg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Explorer' 'DisableNotificationCenter' 1
    Reg 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\Explorer' 'DisableNotificationCenter' 1
    Reg 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'TaskbarAl' 0
    Log "  Error reporting: DISABLED  |  Notification toasts: DISABLED"

    if ($opts.autoLogin -and $opts.autoLoginUser) {
        Log "=== Configuring automatic login ==="
        $wl = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
        Reg $wl 'AutoAdminLogon'  '1'                       'String'
        Reg $wl 'DefaultUserName' $opts.autoLoginUser       'String'
        Reg $wl 'DefaultPassword' $opts.autoLoginPassword   'String'
        Set-ItemProperty -Path $wl -Name 'DefaultDomainName' -Value '.' -Type String
        Log "  Auto-login: ENABLED for $($opts.autoLoginUser)"
    }

    Log "=== Installing printer driver ==="
    try {
        if (-not (Get-PrinterDriver -Name "Generic / Text Only" -ErrorAction SilentlyContinue)) {
            Add-PrinterDriver -Name "Generic / Text Only" -ErrorAction Stop
            Log "  Generic / Text Only: installed"
        } else {
            Log "  Generic / Text Only: already present"
        }
    } catch {
        Log "  WARNING: Could not install printer driver (non-fatal): $_"
    }

    Log "=== Kiosk setup complete — restart Windows to apply everything ==="
} catch {
    Log "ERROR: $_"
    $failed = $true
}

if ($failed) { exit 1 } else { exit 0 }
