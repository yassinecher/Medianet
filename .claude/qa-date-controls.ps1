# QA — server-side date controls on the 3 session shapes.
# Asserts the backend ACCEPTS valid date updates and REJECTS (400) invalid ones.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080'
$results = New-Object System.Collections.Generic.List[string]
function Check($name, $cond, $detail) {
  if ($cond) { $script:results.Add("PASS  $name") } else { $script:results.Add("FAIL  $name :: $detail") }
}
function StatusOf([scriptblock]$call) {
  try { & $call | Out-Null; return 200 }
  catch { $r = $_.Exception.Response; if ($r -and $r.StatusCode) { return [int]$r.StatusCode } else { return -1 } }
}
$today = Get-Date
function D($n) { $today.AddDays($n).ToString('yyyy-MM-dd') }
$pid_ = 0
try {
  $login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' `
    -Body (@{ email = 'admin@medianet.dz'; password = 'Admin1234!' } | ConvertTo-Json)
  $H = @{ Authorization = "Bearer $($login.token)" }

  $prog = Invoke-RestMethod -Method Post -Uri "$base/api/programmes" -Headers $H -ContentType 'application/json' `
    -Body (@{ title = 'QA Dates'; type = 'PUBLIC'; status = 'DRAFT' } | ConvertTo-Json)
  $pid_ = $prog.id
  function NewS($b) { Invoke-RestMethod -Method Post -Uri "$base/api/programmes/$pid_/phases" -Headers $H -ContentType 'application/json' -Body ($b | ConvertTo-Json) }
  function Upd($id, $b) { Invoke-RestMethod -Method Put -Uri "$base/api/programmes/$pid_/phases/$id" -Headers $H -ContentType 'application/json' -Body ($b | ConvertTo-Json) }
  function UpdCode($id, $b) { StatusOf { Invoke-RestMethod -Method Put -Uri "$base/api/programmes/$pid_/phases/$id" -Headers $H -ContentType 'application/json' -Body ($b | ConvertTo-Json) } }

  # ── RANGE ──
  $r = NewS @{ title = 'Plage'; durationKind = 'range'; startDate = (D 0); endDate = (D 20) }
  Check 'range cree' ($r.id -gt 0) ''
  $ok = Upd $r.id @{ startDate = (D 2); endDate = (D 18) }
  Check 'range: resserrer dates valides -> 200' ($ok.startDate -eq (D 2) -and $ok.endDate -eq (D 18)) ''
  $code = UpdCode $r.id @{ startDate = (D 19); endDate = (D 5) }
  Check 'range: debut > fin -> 400' ($code -eq 400) "code=$code"

  # ── DAY (standalone) ──
  $d = NewS @{ title = 'Journee'; durationKind = 'day'; startDate = (D 3); endDate = (D 9) }
  Check 'day: end force = start a la creation' ($d.startDate -eq (D 3) -and $d.endDate -eq (D 3)) ("end=" + $d.endDate)
  $d2 = Upd $d.id @{ startDate = (D 7); endDate = (D 12) }
  Check 'day: update normalise end = start' ($d2.startDate -eq (D 7) -and $d2.endDate -eq (D 7)) ("end=" + $d2.endDate)

  # ── DAY inside RANGE (nested) ──
  $parent = NewS @{ title = 'Parent'; durationKind = 'range'; startDate = (D 0); endDate = (D 10) }
  $child = NewS @{ title = 'Jour imbrique'; durationKind = 'day'; startDate = (D 5); endDate = (D 5); parentSessionId = $parent.id }
  Check 'nested cree dans la fenetre' ($child.parentSessionId -eq $parent.id) ''
  $okMove = Upd $child.id @{ startDate = (D 8); endDate = (D 8) }
  Check 'nested: deplacer dans la fenetre -> 200' ($okMove.startDate -eq (D 8)) ''
  $codeOut = UpdCode $child.id @{ startDate = (D 15); endDate = (D 15) }
  Check 'nested: deplacer HORS fenetre parent -> 400' ($codeOut -eq 400) "code=$codeOut"
  # le child est reste a J+8 (rejet sans effet)
  $reread = (Invoke-RestMethod -Uri "$base/api/programmes/$pid_/sessions" -Headers $H | Where-Object { $_.id -eq $child.id })
  Check 'nested: rejet sans effet (toujours J+8)' ($reread.startDate -eq (D 8)) ("start=" + $reread.startDate)

  # ── RANGE shrink that would orphan a child ──
  $codeOrphan = UpdCode $parent.id @{ startDate = (D 0); endDate = (D 6) }   # child est a J+8 -> en dehors
  Check 'range: reduire la fenetre orphelinant une journee -> 400' ($codeOrphan -eq 400) "code=$codeOrphan"
  $okShrink = Upd $parent.id @{ startDate = (D 0); endDate = (D 9) }          # J+8 reste dedans
  Check 'range: reduire en gardant la journee -> 200' ($okShrink.endDate -eq (D 9)) ''

  # ── RANGE move that would orphan a child ──
  $codeMove = UpdCode $parent.id @{ startDate = (D 20); endDate = (D 29) }     # child J+8 hors fenetre
  Check 'range: deplacer en orphelinant une journee -> 400' ($codeMove -eq 400) "code=$codeMove"
}
catch { $results.Add("ABORT :: $($_.Exception.Message) :: line $($_.InvocationInfo.ScriptLineNumber)") }
finally { if ($pid_ -gt 0) { try { Invoke-RestMethod -Method Delete -Uri "$base/api/programmes/$pid_" -Headers $H | Out-Null } catch {} } }
$results | ForEach-Object { Write-Output $_ }
Write-Output "=== $((@($results | Where-Object { $_ -like 'FAIL*' -or $_ -like 'ABORT*' })).Count) probleme(s) ==="
