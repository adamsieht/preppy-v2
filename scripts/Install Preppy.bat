@echo off
:: Preppy Setup Wizard launcher
:: Passes -ExecutionPolicy Bypass so the wizard always loads regardless of
:: the system's script execution policy.  The wizard itself handles the
:: UAC elevation prompt if administrator rights are needed.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-wizard.ps1"

:: Keep window open so any startup error messages remain visible.
if %errorlevel% neq 0 (
    echo.
    echo Setup exited with an error ^(code %errorlevel%^).
    echo Log file: %TEMP%\preppy-setup.log
    pause
)
