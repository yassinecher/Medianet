# Non-regression QA — run after any build/deploy:
#   1) TypeScript check of both frontends
#   2) API session-type suite against the running stack (gateway :8080)
# Exits non-zero on any failure → usable in CI or a git hook.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failed = 0

Write-Output '== 1/3 typecheck backoffice =='
Push-Location "$root\frontend\nextjs-backoffice"
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { $failed++ ; Write-Output 'FAIL backoffice tsc' } else { Write-Output 'PASS' }
Pop-Location

Write-Output '== 2/3 typecheck frontoffice =='
Push-Location "$root\frontend\nextjs-frontoffice"
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { $failed++ ; Write-Output 'FAIL frontoffice tsc' } else { Write-Output 'PASS' }
Pop-Location

Write-Output '== 3/3 API session-type suite =='
$out = & "$root\.claude\qa-session-types.ps1"
$out | ForEach-Object { Write-Output $_ }
if (($out | Where-Object { $_ -like 'FAIL*' -or $_ -like 'ABORT*' }).Count -gt 0) { $failed++ }

Write-Output "=== QA done — $failed phase(s) en echec ==="
exit $failed
