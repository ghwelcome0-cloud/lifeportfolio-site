# ASCII-only launcher. Usage: powershell -ExecutionPolicy Bypass -File runs\run-r4.ps1
Set-Location (Join-Path $PSScriptRoot "..")
node runs\run-r4.cjs
