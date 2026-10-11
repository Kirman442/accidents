@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run_binary.ps1" %*
set "UAD_EXPORT_EXIT=%ERRORLEVEL%"
echo.
if not "%UAD_EXPORT_EXIT%"=="0" echo Export failed. Read the error above.
pause
exit /b %UAD_EXPORT_EXIT%
