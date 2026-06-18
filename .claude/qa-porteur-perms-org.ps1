# QA — non-admin permission list update + auto-organisation per porteur.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080'
$results = New-Object System.Collections.Generic.List[string]
function Check($n, $c, $d) { if ($c) { $results.Add("PASS  $n") } else { $results.Add("FAIL  $n :: $d") } }
try {
  # A fresh porteur self-registers.
  $mail = "qa-porteur-$(Get-Random)@test.local"
  $reg = Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' `
    -Body (@{ email = $mail; firstName = 'Yassine'; lastName = 'Test'; password = 'Passw0rd!1' } | ConvertTo-Json)
  $uid = $reg.userId; if (-not $uid) { $uid = $reg.id }
  $perms = @($reg.permissions)
  Check 'porteur enregistre' ([bool]$uid -and ($reg.roles -contains 'PORTEUR')) ($reg | ConvertTo-Json -Compress)

  # ── Permission list update ──
  Check 'porteur a candidatures:create' ($perms -contains 'candidatures:create') ("perms=" + ($perms -join ','))
  Check 'porteur a organizations:create' ($perms -contains 'organizations:create') ("perms=" + ($perms -join ','))
  Check 'porteur a tasks:update' ($perms -contains 'tasks:update') ("perms=" + ($perms -join ','))
  Check 'porteur a les reads FO' (($perms -contains 'programmes:read') -and ($perms -contains 'candidatures:read') -and ($perms -contains 'organizations:read')) ("perms=" + ($perms -join ','))
  Check 'porteur N A PAS organizations:update (garde-fou suppression)' (-not ($perms -contains 'organizations:update')) ("perms=" + ($perms -join ','))
  Check 'porteur N A PAS users:read (back-office)' (-not ($perms -contains 'users:read')) ("perms=" + ($perms -join ','))

  # ── Auto-organisation ──
  $H = @{ Authorization = "Bearer $($reg.token)" }
  $orgs = @(Invoke-RestMethod -Uri "$base/api/organizations?createdByUserId=$uid" -Headers $H)
  Check 'porteur possede une organisation des l inscription' ($orgs.Count -ge 1) ("count=" + $orgs.Count)
  if ($orgs.Count -ge 1) { Check 'organisation nommee + type STARTUP' ([bool]$orgs[0].name -and $orgs[0].type -eq 'STARTUP') ($orgs[0] | ConvertTo-Json -Compress) }

  # Re-register idempotence: a 2nd porteur also gets exactly one org.
  $mail2 = "qa-porteur2-$(Get-Random)@test.local"
  $reg2 = Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' `
    -Body (@{ email = $mail2; firstName = 'Bob'; lastName = 'B'; password = 'Passw0rd!1' } | ConvertTo-Json)
  $uid2 = $reg2.userId; if (-not $uid2) { $uid2 = $reg2.id }
  $H2 = @{ Authorization = "Bearer $($reg2.token)" }
  $orgs2 = @(Invoke-RestMethod -Uri "$base/api/organizations?createdByUserId=$uid2" -Headers $H2)
  Check '2e porteur a exactement 1 organisation' ($orgs2.Count -eq 1) ("count=" + $orgs2.Count)
}
catch { $results.Add("ABORT :: $($_.Exception.Message) :: line $($_.InvocationInfo.ScriptLineNumber)") }
$results | ForEach-Object { Write-Output $_ }
Write-Output "=== $((@($results | Where-Object { $_ -like 'FAIL*' -or $_ -like 'ABORT*' })).Count) probleme(s) ==="
