@echo off
rem Lance un serveur local puis ouvre le jeu dans le navigateur.
cd /d "%~dp0"
set PORT=8642

where py >nul 2>nul
if %errorlevel%==0 (
  set PYTHON=py
) else (
  set PYTHON=python
)

start "" "http://localhost:%PORT%/"
echo Serveur du jeu sur http://localhost:%PORT%/  (fermez cette fenetre pour l'arreter)
%PYTHON% -m http.server %PORT% --bind 127.0.0.1
