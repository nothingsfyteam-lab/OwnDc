@echo off
cls
echo ============================================
echo   OwnDc - GitHub Push Helper
echo ============================================
echo.

REM Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git is not installed!
    echo.
    echo Please install Git first:
    echo https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

echo [OK] Git is installed
echo.

REM Initialize git if not already done
if not exist .git (
    echo [Step 1/5] Initializing Git repository...
    git init
    echo.
) else (
    echo [OK] Git repository already initialized
    echo.
)

REM Check git config
for /f "tokens=*" %%a in ('git config user.name') do set GIT_NAME=%%a
for /f "tokens=*" %%a in ('git config user.email') do set GIT_EMAIL=%%a

if "%GIT_NAME%"=="" (
    echo [Step 2/5] Setting up Git configuration...
    echo.
    set /p GIT_NAME="Enter your name: "
    set /p GIT_EMAIL="Enter your email: "
    git config user.name "%GIT_NAME%"
    git config user.email "%GIT_EMAIL%"
    echo.
) else (
    echo [OK] Git config: %GIT_NAME% ^<%GIT_EMAIL%^>
    echo.
)

REM Add files
echo [Step 3/5] Adding files to staging area...
git add .
echo [OK] Files added
echo.

REM Commit
echo [Step 4/5] Creating commit...
git commit -m "Initial commit: OwnDc Discord-like chat platform"
echo [OK] Commit created
echo.

REM Check if remote exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [Step 5/5] Setting up GitHub remote...
    echo.
    echo ============================================
    echo   IMPORTANT: Complete these steps:
    echo ============================================
    echo.
    echo 1. Go to: https://github.com/new
    echo 2. Create a new repository named 'owndc'
    echo 3. Choose Public or Private
    echo 4. Click "Create repository"
    echo 5. Copy the HTTPS URL (green button)
    echo    It looks like: https://github.com/USERNAME/owndc.git
    echo.
    set /p REPO_URL="Paste the URL here: "
    echo.
    git remote add origin %REPO_URL%
    git branch -M main
    git push -u origin main
    echo.
) else (
    echo [Step 5/5] Pushing to GitHub...
    git push -u origin main
    echo.
)

if %errorlevel% == 0 (
    echo ============================================
    echo   SUCCESS! Project pushed to GitHub! 🎉
    echo ============================================
    echo.
    for /f "tokens=*" %%a in ('git remote get-url origin') do set REPO_URL=%%a
    echo Repository URL: %REPO_URL%
    echo.
    echo Next steps:
    echo - Visit your repository on GitHub
    echo - Follow DEPLOYMENT.md to deploy your app
    echo.
) else (
    echo ============================================
    echo   [ERROR] Push failed!
    echo ============================================
    echo.
    echo Common fixes:
    echo 1. Check your internet connection
    echo 2. Verify your GitHub username/password
    echo 3. If using password, use a Personal Access Token instead:
    echo    https://github.com/settings/tokens
    echo.
)

pause
