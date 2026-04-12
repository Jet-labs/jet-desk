$ErrorActionPreference = "Stop"

# Get the directory of the script and resolve the root workspace
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$WorkspaceRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$DownloadablesDir = Join-Path $WorkspaceRoot "downloadables"

Write-Host "JetDesk Universal Builder" -ForegroundColor Magenta
Write-Host "--------------------------" -ForegroundColor Magenta

if (!(Test-Path $DownloadablesDir)) {
    Write-Host "Creating downloadables directory..." -ForegroundColor Gray
    New-Item -ItemType Directory -Force -Path $DownloadablesDir | Out-Null
} else {
    Write-Host "Cleaning downloadables directory..." -ForegroundColor Gray
    Remove-Item -Path "$DownloadablesDir\*" -Force -Recurse
}

# ==========================================
# 1. Compile Daemon executable
# ==========================================
Write-Host "`n[1/2] Building Daemon Executable..." -ForegroundColor Cyan
Set-Location (Join-Path $WorkspaceRoot "daemon")
cmd.exe /c "npm run build:exe"

$DaemonExeSrc = Join-Path $WorkspaceRoot "daemon\JetDeskDaemon.exe"
if (Test-Path $DaemonExeSrc) {
    Copy-Item -Path $DaemonExeSrc -Destination $DownloadablesDir -Force
    Write-Host "SUCCESS: Copied JetDeskDaemon.exe to downloadables" -ForegroundColor Green
} else {
    Write-Host "ERROR: Daemon build failed, JetDeskDaemon.exe not found." -ForegroundColor Red
}

# ==========================================
# 2. Compile Mobile App APK
# ==========================================
Write-Host "`n[2/2] Building Mobile App APK..." -ForegroundColor Cyan
Set-Location (Join-Path $WorkspaceRoot "app\android")
cmd.exe /c "gradlew.bat assembleRelease"

$AppApkSrc = Join-Path $WorkspaceRoot "app\android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $AppApkSrc) {
    Copy-Item -Path $AppApkSrc -Destination (Join-Path $DownloadablesDir "JetDeskApp.apk") -Force
    Write-Host "SUCCESS: Copied JetDeskApp.apk to downloadables" -ForegroundColor Green
} else {
    $AppApkSrcDebug = Join-Path $WorkspaceRoot "app\android\app\build\outputs\apk\release\app-release-unsigned.apk"
    if (Test-Path $AppApkSrcDebug) {
        Copy-Item -Path $AppApkSrcDebug -Destination (Join-Path $DownloadablesDir "JetDeskApp.apk") -Force
        Write-Host "SUCCESS: Copied JetDeskApp.apk (unsigned release) to downloadables" -ForegroundColor Green
    } else {
        Write-Host "ERROR: APK build failed, app-release.apk not found." -ForegroundColor Red
    }
}

Set-Location $WorkspaceRoot
Write-Host "`nBuild process complete! Files are available in the ./downloadables/ directory." -ForegroundColor Magenta
explorer.exe $DownloadablesDir
