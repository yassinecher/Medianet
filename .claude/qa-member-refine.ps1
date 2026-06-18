# QA — member-invite refinements + eligible org types.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080'
$r = New-Object System.Collections.Generic.List[string]
function Chk($n,$c,$d){ if($c){$r.Add("PASS  $n")}else{$r.Add("FAIL  $n :: $d")} }
$pid_=0
try {
  $admin = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' -Body (@{email='admin@medianet.dz';password='Admin1234!'}|ConvertTo-Json)
  $HA=@{Authorization="Bearer $($admin.token)"}

  # ── Porteur A (owner) self-registers → gets ONE owned org ──
  $aMail="qa-ownerA-$(Get-Random)@test.local"
  $regA = Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' -Body (@{email=$aMail;firstName='Alice';lastName='Owner';password='Passw0rd!1'}|ConvertTo-Json)
  $HAa=@{Authorization="Bearer $($regA.token)"}
  $aUid=$regA.userId; if(-not $aUid){$aUid=$regA.id}
  $ownA = @((Invoke-RestMethod -Uri "$base/api/organizations?createdByUserId=$aUid" -Headers $HAa).id)
  Chk 'porteur self-register a 1 org possedee' ($ownA.Count -eq 1) ("n=" + $ownA.Count)
  $orgAId = (Invoke-RestMethod -Uri "$base/api/organizations?createdByUserId=$aUid" -Headers $HAa)[0].id

  # ── Existing-account member: Porteur B exists, A adds B by email → linked, NO invite ──
  $bMail="qa-existing-$(Get-Random)@test.local"
  $regB = Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' -Body (@{email=$bMail;firstName='Bob';lastName='Existing';password='Passw0rd!1'}|ConvertTo-Json)
  $HB=@{Authorization="Bearer $($regB.token)"}
  $bUid=$regB.userId; if(-not $bUid){$bUid=$regB.id}
  $memB = Invoke-RestMethod -Method Post -Uri "$base/api/organizations/$orgAId/members" -Headers $HAa -ContentType 'application/json' -Body (@{fullName='Bob Existing';email=$bMail;role='COO';type='INTERNAL'}|ConvertTo-Json)
  # The member row should be linked to B's userId immediately (existing account).
  $members = Invoke-RestMethod -Uri "$base/api/organizations/$orgAId/members" -Headers $HAa
  $bRow = $members | Where-Object { $_.email -eq $bMail }
  Chk 'membre avec compte existant -> lie au userId' ($bRow.userId -eq $bUid) ("userId=" + $bRow.userId)

  # ── B sees org A as MEMBER (read-only) ──
  $bMemberOf = @(Invoke-RestMethod -Uri "$base/api/organizations?memberUserId=$bUid" -Headers $HB)
  $sawA = $bMemberOf | Where-Object { $_.id -eq $orgAId }
  Chk 'B voit l org A en tant que membre' ([bool]$sawA) ("n=" + @($bMemberOf.id).Count)

  # ── B is NOT the owner of org A (read-only) ──
  Chk 'B n est PAS proprietaire de A' ($sawA.createdByUserId -ne $bUid) ("owner=" + $sawA.createdByUserId)

  # ── B did not gain a spurious owned org from being a member ──
  $bOwned = @((Invoke-RestMethod -Uri "$base/api/organizations?createdByUserId=$bUid" -Headers $HB).id)
  Chk 'B garde uniquement sa propre org (membership ne cree pas d org)' ($bOwned.Count -eq 1) ("n=" + $bOwned.Count)

  # ── Eligible org types on a programme ──
  $prog = Invoke-RestMethod -Method Post -Uri "$base/api/programmes" -Headers $HA -ContentType 'application/json' -Body (@{title='QA Eligible';type='PUBLIC';status='DRAFT'}|ConvertTo-Json)
  $pid_=$prog.id
  $body = '{"eligibleOrgTypes":["STARTUP","UNIVERSITY"]}'
  $upd = Invoke-RestMethod -Method Put -Uri "$base/api/programmes/$pid_" -Headers $HA -ContentType 'application/json' -Body $body
  $elig = @($upd.eligibleOrgTypes)
  Chk 'programme: types eligibles persistes' ($elig -contains 'STARTUP' -and $elig -contains 'UNIVERSITY' -and $elig.Count -eq 2) ("got=" + ($elig -join ','))
}
catch { $r.Add("ABORT :: $($_.Exception.Message) :: line $($_.InvocationInfo.ScriptLineNumber)") }
finally { if($pid_ -gt 0){ try { Invoke-RestMethod -Method Delete -Uri "$base/api/programmes/$pid_" -Headers $HA | Out-Null } catch {} } }
$r | ForEach-Object { Write-Output $_ }
Write-Output "=== $((@($r | Where-Object { $_ -like 'FAIL*' -or $_ -like 'ABORT*' })).Count) probleme(s) ==="
