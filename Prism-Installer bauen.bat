@echo off
rem Baut den Windows-Installer (Setup-Datei) fuer Prism auf diesem Rechner.
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run dist:win:prism
if errorlevel 1 (
  pause
  exit /b 1
)
echo.
echo Fertig. Die Setup-Datei liegt in apps\prism\release
explorer "apps\prism\release"
pause
