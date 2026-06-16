# Sets up (or tears down) the visual QA scenario:
#   a journée TODAY with TWO overlapping 10:00-11:00 activities, then an
#   activity title edit, then the journée switched to PRESELECTION.
# Usage:  .\qa-visual-setup.ps1            -> setup + checks (prints SESSION_ID / PROG_ID)
#         .\qa-visual-setup.ps1 -Teardown -SessionId N -ProgId M
param([switch]$Teardown, [long]$SessionId = 0, [long]$ProgId = 0)
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080'
$login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' `
  -Body (@{ email = 'admin@medianet.dz'; password = 'Admin1234!' } | ConvertTo-Json)
$token = $login.token; if (-not $token) { $token = $login.accessToken }
$H = @{ Authorization = "Bearer $token" }

if ($Teardown) {
  Invoke-RestMethod -Method Delete -Uri "$base/api/programmes/$ProgId/phases/$SessionId" -Headers $H | Out-Null
  Write-Output "TEARDOWN OK (session $SessionId removed)"
  exit 0
}

# Use the first existing programme so the timeline page has real context.
$progs = Invoke-RestMethod -Uri "$base/api/programmes" -Headers $H
$prog = $progs | Select-Object -First 1
if (-not $prog) { throw 'no programme found' }
$today = (Get-Date).ToString('yyyy-MM-dd')

$s = Invoke-RestMethod -Method Post -Uri "$base/api/programmes/$($prog.id)/phases" -Headers $H -ContentType 'application/json' `
  -Body (@{ title = 'QA Visuel'; durationKind = 'day'; startDate = $today; endDate = $today; color = '#6366F1' } | ConvertTo-Json)
$day = Invoke-RestMethod -Method Post -Uri "$base/api/programmes/$($prog.id)/sessions/$($s.id)/days" -Headers $H -ContentType 'application/json' `
  -Body (@{ dayOrder = 1; date = $today } | ConvertTo-Json)
$a1 = Invoke-RestMethod -Method Post -Uri "$base/api/programmes/$($prog.id)/sessions/$($s.id)/days/$($day.id)/activities" -Headers $H -ContentType 'application/json' `
  -Body (@{ title = 'Atelier A'; startTime = '10:00'; endTime = '11:00'; color = '#EC4899' } | ConvertTo-Json)
$a2 = Invoke-RestMethod -Method Post -Uri "$base/api/programmes/$($prog.id)/sessions/$($s.id)/days/$($day.id)/activities" -Headers $H -ContentType 'application/json' `
  -Body (@{ title = 'Atelier B'; startTime = '10:00'; endTime = '11:00'; color = '#F59E0B' } | ConvertTo-Json)

# Edit A's title (the "close/reopen keeps the edit" check) then re-read.
$null = Invoke-RestMethod -Method Put -Uri "$base/api/programmes/$($prog.id)/sessions/$($s.id)/days/$($day.id)/activities/$($a1.id)" -Headers $H -ContentType 'application/json' `
  -Body (@{ title = 'Atelier A renomme' } | ConvertTo-Json)
$list = Invoke-RestMethod -Uri "$base/api/programmes/$($prog.id)/sessions" -Headers $H
$sL = $list | Where-Object { $_.id -eq $s.id }
$acts = @($sL.days[0].activities)
$renamed = $acts | Where-Object { $_.title -eq 'Atelier A renomme' }
$overlap = @($acts | Where-Object { ("" + $_.startTime) -like '10:00*' }).Count

# Switch the journée to Evaluation (tabs Fonction/Agenda in the overlay).
$s2 = Invoke-RestMethod -Method Put -Uri "$base/api/programmes/$($prog.id)/phases/$($s.id)" -Headers $H -ContentType 'application/json' `
  -Body (@{ sessionType = 'PRESELECTION' } | ConvertTo-Json)

Write-Output ("CHECK rename persisted after refetch : " + $(if ($renamed) { 'PASS' } else { 'FAIL' }))
Write-Output ("CHECK 2 activities same hour (10:00) : " + $(if ($overlap -eq 2) { 'PASS' } else { "FAIL ($overlap)" }))
Write-Output ("CHECK journee fonction = PRESELECTION : " + $(if ($s2.sessionType -eq 'PRESELECTION') { 'PASS' } else { "FAIL ($($s2.sessionType))" }))
Write-Output "PROG_ID=$($prog.id)"
Write-Output "SESSION_ID=$($s.id)"
Write-Output "TIMELINE_URL=http://localhost:3001/programmes/$($prog.id)/timeline"
