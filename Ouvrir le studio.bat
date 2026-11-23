@echo off
rem Windows : double-clique ce fichier pour ouvrir le dashboard du studio dans ton navigateur.
rem Pour l arreter : ferme cette fenetre.
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable. Installe-le avec : winget install -e --id OpenJS.NodeJS.LTS
  echo Puis ferme cette fenetre et relance ce fichier.
  pause
  exit /b 1
)
if not exist node_modules\hyperframes call npm install --no-fund --no-audit
node dashboard\serveur.mjs --ouvrir
pause
