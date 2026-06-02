@echo off
setlocal
cd /d "%~dp0"

set "PORT=4173"

start "InterviewPrep AI Server" /min py -m http.server %PORT%
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:%PORT%/
