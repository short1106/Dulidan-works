@echo off
rem Startet Prism wie beim allerersten Mal (Start-Animation und Moduswahl),
rem in einem eigenen Test-Ordner. Deine echten Einstellungen bleiben unberuehrt.
chcp 65001 >nul
cd /d "%~dp0"
set "PRISM_USER_DATA=%TEMP%\Dulidan-Prism-Test-%RANDOM%"
call "Prism starten.bat"
