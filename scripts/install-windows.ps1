<#
.SYNOPSIS
    Preppy Windows installer — downloads the latest release from GitHub and
    configures auto-start in kiosk mode via Task Scheduler.

.PARAMETER GitHubToken
    Optional GitHub personal access token (repo scope) for private repositories.

.PARAMETER RepoOwner
    GitHub repo owner. Default: adamsieht

.PARAMETER RepoName
    GitHub repo name. Default: preppy-v2

.PARAMETER InstallDir
    Directory to install Preppy. Default: %LOCALAPPDATA%\Preppy
    (Does not require admin. Use "C:\Program Files\Preppy" for system-wide install.)

.PARAMETER NoAutoStart
    Skip Task Scheduler registration.

.PARAMETER NoKiosk
    Launch without --kiosk flag (normal windowed mode).

.EXAMPLE
    # Standard install (no admin required):
    powershell -ExecutionPolicy Bypass -File install-windows.ps1

    # Private repo:
    powershell -ExecutionPolicy Bypass -File install-windows.ps1 -GitHubToken "ghp_..."

    # System-wide (requires admin):
    powershell -ExecutionPolicy Bypass -File install-windows.ps1 -InstallDir "C:\Program Files\Preppy"
#>
[CmdletBinding()]
param(
    [string] $GitHubToken  = "",
    [string] $RepoOwner    = "adamsieht",
    [string] $RepoName     = "preppy-v2",
    [string] $InstallDir   = "$env:LOCALAPPDATA\Preppy",
    [switch] $NoAutoStart,
    [switch] $NoKiosk
)

$ErrorActionPreference  = 'Stop'
$ProgressPreference     = 'SilentlyContinue'   # Invoke-WebRequest is faster without progress bar

Write-Host ""
Write-Host "=== Preppy Installer ===" -ForegroundColor Cyan

# ── Fetch latest release ──────────────────────────────────────────────────────
Write-Host "Fetching latest release from GitHub..."
$ApiUrl  = "https://api.github.com/repos/$RepoOwner/$RepoName/releases/latest"
$Headers = @{
    "User-Agent"             = "PrepyInstaller"
    "Accept"                 = "application/vnd.github+json"
    "X-GitHub-Api-Version"   = "2022-11-28"
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

Write-Host "Latest version : $($Release.tag_name)" -ForegroundColor Green
Write-Host "Asset          : $($Asset.name) ($([math]::Round($Asset.size / 1MB, 1)) MB)"

# ── Download ──────────────────────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$ExePath = Join-Path $InstallDir "Preppy-portable.exe"

Write-Host "Downloading to $ExePath..."
$DownloadHeaders = $Headers.Clone()
$DownloadHeaders["Accept"] = "application/octet-stream"
Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $ExePath `
    -UseBasicParsing -Headers $DownloadHeaders

Write-Host "Download complete." -ForegroundColor Green

# ── Task Scheduler auto-start ─────────────────────────────────────────────────
if (-not $NoAutoStart) {
    Write-Host "Configuring auto-start (Task Scheduler)..."

    $KioskArg = if ($NoKiosk) { "" } else { "--kiosk" }

    $Action    = New-ScheduledTaskAction -Execute $ExePath -Argument $KioskArg
    $Trigger   = New-ScheduledTaskTrigger -AtLogOn
    $Settings  = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Seconds 0)   # no time limit
    $Principal = New-ScheduledTaskPrincipal `
        -UserId "$env:USERDOMAIN\$env:USERNAME" `
        -LogonType Interactive `
        -RunLevel Limited

    Register-ScheduledTask `
        -TaskName   "Preppy" `
        -Action     $Action `
        -Trigger    $Trigger `
        -Settings   $Settings `
        -Principal  $Principal `
        -Description "Preppy Label Management System" `
        -Force | Out-Null

    Write-Host "Auto-start registered for user: $env:USERNAME" -ForegroundColor Green
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Installation complete ===" -ForegroundColor Cyan
Write-Host "Installed to  : $ExePath"
if (-not $NoAutoStart) {
    Write-Host "Auto-start    : at next login$(if (-not $NoKiosk) { ' (kiosk mode)' })"
}
Write-Host ""
Write-Host "To start now  : & '$ExePath'$(if (-not $NoKiosk) { ' --kiosk' })"
Write-Host "To uninstall  : Unregister-ScheduledTask -TaskName 'Preppy' -Confirm:`$false; Remove-Item -Recurse -Force '$InstallDir'"
Write-Host ""
