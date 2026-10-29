@echo off
rem Startet Relay wie beim allerersten Mal (Start-Animation und Moduswahl),
rem in einem eigenen Test-Ordner. Deine echten Einstellungen bleiben unberuehrt.
chcp 65001 >nul
cd /d "%~dp0"
set "RELAY_USER_DATA=%TEMP%\Dulidan-Relay-Test-%RANDOM%"
call "Relay starten.bat"
