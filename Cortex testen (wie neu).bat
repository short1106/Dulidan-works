@echo off
rem Startet Cortex wie beim allerersten Mal (Start-Animation und Moduswahl),
rem mit eigenen Einstellungen und einer Kopie der Beispielnotizen.
rem Deine echten Notizen und Einstellungen bleiben unberuehrt.
chcp 65001 >nul
cd /d "%~dp0"
set "CORTEX_TEST=%TEMP%\Dulidan-Cortex-Test-%RANDOM%"
set "CORTEX_USER_DATA=%CORTEX_TEST%\Einstellungen"
set "CORTEX_NOTES_DIR=%CORTEX_TEST%\Notizen"
xcopy /E /I /Q "apps\cortex\test\beispiel-notizen" "%CORTEX_NOTES_DIR%" >nul
call "Cortex starten.bat"
