@echo off
echo Checking JS files...
cd /d "C:\Users\15840\.openclaw\workspace\short-drama-agent"

echo.
echo ===== index.html =====
findstr /n "script src" frontend\index.html | findstr ".js"

echo.
echo ===== Checking AssetManager.js =====
findstr /n "template\|mounted\|components\|methods\|data()" frontend\components\AssetManager.js | findstr /n . | findstr /c:"template:" /c:"data()" /c:"methods:"

echo.
echo ===== Checking app.js init =====
findstr /n "createApp\|\.mount\|\.component" frontend\app.js

echo.
echo Done.
