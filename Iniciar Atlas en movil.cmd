@echo off
chcp 65001 >nul
title Atlas (red local)
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
echo Atlas queda disponible en este PC (http://localhost:5173/) y en tu red local.
echo Abre en el movil la direccion que aparece abajo (misma wifi que el PC).
echo El PC debe seguir encendido y esta ventana abierta.
echo.
call npm run mobile
goto fin
:error
echo.
echo Algo ha fallado. Revisa los mensajes de arriba.
pause
:fin
