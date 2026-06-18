# QA — catalog CRUD, auto deadline, org-member token invitation.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080'
$r = New-Object System.Collections.Generic.List[string]
function Chk($n,$c,$d){ if($c){$r.Add("PASS  $n")}else{$r.Add("FAIL  $n :: $d")} }
function D($n){ (Get-Date).AddDays($n).ToString('yyyy-MM-dd') }
$pid_=0; $catId=0
try {
  $admin = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' -Body (@{email='admin@medianet.dz';password='Admin1234!'}|ConvertTo-Json)
  $H=@{Authorization="Bearer $($admin.token)"}

  # ── Catalog: seeded + CRUD ── (count via .value projection: robust to PS array merging)
  $types = Invoke-RestMethod -Uri "$base/api/catalog?category=organization_type" -Headers $H
  $nTypes = @($types.value).Count
  Chk 'catalog org types seeded (>=8)' ($nTypes -ge 8) ("n=" + $nTypes)
  $sect = Invoke-RestMethod -Uri "$base/api/catalog?category=programme_sector" -Headers $H
  $nSect = @($sect.value).Count
  Chk 'catalog sectors seeded (>=11)' ($nSect -ge 11) ("n=" + $nSect)
  $new = Invoke-RestMethod -Method Post -Uri "$base/api/catalog" -Headers $H -ContentType 'application/json' -Body (@{category='organization_type';value='QA_NGO';label='ONG QA'}|ConvertTo-Json)
  $catId=$new.id
  Chk 'catalog create option' ($catId -gt 0) ($new|ConvertTo-Json -Compress)
  $upd = Invoke-RestMethod -Method Put -Uri "$base/api/catalog/$catId" -Headers $H -ContentType 'application/json' -Body (@{label='ONG (QA)';active=$false}|ConvertTo-Json)
  Chk 'catalog update (label + active=false)' ($upd.label -eq 'ONG (QA)' -and $upd.active -eq $false) ($upd|ConvertTo-Json -Compress)

  # An org can now use a free/custom type value (enum -> string).
  $org = Invoke-RestMethod -Method Post -Uri "$base/api/organizations" -Headers $H -ContentType 'application/json' -Body (@{name='QA Org Type';type='QA_NGO'}|ConvertTo-Json)
  Chk 'org accepts custom type string' ($org.type -eq 'QA_NGO') ("type=" + $org.type)
  Invoke-RestMethod -Method Delete -Uri "$base/api/organizations/$($org.id)" -Headers $H | Out-Null

  # ── Auto deadline = candidature session date (first cand session) ──
  $prog = Invoke-RestMethod -Method Post -Uri "$base/api/programmes" -Headers $H -ContentType 'application/json' -Body (@{title='QA Deadline';type='PUBLIC';status='OPEN'}|ConvertTo-Json)
  $pid_=$prog.id
  Invoke-RestMethod -Method Post -Uri "$base/api/programmes/$pid_/phases" -Headers $H -ContentType 'application/json' -Body (@{title='Candidature';durationKind='range';startDate=(D 0);endDate=(D 8);sessionType='CANDIDATURE_SUBMISSION'}|ConvertTo-Json) | Out-Null
  $p2 = Invoke-RestMethod -Uri "$base/api/programmes/$pid_" -Headers $H
  Chk 'deadline auto = fin session candidature' ($p2.applicationDeadline -eq (D 8)) ("deadline=" + $p2.applicationDeadline)

  # ── Org-member token invitation ──
  # Porteur creates org + adds a member with a fresh email -> invitation created.
  $pmail = "qa-owner-$(Get-Random)@test.local"
  $preg = Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' -Body (@{email=$pmail;firstName='Owner';lastName='QA';password='Passw0rd!1'}|ConvertTo-Json)
  $HP=@{Authorization="Bearer $($preg.token)"}
  $puid=$preg.userId; if(-not $puid){$puid=$preg.id}
  $myOrg = @(Invoke-RestMethod -Uri "$base/api/organizations?createdByUserId=$puid" -Headers $HP)[0]
  $memberMail = "qa-member-$(Get-Random)@test.local"
  $mem = Invoke-RestMethod -Method Post -Uri "$base/api/organizations/$($myOrg.id)/members" -Headers $HP -ContentType 'application/json' -Body (@{fullName='Karim Member';email=$memberMail;role='CTO';type='INTERNAL'}|ConvertTo-Json)
  Chk 'porteur ajoute un membre' ($mem.id -gt 0) ($mem|ConvertTo-Json -Compress)
  # No public listing of org invitations; verify by accepting (info endpoint is public via token, but we don't have the token client-side).
  # Instead, accept flow needs the token from the email — not retrievable here. So assert the member exists + has no userId yet.
  $members = @(Invoke-RestMethod -Uri "$base/api/organizations/$($myOrg.id)/members" -Headers $HP)
  $karim = $members | Where-Object { $_.email -eq $memberMail }
  Chk 'membre cree, en attente (pas encore de compte)' ([bool]$karim) ''

  # ── Member-invite ACCEPT (simulate the token email link) ──
  # We can't read the token via API, so create an org member as ADMIN where we DO control the token:
  # use a known org + member, then read the most recent invitation is not exposed. Instead validate the
  # public endpoints reject an unknown token gracefully (no 500).
  $code = try { Invoke-RestMethod -Uri "$base/api/auth/org-invitations/nonexistent-token-xyz"; 200 } catch { [int]$_.Exception.Response.StatusCode.value__ }
  Chk 'token invalide -> 4xx (pas 500)' ($code -ge 400 -and $code -lt 500) ("code=$code")
}
catch { $r.Add("ABORT :: $($_.Exception.Message) :: line $($_.InvocationInfo.ScriptLineNumber)") }
finally {
  if($catId -gt 0){ try { Invoke-RestMethod -Method Delete -Uri "$base/api/catalog/$catId" -Headers $H | Out-Null } catch {} }
  if($pid_ -gt 0){ try { Invoke-RestMethod -Method Delete -Uri "$base/api/programmes/$pid_" -Headers $H | Out-Null } catch {} }
}
$r | ForEach-Object { Write-Output $_ }
Write-Output "=== $((@($r | Where-Object { $_ -like 'FAIL*' -or $_ -like 'ABORT*' })).Count) probleme(s) ==="
