@echo off
chcp 65001 >nul
title Gerar EXE - ASO/PCMSO
cd /d "%~dp0"

REM Gera o .exe. Precisa de Node.js NESTA maquina de desenvolvimento.
REM O .exe gerado NAO precisa de Node no PC da clinica.

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERRO] Para GERAR o .exe e preciso ter Node.js instalado nesta maquina.
  echo Baixe a versao LTS em: https://nodejs.org/
  echo.
  echo Se voce so quer USAR o sistema ^(sem gerar de novo^):
  echo   execute Iniciar_Sistema.bat  OU  va na pasta "dist" e execute Iniciar.bat
  echo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERRO] npm nao encontrado. Reinstale o Node.js LTS.
  pause
  exit /b 1
)

if not exist "dist" mkdir "dist"

echo Instalando dependencias ^(se necessario^)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo [ERRO] Falha no npm install. Verifique sua conexao com a internet.
  pause
  exit /b 1
)

echo.
echo Gerando executavel ^(pode levar 1-2 minutos^)...
call npm run build:win
if errorlevel 1 (
  echo.
  echo [ERRO] Falha no build do executavel.
  echo Dica: feche antivirus temporariamente ou libere a pasta do projeto.
  pause
  exit /b 1
)

if not exist "dist\ASO-PCMSO-ClinicaPierro.exe" (
  echo.
  echo [ERRO] O arquivo dist\ASO-PCMSO-ClinicaPierro.exe nao foi criado.
  pause
  exit /b 1
)

if not exist "dist\Iniciar.bat" (
  echo [AVISO] dist\Iniciar.bat nao encontrado. Crie manualmente ou copie do projeto.
)

if not exist "dist\LEIA-ME.txt" (
  echo [AVISO] dist\LEIA-ME.txt nao encontrado. Crie manualmente ou copie do projeto.
)

echo.
echo ==============================================
echo  Pronto: dist\ASO-PCMSO-ClinicaPierro.exe
echo ==============================================
echo.
echo Para levar para outro PC ^(SEM instalar Node^):
echo   copie a pasta dist inteira  ^(exe + Iniciar.bat + LEIA-ME.txt^)
echo.
pause
