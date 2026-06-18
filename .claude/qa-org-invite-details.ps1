$ErrorActionPreference='Stop'; $base='http://localhost:8080'
$r=New-Object System.Collections.Generic.List[string]
function Chk($n,$c,$d){ if($c){$r.Add("PASS  $n")}else{$r.Add("FAIL  $n :: $d")} }
function Get-Retry($uri,$h){ for($i=0;$i -lt 10;$i++){ try { return Invoke-RestMethod -Uri $uri -Headers $h } catch { if($i -eq 9){throw}; Start-Sleep -Seconds 2 } } }
try {
  $mail="qa-r3-$(Get-Random)@test.local"
  $reg=Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' -Body (@{email=$mail;firstName='Omar';lastName='Owner';password='Passw0rd!1'}|ConvertTo-Json)
  $H=@{Authorization="Bearer $($reg.token)"}
  $uid=$reg.userId; if(-not $uid){$uid=$reg.id}
  $orgId=(Get-Retry "$base/api/organizations?createdByUserId=$uid" $H)[0].id

  # Org details fields
  $upd=Invoke-RestMethod -Method Put -Uri "$base/api/organizations/$orgId" -Headers $H -ContentType 'application/json' -Body (@{address='12 Rue de Tunis, Tunis';foundedYear=2021;employeeCount='11-50'}|ConvertTo-Json)
  Chk 'org address persiste' ($upd.address -eq '12 Rue de Tunis, Tunis') ("got=$($upd.address)")
  Chk 'org foundedYear persiste' ($upd.foundedYear -eq 2021) ("got=$($upd.foundedYear)")
  Chk 'org employeeCount persiste' ($upd.employeeCount -eq '11-50') ("got=$($upd.employeeCount)")

  # Invite-only member: email only -> pending (userId null), name derived
  $invMail="qa-invitee-$(Get-Random)@test.local"
  $mem=Invoke-RestMethod -Method Post -Uri "$base/api/organizations/$orgId/members" -Headers $H -ContentType 'application/json' -Body (@{email=$invMail}|ConvertTo-Json)
  Chk 'membre invite: pas de userId (en attente)' (-not $mem.userId) ("userId=$($mem.userId)")
  Chk 'membre invite: nom derive non vide' ([bool]$mem.fullName) ("name=$($mem.fullName)")

  # Cancel invitation -> member removed
  Invoke-RestMethod -Method Delete -Uri "$base/api/organizations/$orgId/members/$($mem.id)" -Headers $H | Out-Null
  $org2=Invoke-RestMethod -Uri "$base/api/organizations/$orgId" -Headers $H
  $still=@($org2.members | Where-Object { $_.id -eq $mem.id })
  Chk 'annulation invitation: membre retire' ($still.Count -eq 0) ("n=$($still.Count)")

  # Existing-account email -> linked immediately (active, userId set)
  $bMail="qa-existing-$(Get-Random)@test.local"
  $regB=Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' -Body (@{email=$bMail;firstName='Bea';lastName='Existing';password='Passw0rd!1'}|ConvertTo-Json)
  $bUid=$regB.userId; if(-not $bUid){$bUid=$regB.id}
  $memB=Invoke-RestMethod -Method Post -Uri "$base/api/organizations/$orgId/members" -Headers $H -ContentType 'application/json' -Body (@{email=$bMail}|ConvertTo-Json)
  Chk 'email avec compte -> lie immediatement (userId)' ($memB.userId -eq $bUid) ("userId=$($memB.userId)")
}
catch { $r.Add("ABORT :: $($_.Exception.Message) :: line $($_.InvocationInfo.ScriptLineNumber)") }
$r | ForEach-Object { Write-Output $_ }
Write-Output ("=== {0} probleme(s) ===" -f (@($r | Where-Object { $_ -like 'FAIL*' -or $_ -like 'ABORT*' })).Count)
