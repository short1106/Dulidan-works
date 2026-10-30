@echo off
rem Startet Ledger wie beim allerersten Mal (Start-Animation und Moduswahl),
rem in einem eigenen Test-Ordner. Deine echten Einstellungen bleiben unberuehrt.
chcp 65001 >nul
cd /d "%~dp0"
set "LEDGER_USER_DATA=%TEMP%\Dulidan-Ledger-Test-%RANDOM%"
call "Ledger starten.bat"
