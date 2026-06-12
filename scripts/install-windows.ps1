<#
.SYNOPSIS
    Preppy Windows setup — downloads the latest release, hardens the OS for
    kiosk use, installs the printer driver, and registers auto-start. Run once
    on a fresh tablet; everything is handled in a single step.

.PARAMETER GitHubToken
    Optional GitHub PAT for private repositories.

.PARAMETER RepoOwner / RepoName
    GitHub repository. Defaults: adamsieht / preppy-v2

.PARAMETER InstallDir
    Where to install Preppy. Default: %LOCALAPPDATA%\Preppy (no admin required
    for this path; use "C:\Program Files\Preppy" for a system-wide install).

.PARAMETER NoAutoStart
    Skip Task Scheduler registration.

.PARAMETER NoKiosk
    Launch in normal windowed mode instead of fullscreen kiosk.

.PARAMETER DisableUpdates
    Fully disable automatic Windows Update downloads and installs.
    Default: updates run at 3 AM but the device will never auto-restart.

.PARAMETER AutoLogin / AutoLoginUser / AutoLoginPassword
    Configure passwordless auto-login so the tablet boots straight into Preppy.

.EXAMPLE
    # Standard install:
    powershell -ExecutionPolicy Bypass -File install-windows.ps1

    # Private repo + auto-login + disable updates:
    powershell -ExecutionPolicy Bypass -File install-windows.ps1 `
        -GitHubToken "ghp_..." -DisableUpdates `
        -AutoLogin -AutoLoginUser "Kiosk" -AutoLoginPassword "pw"
#>
#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [string] $GitHubToken       = "",
    [string] $RepoOwner         = "adamsieht",
    [string] $RepoName          = "preppy-v2",
    [string] $InstallDir        = "$env:LOCALAPPDATA\Preppy",
    [switch] $NoAutoStart,
    [switch] $NoKiosk,
    [switch] $DisableUpdates,
    [switch] $AutoLogin,
    [string] $AutoLoginUser     = "",
    [string] $AutoLoginPassword = ""
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

function Set-RegistryValue {
    param([string]$Path, [string]$Name, $Value, [string]$Type = 'DWord')
    if (-not (Test-Path $Path)) { New-Item -Path $Path -Force | Out-Null }
    Set-ItemProperty -Path $Path -Name $Name -Value $Value -Type $Type
}

Write-Host ""
Write-Host "=== Preppy Windows Setup ===" -ForegroundColor Cyan
Write-Host ""

# ── 1. Fetch latest release ───────────────────────────────────────────────────
Write-Host "Fetching latest release from GitHub..." -ForegroundColor Yellow
$ApiUrl  = "https://api.github.com/repos/$RepoOwner/$RepoName/releases/latest"
$Headers = @{
    "User-Agent"           = "PrepyInstaller"
    "Accept"               = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}
if ($GitHubToken) { $Headers["Authorization"] = "Bearer $GitHubToken" }

try {
    $Release = Invoke-RestMethod -Uri $ApiUrl -Headers $Headers
} catch {
    Write-Error "Could not fetch release info: $_"
    exit 1
}

$Asset = $Release.assets | Where-Object { $_.name -like "*.exe" } | Select-Object -First 1
if (-not $Asset) {
    Write-Error "No .exe asset found in release $($Release.tag_name). Check that a Windows build has been published."
    exit 1
}
Write-Host "  Version : $($Release.tag_name)" -ForegroundColor Green
Write-Host "  Asset   : $($Asset.name) ($([math]::Round($Asset.size / 1MB, 1)) MB)"

# ── 2. Download Preppy ────────────────────────────────────────────────────────
Write-Host "Downloading Preppy..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$ExePath = Join-Path $InstallDir "Preppy-portable.exe"
$DlHeaders = $Headers.Clone()
$DlHeaders["Accept"] = "application/octet-stream"
Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $ExePath `
    -UseBasicParsing -Headers $DlHeaders
Write-Host "  Installed to: $ExePath" -ForegroundColor Green

# ── 3. Windows Update ─────────────────────────────────────────────────────────
Write-Host "Configuring Windows Update..." -ForegroundColor Yellow
$AUPath = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU'
if ($DisableUpdates) {
    Set-RegistryValue $AUPath 'NoAutoUpdate' 1
    Set-RegistryValue $AUPath 'AUOptions'    1
    Write-Host "  Automatic updates: DISABLED" -ForegroundColor Red
    Write-Host "  NOTE: Apply security patches manually every few months." -ForegroundColor DarkYellow
} else {
    Set-RegistryValue $AUPath 'NoAutoUpdate'                  0
    Set-RegistryValue $AUPath 'AUOptions'                     4
    Set-RegistryValue $AUPath 'NoAutoRebootWithLoggedOnUsers' 1
    Set-RegistryValue $AUPath 'ScheduledInstallTime'          3
    Write-Host "  Updates at 3 AM, auto-restart: DISABLED"
}
Set-RegistryValue 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization' 'DODownloadMode' 0
Set-RegistryValue 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Schedule\Maintenance' 'MaintenanceDisabled' 1
Write-Host "  Delivery Optimization + Automatic Maintenance: DISABLED"

# ── 4. Power / sleep / hibernate ─────────────────────────────────────────────
Write-Host "Configuring power settings..." -ForegroundColor Yellow
@(
    'monitor-timeout-ac', 'monitor-timeout-dc',
    'standby-timeout-ac', 'standby-timeout-dc',
    'disk-timeout-ac',    'disk-timeout-dc',
    'hibernate-timeout-ac','hibernate-timeout-dc'
) | ForEach-Object { powercfg /change $_ 0 2>$null }
powercfg /hibernate off
Set-RegistryValue 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' 'HiberbootEnabled' 0
Write-Host "  Screen / sleep / hibernate: NEVER   Fast startup: DISABLED"

# ── 5. Lock screen / screensaver ──────────────────────────────────────────────
Write-Host "Disabling lock screen and screensaver..." -ForegroundColor Yellow
Set-RegistryValue 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization' 'NoLockScreen' 1
Set-RegistryValue 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\Control Panel\Desktop' 'ScreenSaveActive' '0' 'String'
Set-ItemProperty  'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveTimeOut' -Value '0'
Set-ItemProperty  'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveActive'  -Value '0'
Set-ItemProperty  'HKCU:\Control Panel\Desktop' -Name 'SCRNSAVE.EXE'      -Value ''
Write-Host "  Lock screen: DISABLED   Screensaver: DISABLED"

# ── 6. Miscellaneous kiosk tweaks ─────────────────────────────────────────────
Write-Host "Applying kiosk tweaks..." -ForegroundColor Yellow
Set-RegistryValue 'HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting'  'Disabled' 1
Set-RegistryValue 'HKLM:\SYSTEM\CurrentControlSet\Control\CrashControl'       'AutoReboot' 1
Set-RegistryValue 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Explorer'        'DisableNotificationCenter' 1
Set-RegistryValue 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\Explorer'        'DisableNotificationCenter' 1
Set-RegistryValue 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'TaskbarAl' 0
Write-Host "  Error reporting, notification toasts: DISABLED"

# ── 7. Auto-login (optional) ──────────────────────────────────────────────────
if ($AutoLogin) {
    if (-not $AutoLoginUser) {
        Write-Warning "-AutoLogin specified but -AutoLoginUser is empty — skipping."
    } else {
        Write-Host "Configuring auto-login for: $AutoLoginUser" -ForegroundColor Yellow
        $WL = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
        Set-RegistryValue $WL 'AutoAdminLogon'  '1'                'String'
        Set-RegistryValue $WL 'DefaultUserName' $AutoLoginUser     'String'
        Set-RegistryValue $WL 'DefaultPassword' $AutoLoginPassword 'String'
        Set-ItemProperty  -Path $WL -Name 'DefaultDomainName' -Value '.' -Type String
        Write-Host "  Auto-login: ENABLED for $AutoLoginUser" -ForegroundColor Green
    }
}

# ── 8. Printer driver ─────────────────────────────────────────────────────────
Write-Host "Installing printer driver..." -ForegroundColor Yellow
try {
    if (-not (Get-PrinterDriver -Name "Generic / Text Only" -ErrorAction SilentlyContinue)) {
        Add-PrinterDriver -Name "Generic / Text Only" -ErrorAction Stop
        Write-Host "  Generic / Text Only: installed" -ForegroundColor Green
    } else {
        Write-Host "  Generic / Text Only: already present" -ForegroundColor Green
    }
} catch {
    Write-Warning "  Could not install printer driver (non-fatal): $_"
}

# ── 9. Task Scheduler auto-start ─────────────────────────────────────────────
if (-not $NoAutoStart) {
    Write-Host "Registering auto-start (Task Scheduler)..." -ForegroundColor Yellow
    $KioskArg  = if ($NoKiosk) { "" } else { "--kiosk" }
    $Action    = New-ScheduledTaskAction -Execute $ExePath -Argument $KioskArg
    $Trigger   = New-ScheduledTaskTrigger -AtLogOn
    $Settings  = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
    $Principal = New-ScheduledTaskPrincipal `
        -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName "Preppy" -Action $Action -Trigger $Trigger `
        -Settings $Settings -Principal $Principal `
        -Description "Preppy Label Management System" -Force | Out-Null
    Write-Host "  Registered for: $env:USERNAME$(if (-not $NoKiosk) { ' (kiosk mode)' })" -ForegroundColor Green
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installed to : $ExePath"
if (-not $NoAutoStart) {
    Write-Host "Auto-start   : at login$(if (-not $NoKiosk) { ' (kiosk mode)' })"
}
Write-Host ""
Write-Host "Next: restart, then connect the Zebra printer and open Settings > Printer." -ForegroundColor White
Write-Host ""
Write-Host "To uninstall:"
Write-Host "  Unregister-ScheduledTask -TaskName 'Preppy' -Confirm:`$false"
Write-Host "  Remove-Item -Recurse -Force '$InstallDir'"
Write-Host ""
$restart = Read-Host "Restart now? [y/N]"
if ($restart -match '^[Yy]') { Restart-Computer -Force }
