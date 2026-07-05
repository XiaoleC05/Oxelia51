# Oxelia51 backend dev launcher (Windows PowerShell)
# Usage: .\scripts\dev-backend.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if (-not $env:GOPROXY) {
    $env:GOPROXY = "https://goproxy.cn,direct"
}

$goCandidates = @(
    "D:\01_DevTools\Go\go1.26.4\bin\go.exe",
    "C:\Program Files\Go\bin\go.exe"
)

$go = $null
foreach ($candidate in $goCandidates) {
    if (Test-Path $candidate) {
        $go = $candidate
        break
    }
}

if (-not $go) {
    $cmd = Get-Command go -ErrorAction SilentlyContinue
    if ($cmd) {
        $go = $cmd.Source
    }
}

if (-not $go) {
    Write-Host "[ERROR] Go not found. Expected: D:\01_DevTools\Go\go1.26.4\bin\go.exe" -ForegroundColor Red
    exit 1
}

if (-not $env:GOROOT -and (Test-Path "D:\01_DevTools\Go\go1.26.4")) {
    $env:GOROOT = "D:\01_DevTools\Go\go1.26.4"
}

Write-Host ("Go: " + (& $go version)) -ForegroundColor Green

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
    Set-Location $Root
    Write-Host "Starting PostgreSQL + Redis (docker compose)..." -ForegroundColor Cyan
    docker compose up -d
} else {
    Write-Host "[WARN] Docker not found. Start PostgreSQL 17 + Redis 7 manually, or install Docker Desktop." -ForegroundColor Yellow
}

Set-Location (Join-Path $Root "backend")
Write-Host "Running go mod tidy..." -ForegroundColor Cyan
& $go mod tidy

Write-Host "Starting backend at http://localhost:8080 ..." -ForegroundColor Cyan
& $go run ./cmd/server