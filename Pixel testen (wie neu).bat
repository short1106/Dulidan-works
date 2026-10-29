@echo off
rem Startet Pixel wie beim allerersten Mal (Start-Animation und Moduswahl),
rem in einem eigenen Test-Ordner. Deine echten Einstellungen bleiben unberuehrt.
chcp 65001 >nul
cd /d "%~dp0"
set "PIXEL_USER_DATA=%TEMP%\Dulidan-Pixel-Test-%RANDOM%"
call "Pixel starten.bat"
