@echo off
rem Baut den Windows-Installer (Setup-Datei) fuer Radar auf diesem Rechner.
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run dist:win:radar
if errorlevel 1 (
  pause
  exit /b 1
)
echo.
echo Fertig. Die Setup-Datei liegt in apps\radar\release
explorer "apps\radar\release"
pause
