@echo off
cd /d "c:\src\portfolio-engineering\portfolio-engineering"
node --test --experimental-strip-types "apps\frontend\src\sessionState.test.ts"
echo.
echo EXIT_CODE=%ERRORLEVEL%
