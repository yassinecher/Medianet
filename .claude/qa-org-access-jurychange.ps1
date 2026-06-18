$ErrorActionPreference='Stop'; $base='http://localhost:8080'
$r=New-Object System.Collections.Generic.List[string]
function Chk($n,$c,$d){ if($c){$r.Add("PASS  $n")}else{$r.Add("FAIL  $n :: $d")} }
function Code($m,$uri,$tok,$body){
  try {
    $h=@{}; if($tok){$h['Authorization']="Bearer $tok"}
    if($body){ Invoke-WebRequest -Method $m -Uri $uri -Headers $h -ContentType 'application/json' -Body $body -UseBasicParsing | Out-Null }
    else { Invoke-WebRequest -Method $m -Uri $uri -Headers $h -UseBasicParsing | Out-Null }
    return 200
  } catch { return [int]$_.Exception.Response.StatusCode }
}
function Reg($mail){ Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' -Body (@{email=$mail;firstName='T';lastName='U';password='Passw0rd!1'}|ConvertTo-Json) }
function GetR($uri,$tok){ for($i=0;$i -lt 10;$i++){ try { return Invoke-RestMethod -Uri $uri -Headers @{Authorization="Bearer $tok"} } catch { if($i -eq 9){throw}; Start-Sleep 2 } } }
try {
  $admin=Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' -Body (@{email='admin@medianet.dz';password='Admin1234!'}|ConvertTo-Json)
  $aTok=$admin.token

  # Owner A
  $A=Reg "qa-a-$(Get-Random)@test.local"; $aUid=$A.userId; if(-not $aUid){$aUid=$A.id}
  $orgA=(GetR "$base/api/organizations?createdByUserId=$aUid" $A.token)[0].id

  # Owner A can read own org
  Chk 'proprietaire lit son org (200)' ((Code 'GET' "$base/api/organizations/$orgA" $A.token $null) -eq 200) ''

  # Unrelated porteur B -> 403
  $B=Reg "qa-b-$(Get-Random)@test.local"
  Chk 'porteur non lie -> 403' ((Code 'GET' "$base/api/organizations/$orgA" $B.token $null) -eq 403) ''

  # Admin -> 200
  Chk 'admin lit toute org (200)' ((Code 'GET' "$base/api/organizations/$orgA" $aTok $null) -eq 200) ''

  # Jury -> 200 (assign JURY role to a fresh user, re-login to get a JURY token)
  $jMail="qa-jury-$(Get-Random)@test.local"; $J=Reg $jMail; $jUid=$J.userId; if(-not $jUid){$jUid=$J.id}
  Invoke-RestMethod -Method Post -Uri "$base/api/auth/users/$jUid/roles/assign" -Headers @{Authorization="Bearer $aTok"} -ContentType 'application/json' -Body (@{roles=@('JURY')}|ConvertTo-Json) | Out-Null
  $jLogin=Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' -Body (@{email=$jMail;password='Passw0rd!1'}|ConvertTo-Json)
  Chk 'jury lit org en evaluation (200)' ((Code 'GET' "$base/api/organizations/$orgA" $jLogin.token $null) -eq 200) ''

  # remove-jury route reachable (no candidature -> not a gateway 404/503)
  $rc = Code 'DELETE' "$base/api/candidatures/999999/jury/999999" $aTok $null
  Chk 'route remove-jury atteinte (4xx/5xx, pas 404 gateway/503)' ($rc -ne 503) ("code=$rc")
}
catch { $r.Add("ABORT :: $($_.Exception.Message) :: line $($_.InvocationInfo.ScriptLineNumber)") }
$r | ForEach-Object { Write-Output $_ }
Write-Output ("=== {0} probleme(s) ===" -f (@($r | Where-Object { $_ -like 'FAIL*' -or $_ -like 'ABORT*' })).Count)
