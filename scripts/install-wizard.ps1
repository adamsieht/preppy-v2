<#
.SYNOPSIS
    Preppy Windows Setup Wizard -- GUI installer for first-time tablet setup.

.DESCRIPTION
    A step-by-step graphical installer. Collects setup options, downloads the
    latest Preppy release, hardens Windows for kiosk operation, and registers
    Preppy to start automatically at login. No terminal commands required.

    Launch via "Install Preppy.bat", or run directly:
        powershell -ExecutionPolicy Bypass -File install-wizard.ps1

    If the wizard fails to open, check the log file at:
        %TEMP%\preppy-setup.log
#>

# -- Self-elevation -----------------------------------------------------------
# If not already running as Administrator, relaunch with a UAC prompt.
$_id = [Security.Principal.WindowsIdentity]::GetCurrent()
$_pr = New-Object Security.Principal.WindowsPrincipal($_id)
if (-not $_pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -Verb RunAs -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`""
    )
    exit 0
}

# -- Log file (persists after window closes) ----------------------------------
$LOG_FILE = Join-Path $env:TEMP "preppy-setup.log"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  Preppy Setup Wizard started" |
    Out-File $LOG_FILE -Encoding utf8 -Force

# -- Load assemblies ----------------------------------------------------------
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)

# -- Constants ----------------------------------------------------------------
$REPO_OWNER = "adamsieht"
$REPO_NAME  = "preppy-v2"

$C_ACCENT  = [System.Drawing.Color]::FromArgb(255,  40, 167,  69)
$C_DANGER  = [System.Drawing.Color]::FromArgb(255, 248,  81,  73)
$C_SUCCESS = [System.Drawing.Color]::FromArgb(255,  40, 167,  69)
$C_WHITE   = [System.Drawing.Color]::White
$C_FG      = [System.Drawing.Color]::FromArgb(255,  36,  41,  47)
$C_MUTED   = [System.Drawing.Color]::FromArgb(255, 110, 118, 129)
$C_BORDER  = [System.Drawing.Color]::FromArgb(255, 208, 215, 222)
$C_FOOT_BG = [System.Drawing.Color]::FromArgb(255, 246, 248, 250)
$C_LOG_BG  = [System.Drawing.Color]::FromArgb(255,  13,  17,  23)
$C_LOG_FG  = [System.Drawing.Color]::FromArgb(255, 201, 209, 217)

$F_UI    = New-Object System.Drawing.Font("Segoe UI",  9)
$F_BOLD  = New-Object System.Drawing.Font("Segoe UI",  9, [System.Drawing.FontStyle]::Bold)
$F_TITLE = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$F_HEAD  = New-Object System.Drawing.Font("Segoe UI", 10)
$F_SMALL = New-Object System.Drawing.Font("Segoe UI",  8)
$F_MONO  = New-Object System.Drawing.Font("Consolas",  8.5)

# -- Form ---------------------------------------------------------------------
$form = New-Object System.Windows.Forms.Form
$form.Text            = "Preppy Setup"
$form.ClientSize      = New-Object System.Drawing.Size(520, 455)
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
$form.MaximizeBox     = $false
$form.StartPosition   = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.BackColor       = $C_WHITE
$form.Font            = $F_UI

# -- Header (always visible) --------------------------------------------------
$pHeader           = New-Object System.Windows.Forms.Panel
$pHeader.Location  = New-Object System.Drawing.Point(0, 0)
$pHeader.Size      = New-Object System.Drawing.Size(520, 72)
$pHeader.BackColor = $C_ACCENT

$lTitle           = New-Object System.Windows.Forms.Label
$lTitle.Text      = "Preppy"
$lTitle.Font      = $F_TITLE
$lTitle.ForeColor = $C_WHITE
$lTitle.Location  = New-Object System.Drawing.Point(16, 10)
$lTitle.AutoSize  = $true

$lSubtitle           = New-Object System.Windows.Forms.Label
$lSubtitle.Text      = "Welcome"
$lSubtitle.Font      = $F_HEAD
$lSubtitle.ForeColor = [System.Drawing.Color]::FromArgb(200, 255, 255, 255)
$lSubtitle.Location  = New-Object System.Drawing.Point(16, 42)
$lSubtitle.AutoSize  = $true

$pHeader.Controls.AddRange(@($lTitle, $lSubtitle))
$form.Controls.Add($pHeader)

# -- Separator lines ----------------------------------------------------------
foreach ($y in @(72, 411)) {
    $sep           = New-Object System.Windows.Forms.Label
    $sep.Location  = New-Object System.Drawing.Point(0, $y)
    $sep.Size      = New-Object System.Drawing.Size(520, 1)
    $sep.BackColor = $C_BORDER
    $form.Controls.Add($sep)
}

# -- Footer -------------------------------------------------------------------
$pFoot           = New-Object System.Windows.Forms.Panel
$pFoot.Location  = New-Object System.Drawing.Point(0, 412)
$pFoot.Size      = New-Object System.Drawing.Size(520, 43)
$pFoot.BackColor = $C_FOOT_BG

$btnBack           = New-Object System.Windows.Forms.Button
$btnBack.Text      = "< Back"
$btnBack.Location  = New-Object System.Drawing.Point(316, 6)
$btnBack.Size      = New-Object System.Drawing.Size(90, 32)
$btnBack.FlatStyle = [System.Windows.Forms.FlatStyle]::System
$btnBack.Visible   = $false

$btnNext                              = New-Object System.Windows.Forms.Button
$btnNext.Text                         = "Next >"
$btnNext.Location                     = New-Object System.Drawing.Point(414, 6)
$btnNext.Size                         = New-Object System.Drawing.Size(90, 32)
$btnNext.BackColor                    = $C_ACCENT
$btnNext.ForeColor                    = $C_WHITE
$btnNext.FlatStyle                    = [System.Windows.Forms.FlatStyle]::Flat
$btnNext.FlatAppearance.BorderSize    = 0

$pFoot.Controls.AddRange(@($btnBack, $btnNext))
$form.Controls.Add($pFoot)

# -- Content panel factory ----------------------------------------------------
$PANEL_Y = 73
$PANEL_H = 338
$PANEL_W = 520

function New-Page {
    $p           = New-Object System.Windows.Forms.Panel
    $p.Location  = New-Object System.Drawing.Point(0, $PANEL_Y)
    $p.Size      = New-Object System.Drawing.Size($PANEL_W, $PANEL_H)
    $p.BackColor = $C_WHITE
    $p.Visible   = $false
    $form.Controls.Add($p)
    return $p
}

# -- Page 1: Welcome ----------------------------------------------------------
$pg1 = New-Page

$lIntro          = New-Object System.Windows.Forms.Label
$lIntro.Text     = "This wizard will configure your tablet and install the latest version of Preppy. It takes about 2 minutes and requires an internet connection."
$lIntro.ForeColor = $C_FG
$lIntro.Location = New-Object System.Drawing.Point(16, 14)
$lIntro.Size     = New-Object System.Drawing.Size(486, 44)
$pg1.Controls.Add($lIntro)

$lWhat           = New-Object System.Windows.Forms.Label
$lWhat.Text      = "What this wizard does:"
$lWhat.Font      = $F_BOLD
$lWhat.ForeColor = $C_FG
$lWhat.Location  = New-Object System.Drawing.Point(16, 68)
$lWhat.AutoSize  = $true
$pg1.Controls.Add($lWhat)

$wizSteps = @(
    "Download and install the latest version of Preppy"
    "Prevent Windows from auto-restarting during updates"
    "Disable sleep, hibernate, and screen timeout"
    "Disable the lock screen and screensaver"
    "Register Preppy to start automatically at login (kiosk mode)"
    "Install the Generic Text Only printer driver"
)
$iy = 92
foreach ($s in $wizSteps) {
    $l           = New-Object System.Windows.Forms.Label
    $l.Text      = "   *   $s"
    $l.ForeColor = $C_FG
    $l.Location  = New-Object System.Drawing.Point(16, $iy)
    $l.Size      = New-Object System.Drawing.Size(486, 22)
    $pg1.Controls.Add($l)
    $iy += 23
}

$lNote           = New-Object System.Windows.Forms.Label
$lNote.Text      = "A restart is required when setup completes. Make sure the tablet is plugged in."
$lNote.Font      = $F_SMALL
$lNote.ForeColor = $C_MUTED
$lNote.Location  = New-Object System.Drawing.Point(16, 310)
$lNote.Size      = New-Object System.Drawing.Size(486, 18)
$pg1.Controls.Add($lNote)

# -- Page 2: Options ----------------------------------------------------------
$pg2 = New-Page

$grpUpd           = New-Object System.Windows.Forms.GroupBox
$grpUpd.Text      = " Windows Update "
$grpUpd.Font      = $F_BOLD
$grpUpd.ForeColor = $C_FG
$grpUpd.Location  = New-Object System.Drawing.Point(12, 8)
$grpUpd.Size      = New-Object System.Drawing.Size(494, 74)

$radAllow          = New-Object System.Windows.Forms.RadioButton
$radAllow.Text     = "Allow updates, but never auto-restart  (recommended)"
$radAllow.Font     = $F_UI
$radAllow.Location = New-Object System.Drawing.Point(10, 22)
$radAllow.Size     = New-Object System.Drawing.Size(470, 22)
$radAllow.Checked  = $true

$radDisable          = New-Object System.Windows.Forms.RadioButton
$radDisable.Text     = "Disable automatic updates entirely"
$radDisable.Font     = $F_UI
$radDisable.Location = New-Object System.Drawing.Point(10, 48)
$radDisable.Size     = New-Object System.Drawing.Size(470, 22)

$grpUpd.Controls.AddRange(@($radAllow, $radDisable))
$pg2.Controls.Add($grpUpd)

$grpLogin           = New-Object System.Windows.Forms.GroupBox
$grpLogin.Text      = " Automatic Login (optional) "
$grpLogin.Font      = $F_BOLD
$grpLogin.ForeColor = $C_FG
$grpLogin.Location  = New-Object System.Drawing.Point(12, 90)
$grpLogin.Size      = New-Object System.Drawing.Size(494, 106)

$chkLogin          = New-Object System.Windows.Forms.CheckBox
$chkLogin.Text     = "Log in automatically on startup (no password prompt)"
$chkLogin.Font     = $F_UI
$chkLogin.Location = New-Object System.Drawing.Point(10, 22)
$chkLogin.Size     = New-Object System.Drawing.Size(470, 22)

$lUser           = New-Object System.Windows.Forms.Label
$lUser.Text      = "Username:"
$lUser.Font      = $F_UI
$lUser.Location  = New-Object System.Drawing.Point(10, 52)
$lUser.Size      = New-Object System.Drawing.Size(72, 22)
$lUser.Enabled   = $false

$tUser          = New-Object System.Windows.Forms.TextBox
$tUser.Font     = $F_UI
$tUser.Location = New-Object System.Drawing.Point(86, 50)
$tUser.Size     = New-Object System.Drawing.Size(178, 26)
$tUser.Enabled  = $false

$lPass           = New-Object System.Windows.Forms.Label
$lPass.Text      = "Password:"
$lPass.Font      = $F_UI
$lPass.Location  = New-Object System.Drawing.Point(274, 52)
$lPass.Size      = New-Object System.Drawing.Size(68, 22)
$lPass.Enabled   = $false

$tPass                = New-Object System.Windows.Forms.TextBox
$tPass.PasswordChar   = [char]0x2022
$tPass.Font           = $F_UI
$tPass.Location       = New-Object System.Drawing.Point(346, 50)
$tPass.Size           = New-Object System.Drawing.Size(140, 26)
$tPass.Enabled        = $false

$lPassHint           = New-Object System.Windows.Forms.Label
$lPassHint.Text      = "Leave password blank if the account has no password set."
$lPassHint.Font      = $F_SMALL
$lPassHint.ForeColor = $C_MUTED
$lPassHint.Location  = New-Object System.Drawing.Point(10, 80)
$lPassHint.Size      = New-Object System.Drawing.Size(470, 18)
$lPassHint.Enabled   = $false

$chkLogin.Add_CheckedChanged({
    $on = $chkLogin.Checked
    foreach ($c in @($lUser, $tUser, $lPass, $tPass, $lPassHint)) { $c.Enabled = $on }
})

$grpLogin.Controls.AddRange(@($chkLogin, $lUser, $tUser, $lPass, $tPass, $lPassHint))
$pg2.Controls.Add($grpLogin)

$grpToken           = New-Object System.Windows.Forms.GroupBox
$grpToken.Text      = " Private Repository (optional) "
$grpToken.Font      = $F_BOLD
$grpToken.ForeColor = $C_FG
$grpToken.Location  = New-Object System.Drawing.Point(12, 204)
$grpToken.Size      = New-Object System.Drawing.Size(494, 62)

$lToken          = New-Object System.Windows.Forms.Label
$lToken.Text     = "GitHub token:"
$lToken.Font     = $F_UI
$lToken.Location = New-Object System.Drawing.Point(10, 26)
$lToken.Size     = New-Object System.Drawing.Size(92, 22)

$tToken          = New-Object System.Windows.Forms.TextBox
$tToken.Font     = $F_UI
$tToken.Location = New-Object System.Drawing.Point(106, 24)
$tToken.Size     = New-Object System.Drawing.Size(380, 26)

$grpToken.Controls.AddRange(@($lToken, $tToken))
$pg2.Controls.Add($grpToken)

# -- Page 3: Installing -------------------------------------------------------
$pg3 = New-Page

$lStatus           = New-Object System.Windows.Forms.Label
$lStatus.Text      = "Starting installation..."
$lStatus.Font      = $F_BOLD
$lStatus.ForeColor = $C_FG
$lStatus.Location  = New-Object System.Drawing.Point(16, 12)
$lStatus.Size      = New-Object System.Drawing.Size(486, 22)
$pg3.Controls.Add($lStatus)

$progBar          = New-Object System.Windows.Forms.ProgressBar
$progBar.Style    = [System.Windows.Forms.ProgressBarStyle]::Marquee
$progBar.Location = New-Object System.Drawing.Point(16, 40)
$progBar.Size     = New-Object System.Drawing.Size(486, 22)
$pg3.Controls.Add($progBar)

$logBox             = New-Object System.Windows.Forms.RichTextBox
$logBox.Font        = $F_MONO
$logBox.BackColor   = $C_LOG_BG
$logBox.ForeColor   = $C_LOG_FG
$logBox.ReadOnly    = $true
$logBox.ScrollBars  = [System.Windows.Forms.RichTextBoxScrollBars]::Vertical
$logBox.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$logBox.Location    = New-Object System.Drawing.Point(16, 70)
$logBox.Size        = New-Object System.Drawing.Size(486, 252)
$pg3.Controls.Add($logBox)

# -- Navigation ---------------------------------------------------------------
$script:step       = -1
$script:doneAction = 'none'
$pages = @($pg1, $pg2, $pg3)

function Show-Step([int]$n) {
    $pages | ForEach-Object { $_.Visible = $false }
    $pages[$n].Visible = $true
    $script:step       = $n
    switch ($n) {
        0 {
            $lSubtitle.Text  = "Welcome"
            $btnBack.Visible = $false
            $btnNext.Text    = "Next >"
            $btnNext.Enabled = $true
        }
        1 {
            $lSubtitle.Text  = "Step 1 of 2 - Setup Options"
            $btnBack.Visible = $true
            $btnNext.Text    = "Install >"
            $btnNext.Enabled = $true
        }
        2 {
            $lSubtitle.Text  = "Step 2 of 2 - Installing"
            $btnBack.Visible = $false
            $btnNext.Text    = "Restart Now"
            $btnNext.Enabled = $false
        }
    }
}

Show-Step 0

$btnBack.Add_Click({
    if ($script:step -gt 0) { Show-Step ($script:step - 1) }
})

$btnNext.Add_Click({
    switch ($script:step) {
        0 { Show-Step 1 }
        1 { Start-WizardInstall }
        2 {
            if ($script:doneAction -eq 'restart') { Restart-Computer -Force }
            else { $form.Close() }
        }
    }
})

# -- Install ------------------------------------------------------------------
function Start-WizardInstall {
    if ($chkLogin.Checked -and -not $tUser.Text.Trim()) {
        [System.Windows.Forms.MessageBox]::Show(
            "Please enter a username for automatic login, or uncheck that option.",
            "Missing username",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        ) | Out-Null
        return
    }

    Show-Step 2

    $opts = @{
        RepoOwner      = $REPO_OWNER
        RepoName       = $REPO_NAME
        DisableUpdates = $radDisable.Checked
        AutoLogin      = $chkLogin.Checked
        LoginUser      = $tUser.Text.Trim()
        LoginPass      = $tPass.Text
        Token          = $tToken.Text.Trim()
        InstallDir     = "$env:LOCALAPPDATA\Preppy"
    }

    $installBlock = {
        param($o)
        $ErrorActionPreference = 'Stop'
        $ProgressPreference    = 'SilentlyContinue'

        function Log($msg) { Write-Output $msg }
        function Reg($path, $name, $value, $type = 'DWord') {
            if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
            Set-ItemProperty -Path $path -Name $name -Value $value -Type $type
        }

        try {
            Log ""
            Log "=== Downloading Preppy ==="
            $hdrs = @{
                'User-Agent'           = 'PrepyInstaller'
                'Accept'               = 'application/vnd.github+json'
                'X-GitHub-Api-Version' = '2022-11-28'
            }
            if ($o.Token) { $hdrs['Authorization'] = "Bearer $($o.Token)" }

            # Try the latest stable release first; fall back to the most recent
            # release of any kind (including pre-releases) if none exists yet.
            $release = $null
            try {
                $release = Invoke-RestMethod `
                    "https://api.github.com/repos/$($o.RepoOwner)/$($o.RepoName)/releases/latest" `
                    -Headers $hdrs
            } catch {
                Log "  No stable release found, checking for pre-releases..."
                try {
                    $all     = Invoke-RestMethod `
                        "https://api.github.com/repos/$($o.RepoOwner)/$($o.RepoName)/releases?per_page=10" `
                        -Headers $hdrs
                    $release = $all | Where-Object { -not $_.draft } | Select-Object -First 1
                } catch {}
            }
            if (-not $release) {
                throw "No releases found for $($o.RepoOwner)/$($o.RepoName). A GitHub release with a Windows .exe must be published before Preppy can be downloaded."
            }

            $asset = $release.assets |
                Where-Object { $_.name -like "*.exe" } |
                Select-Object -First 1
            if (-not $asset) {
                throw "Release $($release.tag_name) has no .exe file attached. The CI build may still be running -- please try again in a few minutes."
            }
            Log "  Version : $($release.tag_name)"
            Log "  File    : $($asset.name)  ($([math]::Round($asset.size/1MB,1)) MB)"

            New-Item -ItemType Directory -Force -Path $o.InstallDir | Out-Null
            $exePath = Join-Path $o.InstallDir "Preppy-portable.exe"
            $dlHdrs  = $hdrs.Clone()
            $dlHdrs['Accept'] = 'application/octet-stream'
            Invoke-WebRequest -Uri $asset.browser_download_url `
                -OutFile $exePath -UseBasicParsing -Headers $dlHdrs
            Log "  Saved to: $exePath"

            Log ""
            Log "=== Configuring Windows Update ==="
            $au = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU'
            if ($o.DisableUpdates) {
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
            Reg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization' `
                'DODownloadMode' 0
            Reg 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Schedule\Maintenance' `
                'MaintenanceDisabled' 1
            Log "  Delivery Optimization: DISABLED"
            Log "  Automatic Maintenance: DISABLED"

            Log ""
            Log "=== Configuring power settings ==="
            @('monitor-timeout-ac','monitor-timeout-dc',
              'standby-timeout-ac','standby-timeout-dc',
              'disk-timeout-ac','disk-timeout-dc',
              'hibernate-timeout-ac','hibernate-timeout-dc') |
                ForEach-Object { powercfg /change $_ 0 2>$null }
            powercfg /hibernate off
            Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' `
                'HiberbootEnabled' 0
            Log "  Screen/sleep/hibernate: NEVER  |  Fast startup: DISABLED"

            Log ""
            Log "=== Disabling lock screen and screensaver ==="
            Reg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization' `
                'NoLockScreen' 1
            Reg 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\Control Panel\Desktop' `
                'ScreenSaveActive' '0' 'String'
            Set-ItemProperty 'HKCU:\Control Panel\Desktop' `
                -Name 'ScreenSaveTimeOut' -Value '0'
            Set-ItemProperty 'HKCU:\Control Panel\Desktop' `
                -Name 'ScreenSaveActive'  -Value '0'
            Set-ItemProperty 'HKCU:\Control Panel\Desktop' `
                -Name 'SCRNSAVE.EXE'      -Value ''
            Log "  Lock screen: DISABLED  |  Screensaver: DISABLED"

            Log ""
            Log "=== Applying kiosk tweaks ==="
            Reg 'HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting' `
                'Disabled' 1
            Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\CrashControl' `
                'AutoReboot' 1
            Reg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Explorer' `
                'DisableNotificationCenter' 1
            Reg 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\Explorer' `
                'DisableNotificationCenter' 1
            Reg 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced' `
                'TaskbarAl' 0
            Log "  Error reporting: DISABLED  |  Notification toasts: DISABLED"

            if ($o.AutoLogin -and $o.LoginUser) {
                Log ""
                Log "=== Configuring automatic login ==="
                $wl = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
                Reg $wl 'AutoAdminLogon'  '1'          'String'
                Reg $wl 'DefaultUserName' $o.LoginUser 'String'
                Reg $wl 'DefaultPassword' $o.LoginPass 'String'
                Set-ItemProperty -Path $wl -Name 'DefaultDomainName' -Value '.' -Type String
                Log "  Auto-login: ENABLED for $($o.LoginUser)"
            }

            Log ""
            Log "=== Installing printer driver ==="
            try {
                if (-not (Get-PrinterDriver -Name "Generic / Text Only" `
                        -ErrorAction SilentlyContinue)) {
                    Add-PrinterDriver -Name "Generic / Text Only" -ErrorAction Stop
                    Log "  Generic / Text Only: installed"
                } else {
                    Log "  Generic / Text Only: already present"
                }
            } catch {
                Log "  WARNING: Could not install printer driver (non-fatal): $_"
            }

            Log ""
            Log "=== Registering auto-start ==="
            $action    = New-ScheduledTaskAction -Execute $exePath -Argument "--kiosk"
            $trigger   = New-ScheduledTaskTrigger -AtLogOn
            $settings  = New-ScheduledTaskSettingsSet `
                -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                -StartWhenAvailable `
                -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
            $principal = New-ScheduledTaskPrincipal `
                -UserId "$env:USERDOMAIN\$env:USERNAME" `
                -LogonType Interactive -RunLevel Limited
            Register-ScheduledTask -TaskName "Preppy" `
                -Action $action -Trigger $trigger `
                -Settings $settings -Principal $principal `
                -Description "Preppy Label Management System" -Force | Out-Null
            Log "  Task registered for: $env:USERNAME (launches in kiosk mode)"

            Log ""
            Log "=== Creating shortcuts ==="
            $wsh = New-Object -ComObject WScript.Shell

            # Desktop shortcut (all users)
            $lnkDesktop = $wsh.CreateShortcut("$env:PUBLIC\Desktop\Preppy.lnk")
            $lnkDesktop.TargetPath       = $exePath
            $lnkDesktop.WorkingDirectory = $o.InstallDir
            $lnkDesktop.Description      = "Preppy Label Management System"
            $lnkDesktop.Save()
            Log "  Desktop shortcut: $env:PUBLIC\Desktop\Preppy.lnk"

            # Taskbar pin (best-effort — may not work on all Windows 10 builds)
            try {
                $shell2 = New-Object -ComObject Shell.Application
                $folder  = $shell2.Namespace($o.InstallDir)
                $item    = $folder.ParseName((Split-Path $exePath -Leaf))
                $pinVerb = $item.Verbs() | Where-Object { $_.Name -replace '&','' -match 'Pin to taskbar' }
                if ($pinVerb) { $pinVerb.DoIt(); Log "  Taskbar: pinned" }
                else          { Log "  Taskbar: pin verb not available on this build (skipped)" }
            } catch {
                Log "  Taskbar: could not pin (non-fatal): $_"
            }

            Log ""
            Log "=== Launching Preppy ==="
            Start-Process -FilePath $exePath
            Log "  Preppy launched."

            Log ""
            Log "=== Setup complete ==="

        } catch {
            Write-Error $_ -ErrorAction Continue
        }
    }

    $script:job = Start-Job -ScriptBlock $installBlock -ArgumentList $opts

    $script:pollTimer          = New-Object System.Windows.Forms.Timer
    $script:pollTimer.Interval = 200
    $script:pollTimer.Add_Tick({
        $lines = @(Receive-Job $script:job 2>&1)
        foreach ($l in $lines) {
            $logBox.AppendText("$l`r`n")
            Add-Content -Path $LOG_FILE -Value $l -Encoding utf8
        }
        if ($lines.Count -gt 0) { $logBox.ScrollToCaret() }

        if ($script:job.State -notin @('Running', 'NotStarted')) {
            $script:pollTimer.Stop()

            $lines = @(Receive-Job $script:job 2>&1)
            foreach ($l in $lines) {
                $logBox.AppendText("$l`r`n")
                Add-Content -Path $LOG_FILE -Value $l -Encoding utf8
            }
            $logBox.ScrollToCaret()

            $errors = @($script:job.ChildJobs | ForEach-Object { $_.Error })
            Remove-Job $script:job -Force -ErrorAction SilentlyContinue

            if ($script:job.State -eq 'Completed' -and $errors.Count -eq 0) {
                $progBar.Style         = [System.Windows.Forms.ProgressBarStyle]::Blocks
                $progBar.Value         = 100
                $lStatus.Text          = "Installation complete!"
                $lStatus.ForeColor     = $C_SUCCESS
                $script:doneAction     = 'restart'
                $btnNext.Text          = "Restart Now"
                $btnNext.Enabled       = $true
            } else {
                foreach ($e in $errors) {
                    $logBox.AppendText("`r`nERROR: $($e.Exception.Message)`r`n")
                    Add-Content -Path $LOG_FILE -Value "ERROR: $($e.Exception.Message)" -Encoding utf8
                }
                $logBox.ScrollToCaret()
                $progBar.Style         = [System.Windows.Forms.ProgressBarStyle]::Blocks
                $lStatus.Text          = "Installation failed -- see log for details"
                $lStatus.ForeColor     = $C_DANGER
                $script:doneAction     = 'close'
                $btnNext.Text          = "Close"
                $btnNext.Enabled       = $true
                $logBox.AppendText("`r`nFull log saved to: $LOG_FILE`r`n")
            }
        }
    })
    $script:pollTimer.Start()
}

# -- Launch -------------------------------------------------------------------
[System.Windows.Forms.Application]::Run($form)
