@echo off
rem Startet Radar wie beim allerersten Mal (Start-Animation und Moduswahl),
rem in einem eigenen Test-Ordner. Deine echten Einstellungen bleiben unberuehrt.
chcp 65001 >nul
cd /d "%~dp0"
set "RADAR_USER_DATA=%TEMP%\Dulidan-Radar-Test-%RANDOM%"
call "Radar starten.bat"
