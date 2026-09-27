<#
  HalalSecure frontend: Angular live reload at http://localhost:4200/app/ (backend must run on :8000 for /api)
  Usage (in the frontend folder):   .\serve.ps1
  Uses this project's Angular CLI 22 by full path, never the global Angular CLI 14 (Tawasul).
#>
. (Join-Path $PSScriptRoot '..\dev.ps1')
Set-Location $PSScriptRoot
& (Join-Path $PSScriptRoot 'node_modules\.bin\ng.cmd') serve
