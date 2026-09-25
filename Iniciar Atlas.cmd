@echo off
chcp 65001 >nul
title Atlas
cd /d "%~dp0atlas"
if not exist node_modules (
  echo Instalando dependencias por primera vez...
  call npm ci
  if errorlevel 1 goto error
)
node scripts\needs-build.mjs
if errorlevel 1 (
  echo Preparando Atlas...
  call npm run build
  if errorlevel 1 goto error
)
echo.
echo Atlas se abre en http://localhost:5173/
echo Tus datos se guardan en atlas\userdata\ (con copias automaticas).
echo Para cerrar Atlas, cierra esta ventana o pulsa Ctrl+C.
echo.
start "" /min cmd /c "timeout /t 2 >nul & start http://localhost:5173/"
call npm start
goto fin
:error
echo.
echo Algo ha fallado. Revisa los mensajes de arriba.
pause
:fin
