@echo off
title Dulidan Akquise
cd /d "%~dp0"
python -c "import flask, requests, certifi" 2>nul || python -m pip install -r requirements.txt
python app.py
pause
