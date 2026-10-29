@echo off
rem Startet Dulidan Radar aus dem Quellcode. Einfach doppelklicken.
chcp 65001 >nul
cd /d "%~dp0"
title Dulidan Radar

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js fehlt noch. Bitte installiere die LTS-Version von https://nodejs.org
  echo und starte diese Datei danach noch einmal.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Erster Start: Ich lade einmalig die Bausteine. Das dauert ein paar Minuten ...
  call npm install
  if errorlevel 1 goto fehler
)

echo Radar startet ...
call npm run dev --workspace @dulidan/radar
exit /b 0

:fehler
echo.
echo Da ist etwas schiefgelaufen. Die Meldung oben hilft bei der Fehlersuche.
pause
exit /b 1
