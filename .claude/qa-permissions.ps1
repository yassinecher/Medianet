# QA — limited-admin permission migration + parcours-templates endpoint.
#   1) porteur WITHOUT programmes:update -> PUT phase = 403
#   2) grant programmes:update + re-login -> PUT phase = 200
#   3) parcours-templates CRUD (admin)
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080'
$results = New-Object System.Collections.Generic.List[string]
function Check($name, $cond, $detail) {
  if ($cond) { $script:results.Add("PASS  $name") } else { $script:results.Add("FAIL  $name :: $detail") }
}
function Code($scriptBlock) {
  try { & $scriptBlock | Out-Null; return 200 }
  catch {
    $r = $_.Exception.Response
    if ($r -and $r.StatusCode) { return [int]$r.StatusCode } else { return -1 }
  }
}
$pid_ = 0
try {
  $admin = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' `
    -Body (@{ email = 'admin@medianet.dz'; password = 'Admin1234!' } | ConvertTo-Json)
  $HA = @{ Authorization = "Bearer $($admin.token)" }

  # Temp porteur
  $mail = "qa-perm-$(Get-Random)@test.local"
  $reg = Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' `
    -Body (@{ email = $mail; firstName = 'QA'; lastName = 'Perm'; password = 'Passw0rd!1' } | ConvertTo-Json)
  $uid = $reg.user.id
  if (-not $uid) { $uid = $reg.id }
  if (-not $uid) { $uid = $reg.userId }
  Check 'register porteur temp' ([bool]$reg.token -and [bool]$uid) ($reg | ConvertTo-Json -Compress)
  $HP = @{ Authorization = "Bearer $($reg.token)" }

  # Test programme + phase (admin)
  $prog = Invoke-RestMethod -Method Post -Uri "$base/api/programmes" -Headers $HA -ContentType 'application/json' `
    -Body (@{ title = 'QA Perms'; type = 'PUBLIC'; status = 'DRAFT' } | ConvertTo-Json)
  $pid_ = $prog.id
  $ph = Invoke-RestMethod -Method Post -Uri "$base/api/programmes/$pid_/phases" -Headers $HA -ContentType 'application/json' `
    -Body (@{ title = 'P'; durationKind = 'range'; startDate = (Get-Date).ToString('yyyy-MM-dd'); endDate = (Get-Date).AddDays(5).ToString('yyyy-MM-dd') } | ConvertTo-Json)

  # 1) porteur sans permission -> 403
  $code1 = Code { Invoke-RestMethod -Method Put -Uri "$base/api/programmes/$pid_/phases/$($ph.id)" -Headers $HP -ContentType 'application/json' -Body (@{ title = 'hack' } | ConvertTo-Json) }
  Check 'porteur SANS perm -> PUT phase = 403' ($code1 -eq 403) "code=$code1"

  # 2) grant programmes:update -> re-login -> 200
  $null = Invoke-RestMethod -Method Post -Uri "$base/api/auth/users/$uid/permissions/grant" -Headers $HA -ContentType 'application/json' `
    -Body (@{ permissions = @('programmes:update') } | ConvertTo-Json)
  $relog = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' `
    -Body (@{ email = $mail; password = 'Passw0rd!1' } | ConvertTo-Json)
  $HP2 = @{ Authorization = "Bearer $($relog.token)" }
  $code2 = Code { Invoke-RestMethod -Method Put -Uri "$base/api/programmes/$pid_/phases/$($ph.id)" -Headers $HP2 -ContentType 'application/json' -Body (@{ title = 'edited by limited admin' } | ConvertTo-Json) }
  Check 'porteur AVEC programmes:update -> PUT phase = 200' ($code2 -eq 200) "code=$code2"

  # …mais toujours pas le droit de supprimer le programme (programmes:delete)
  $code3 = Code { Invoke-RestMethod -Method Delete -Uri "$base/api/programmes/$pid_" -Headers $HP2 }
  Check 'porteur sans programmes:delete -> DELETE = 403' ($code3 -eq 403) "code=$code3"

  # 3) parcours-templates CRUD (admin)
  $tpl = Invoke-RestMethod -Method Post -Uri "$base/api/parcours-templates" -Headers $HA -ContentType 'application/json' `
    -Body (@{ name = 'QA Tpl'; structureJson = '[{"title":"Phase 1","durationKind":"range","offsetDays":0,"durationDays":5}]'; sessionCount = 1 } | ConvertTo-Json)
  $lst = Invoke-RestMethod -Uri "$base/api/parcours-templates" -Headers $HA
  Check 'parcours-template create + list' ($tpl.id -gt 0 -and (@($lst) | Where-Object { $_.id -eq $tpl.id })) ''
  Invoke-RestMethod -Method Delete -Uri "$base/api/parcours-templates/$($tpl.id)" -Headers $HA | Out-Null
  $lst2 = Invoke-RestMethod -Uri "$base/api/parcours-templates" -Headers $HA
  Check 'parcours-template delete' (-not (@($lst2) | Where-Object { $_.id -eq $tpl.id })) ''
}
catch { $results.Add("ABORT :: $($_.Exception.Message) :: line $($_.InvocationInfo.ScriptLineNumber)") }
finally {
  if ($pid_ -gt 0) { try { Invoke-RestMethod -Method Delete -Uri "$base/api/programmes/$pid_" -Headers $HA | Out-Null } catch {} }
}
$results | ForEach-Object { Write-Output $_ }
Write-Output "=== $((@($results | Where-Object { $_ -like 'FAIL*' -or $_ -like 'ABORT*' })).Count) probleme(s) ==="
