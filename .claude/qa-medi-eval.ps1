$ErrorActionPreference='Stop'; $base='http://localhost:8080'; $CID=8
$r=New-Object System.Collections.Generic.List[string]
function Chk($n,$c,$d){ if($c){$r.Add("PASS  $n")}else{$r.Add("FAIL  $n :: $d")} }
try {
  $admin=Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' -Body (@{email='admin@medianet.dz';password='Admin1234!'}|ConvertTo-Json)
  $aTok=$admin.token; $HA=@{Authorization="Bearer $aTok"}
  $score=Invoke-RestMethod -Method Post -Uri "$base/api/admin-ai/score/$CID" -Headers $HA
  Chk 'Medi score ADMIN -> candidatureId' ($score.candidatureId -eq $CID) ("got=$($score.candidatureId)")
  if ($score.aiEnhanced) { Chk 'Medi score ADMIN -> criteres + weightedScore' (@($score.criteria).Count -ge 1 -and $score.weightedScore -ne $null) ("crit=$(@($score.criteria).Count)") }
  else { $r.Add("INFO  Medi aiEnhanced=false :: $($score.error)") }
  $jMail="qa-medijury-$(Get-Random)@test.local"
  $J=Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' -Body (@{email=$jMail;firstName='J';lastName='J';password='Passw0rd!1'}|ConvertTo-Json)
  $jUid=$J.userId; if(-not $jUid){$jUid=$J.id}
  Invoke-RestMethod -Method Post -Uri "$base/api/auth/users/$jUid/roles/assign" -Headers $HA -ContentType 'application/json' -Body (@{roles=@('JURY')}|ConvertTo-Json) | Out-Null
  $jL=Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' -Body (@{email=$jMail;password='Passw0rd!1'}|ConvertTo-Json)
  $sj=Invoke-RestMethod -Method Post -Uri "$base/api/admin-ai/score/$CID" -Headers @{Authorization="Bearer $($jL.token)"}
  Chk 'Medi score JURY -> 200 + candidatureId' ($sj.candidatureId -eq $CID) ("got=$($sj.candidatureId)")
  $crit=@(Invoke-RestMethod -Uri "$base/api/programmes/24/criteria" -Headers $HA)
  $cs=New-Object System.Collections.Generic.List[object]
  foreach($x in $crit){ $cs.Add([pscustomobject]@{criteriaId=$x.id;criteriaName=$x.name;score=7;weight=$x.weight}) }
  $body=@{comment='Admin eval QA';criteriaScores=@($cs)} | ConvertTo-Json -Depth 6
  $ev=Invoke-RestMethod -Method Post -Uri "$base/api/candidatures/$CID/evaluate" -Headers $HA -ContentType 'application/json' -Body $body
  $me=@($ev.evaluations | Where-Object { $_.juryId -eq 2 })
  Chk 'ADMIN evalue (multi-criteres) -> 200 + eval persistee' ($ev.id -eq $CID -and $me.Count -ge 1) ("evalAdmin=$($me.Count)")
}
catch { $r.Add("ABORT :: $($_.Exception.Message) :: line $($_.InvocationInfo.ScriptLineNumber)") }
$r | ForEach-Object { Write-Output $_ }
Write-Output ("=== {0} probleme(s) ===" -f (@($r | Where-Object { $_ -like 'FAIL*' -or $_ -like 'ABORT*' })).Count)
