@echo off
REM RCRT Database Reset Script
REM Purges all data and rebootstraps

echo.
echo ========================================
echo RCRT Database Reset
echo ========================================
echo.
echo This will DELETE ALL DATA including:
echo - All breadcrumbs
echo - All chat sessions
echo - All notes
echo - All agents
echo.
pause
echo.

echo [1/5] Stopping services...
podman compose down

echo.
echo [2/5] Removing PostgreSQL volume (deleting database)...
podman volume rm thinkos-1_postgres-data

echo.
echo [3/5] Starting services with fresh database...
podman compose up -d

echo.
echo [4/5] Waiting for services to be ready (30 seconds)...
timeout /t 30 /nobreak

echo.
echo [5/5] Running bootstrap...
podman compose exec bootstrap-runner node /app/bootstrap.js

echo.
echo Restarting tools-runner to load catalog...
podman compose restart tools-runner

echo.
echo ========================================
echo Database reset complete!
echo ========================================
echo.
echo Next steps:
echo 1. Reload browser extension (chrome://extensions/)
echo 2. Open extension - should show no sessions
echo 3. Start fresh chat
echo.
pause


