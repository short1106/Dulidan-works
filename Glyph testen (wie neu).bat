@echo off
rem Startet Glyph wie beim allerersten Mal (mit Moduswahl), in einem
rem eigenen Test-Ordner. Deine echten Einstellungen bleiben unberuehrt.
chcp 65001 >nul
cd /d "%~dp0"
set "GLYPH_USER_DATA=%TEMP%\Dulidan-Glyph-Test-%RANDOM%"
call "Glyph starten.bat"
