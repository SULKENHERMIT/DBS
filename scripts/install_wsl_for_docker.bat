@echo off
:: ============================================================================
:: install_wsl_for_docker.bat
:: Fix Docker Desktop: Install Windows Subsystem for Linux (WSL 2)
:: IMPORTANT: Right-click this file and select "Run as administrator"
:: ============================================================================

title Docker Desktop WSL Installer
color 0A

echo ============================================================================
echo   FIXING DOCKER DESKTOP: INSTALLING WSL 2 ENGINE
echo ============================================================================
echo.
echo Checking for Administrator privileges...
net session >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] This script requires Administrator privileges.
    echo Please right-click this file and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)

echo [OK] Running as Administrator.
echo.
echo Step 1 of 2: Installing Windows Subsystem for Linux (WSL)...
wsl.exe --install --no-launch

echo.
echo Step 2 of 2: Updating WSL components to latest version...
winget install Microsoft.WSL --accept-package-agreements --accept-source-agreements

echo.
echo ============================================================================
echo   INSTALLATION COMPLETED!
echo ============================================================================
echo.
echo 1. If Windows prompts you to restart, please REBOOT your computer.
echo 2. After rebooting, launch Docker Desktop.
echo    The "Starting the Docker Engine..." spinner will turn green and be ready!
echo.
pause
