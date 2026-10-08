@echo off
setlocal EnableExtensions DisableDelayedExpansion
pushd "%~dp0" >nul 2>&1
if errorlevel 1 exit /b 1
if not exist package.json goto :missing_project
where node.exe >nul 2>&1
if errorlevel 1 goto :missing_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto :missing_node

echo Store Maker: http://127.0.0.1:4330
if /I "%~1"=="--check" (
  if not exist node_modules\.bin\vite.cmd echo Dependency akan dipasang otomatis saat dijalankan.
  echo Prasyarat Store Maker tersedia.
  popd
  exit /b 0
)

title Store Maker
set "NODE_ENV=development"
if not exist node_modules\.bin\vite.cmd (
  echo Memasang dependency Store Maker...
  call npm.cmd ci
  if errorlevel 1 goto :failed
)
echo Tekan Ctrl+C untuk menghentikan server.
call npm.cmd run dev
if errorlevel 1 goto :failed
popd
exit /b 0

:missing_project
echo package.json Store Maker tidak ditemukan.
goto :failed
:missing_node
echo Node.js dan npm perlu dipasang terlebih dahulu. Gunakan Node.js 24.
:failed
echo Store Maker gagal dijalankan. Periksa pesan di atas.
if /I not "%~1"=="--check" pause
popd
exit /b 1
