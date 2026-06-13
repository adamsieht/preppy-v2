@echo off
setlocal

:: Check for administrator privileges
net session >nul 2>&1
if %errorlevel% equ 0 goto :run

:: Not elevated — re-launch this script with UAC prompt
echo Requesting administrator access...
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command ^
    "Start-Process -FilePath cmd.exe -ArgumentList '/c \"%~f0\"' -Verb RunAs"
exit /b

:run
:: Launch the wizard with execution policy bypass (fixes "scripts disabled" error)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-wizard.ps1"

endlocal
