@echo off

REM build-all-tools.bat - cross-compile all tools for Linux



set OUTDIR=D:\07_Projects\code\Oxelia51\release\tools

if not exist "%OUTDIR%" mkdir "%OUTDIR%"



set GOOS=linux

set GOARCH=amd64

set CGO_ENABLED=0



echo [1/6] SuperRead...

cd /d D:\07_Projects\code\SuperRead

go build -ldflags="-s -w" -o "%OUTDIR%\superread-server" .\cmd\server || goto :fail

echo   OK



echo [2/6] MusicBox...

cd /d D:\07_Projects\code\MusicBox

go build -ldflags="-s -w" -o "%OUTDIR%\musicbox-server" .\cmd\server || goto :fail

echo   OK



echo [3/6] CS2Lab...

cd /d D:\07_Projects\code\CS2Lab

go build -ldflags="-s -w" -o "%OUTDIR%\cs2lab-server" .\cmd\server || goto :fail

echo   OK



echo [4/6] AIHelper...

cd /d D:\07_Projects\code\AIHelper

go build -ldflags="-s -w" -o "%OUTDIR%\aihelper-server" .\cmd\server || goto :fail

echo   OK



echo [5/6] AgentCanvas...

cd /d D:\07_Projects\code\AgentCanvas

go build -ldflags="-s -w" -o "%OUTDIR%\agentcanvas-server" .\cmd\server || goto :fail

echo   OK



echo [6/6] SecretStore...

cd /d D:\07_Projects\code\SecretStore

go build -ldflags="-s -w" -o "%OUTDIR%\secretstore-server" .\cmd\server || goto :fail

echo   OK



echo.

echo.
echo Creating tools.zip...
cd /d "%OUTDIR%"
if exist ..\tools.zip del ..\tools.zip
powershell -Command "Compress-Archive -Path * -DestinationPath ..\tools.zip"
echo   tools.zip created at release\tools.zip
echo.
echo Done! Upload release\tools.zip to server /opt/tools/ via Workbench

goto :eof



:fail

echo FAILED

pause

exit /b 1

