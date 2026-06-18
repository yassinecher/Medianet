# QA — logged-in JURY front-office flow (my-jury-assignments + evaluate).
# Registers a jury, grants JURY role, assigns them to an existing candidature,
# then acts AS the jury: lists assignments, submits an evaluation, re-reads it.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080'
$results = New-Object System.Collections.Generic.List[string]
function Check($n, $c, $d) { if ($c) { $results.Add("PASS  $n") } else { $results.Add("FAIL  $n :: $d") } }
try {
  $admin = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' `
    -Body (@{ email = 'admin@medianet.dz'; password = 'Admin1234!' } | ConvertTo-Json)
  $HA = @{ Authorization = "Bearer $($admin.token)" }

  # An existing candidature to evaluate (need at least one in the system).
  $cands = @(Invoke-RestMethod -Uri "$base/api/candidatures" -Headers $HA)
  if ($cands.Count -eq 0) { $results.Add('SKIP :: aucune candidature existante a evaluer'); throw 'no-candidature' }
  $cand = $cands[0]
  # Defensive: coerce to scalars (some PS/JSON shapes expose .id as a 1-elem array).
  $candId = [long](@($cand.id)[0])
  $progId = [long](@($cand.programmeId)[0])
  $phaseId = @($cand.phaseId)[0]
  Check 'candidature cible trouvee' ($candId -gt 0) ''

  # Register a jury + grant the JURY role.
  $mail = "qa-jury-$(Get-Random)@test.local"
  $reg = Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' `
    -Body (@{ email = $mail; firstName = 'QA'; lastName = 'Jury'; password = 'Passw0rd!1' } | ConvertTo-Json)
  $uid = $reg.userId; if (-not $uid) { $uid = $reg.id }; if (-not $uid -and $reg.user) { $uid = $reg.user.id }
  Invoke-RestMethod -Method Post -Uri "$base/api/auth/users/$uid/roles/assign" -Headers $HA -ContentType 'application/json' `
    -Body (@{ roles = @('JURY') } | ConvertTo-Json) | Out-Null
  Check 'jury enregistre + role JURY' ([bool]$uid) ($reg | ConvertTo-Json -Compress)

  # Admin assigns this jury to the candidature.
  Invoke-RestMethod -Method Post -Uri "$base/api/candidatures/$candId/assign-jury" -Headers $HA -ContentType 'application/json' `
    -Body (@{ juryAssignments = @(@{ juryId = $uid; juryEmail = $mail; juryName = 'QA Jury' }); phaseId = $phaseId } | ConvertTo-Json) | Out-Null
  Check 'assignation du jury a la candidature' $true ''

  # Act AS the jury (re-login to get a token carrying the JURY role).
  $jl = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' `
    -Body (@{ email = $mail; password = 'Passw0rd!1' } | ConvertTo-Json)
  $HJ = @{ Authorization = "Bearer $($jl.token)" }
  $hasJuryRole = (@($jl.roles) -contains 'JURY') -or ($jl.role -eq 'JURY')
  Check 'token jury porte le role JURY' $hasJuryRole ("roles=" + ($jl.roles -join ','))

  # /evaluations data source.
  $mine = Invoke-RestMethod -Uri "$base/api/candidatures/my-jury-assignments" -Headers $HJ
  Check 'my-jury-assignments contient la candidature' (@($mine | Where-Object { $_.id -eq $candId }).Count -eq 1) ("n=" + @($mine).Count)

  # Evaluation form submit (logged-in endpoint).
  $crit = @()
  if ($progId -gt 0) { try { $crit = @(Invoke-RestMethod -Uri "$base/api/programmes/$progId/criteria" -Headers $HJ) } catch {} }
  # PowerShell 5.1 mangles list JSON (merges array properties), so build the
  # body with a guaranteed-scalar criteriaId. The UI sends a real JS array.
  $firstCritId = 0
  try { $firstCritId = [long](@(@($crit)[0].id)[0]) } catch {}
  $body = if ($firstCritId -gt 0) {
    "{""criteriaScores"":[{""criteriaId"":$firstCritId,""criteriaName"":""QA"",""score"":8,""weight"":0.5}],""comment"":""QA - tres bon dossier.""}"
  } else {
    '{"criteriaScores":[],"comment":"QA - tres bon dossier."}'
  }
  $ev = Invoke-RestMethod -Method Post -Uri "$base/api/candidatures/$candId/evaluate" -Headers $HJ -ContentType 'application/json' -Body $body
  Check 'soumission evaluation (jury connecte) -> 200' ($ev.id -eq $candId) ''

  # Re-read: my evaluation is now attached (juryId == uid).
  $mine2 = Invoke-RestMethod -Uri "$base/api/candidatures/my-jury-assignments" -Headers $HJ
  $c2 = @($mine2 | Where-Object { $_.id -eq $candId })[0]
  $myEval = @($c2.evaluations | Where-Object { $_.juryId -eq $uid })[0]
  Check 'mon evaluation rattachee + score pondere' ([bool]$myEval -and $myEval.weightedScore -ne $null) ($myEval | ConvertTo-Json -Compress)

  # phaseId now exposed on the assignment DTO (session-scoped criteria).
  $myAssign = @($c2.juryAssignments | Where-Object { $_.juryId -eq $uid })[0]
  Check 'JuryAssignmentDto expose phaseId' ($myAssign.PSObject.Properties.Name -contains 'phaseId') ($myAssign | ConvertTo-Json -Compress)
}
catch {
  if ("$($_.Exception.Message)" -ne 'no-candidature') { $results.Add("ABORT :: $($_.Exception.Message) :: line $($_.InvocationInfo.ScriptLineNumber)") }
}
$results | ForEach-Object { Write-Output $_ }
Write-Output "=== $((@($results | Where-Object { $_ -like 'FAIL*' -or $_ -like 'ABORT*' })).Count) probleme(s) ==="
