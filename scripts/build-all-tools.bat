@echo off

REM build-all-tools.bat - cross-compile tools for Linux



set OUTDIR=D:\07_Projects\code\Oxelia51\release\tools

if not exist "%OUTDIR%" mkdir "%OUTDIR%"



set GOOS=linux

set GOARCH=amd64

set CGO_ENABLED=0



echo [1/1] SecretStore...

cd /d D:\07_Projects\code\SecretStore

go build -ldflags="-s -w" -o "%OUTDIR%\secretstore-server" .\cmd\server || goto :fail

echo   OK



echo.

echo Creating tools.zip...
cd /d "%OUTDIR%"
if exist ..\tools.zip del ..\tools.zip
powershell -Command "Compress-Archive -Path * -DestinationPath ..\tools.zip"
echo   tools.zip created at release\tools.zip
echo Done! Upload release\tools.zip to server /opt/tools/ via Workbench

goto :eof



:fail

echo FAILED

pause

exit /b 1

