@echo off
title Sistema ASO/PCMSO - Clinica Pierro
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo.
  echo [ERRO] O Node.js nao foi encontrado neste computador.
  echo Baixe e instale a versao LTS em: https://nodejs.org/
  echo Depois de instalar, execute este arquivo novamente.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Preparando o sistema pela primeira vez, aguarde...
  call npm install --no-audit --no-fund
)

echo.
echo Iniciando o sistema... o navegador vai abrir automaticamente.
echo Para encerrar o sistema, feche esta janela.
echo.
call npm start
pause
