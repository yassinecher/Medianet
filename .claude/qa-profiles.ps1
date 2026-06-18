$ErrorActionPreference='Stop'; $base='http://localhost:8080'
$r=New-Object System.Collections.Generic.List[string]
function Chk($n,$c,$d){ if($c){$r.Add("PASS  $n")}else{$r.Add("FAIL  $n :: $d")} }
try {
  # Porteur self-register, update porteur profile with new fields, read back via /me
  $mail="qa-prof-$(Get-Random)@test.local"
  $reg=Invoke-RestMethod -Method Post -Uri "$base/api/auth/register" -ContentType 'application/json' -Body (@{email=$mail;firstName='Lina';lastName='Founder';password='Passw0rd!1'}|ConvertTo-Json)
  $H=@{Authorization="Bearer $($reg.token)"}
  $up=Invoke-RestMethod -Method Put -Uri "$base/api/auth/profile/porteur" -Headers $H -ContentType 'application/json' -Body (@{headline='Founder & CEO @ Acme';avatarUrl='https://x/y.jpg';twitterUrl='https://x.com/lina';bio='Building the future';company='Acme'}|ConvertTo-Json)
  Chk 'porteur update returns headline' ($up.headline -eq 'Founder & CEO @ Acme') ("got=$($up.headline)")
  Chk 'porteur update returns avatarUrl' ($up.avatarUrl -eq 'https://x/y.jpg') ("got=$($up.avatarUrl)")
  Chk 'porteur update returns twitterUrl' ($up.twitterUrl -eq 'https://x.com/lina') ("got=$($up.twitterUrl)")
  $me=Invoke-RestMethod -Uri "$base/api/auth/me" -Headers $H
  Chk '/me nests porteurProfile.headline' ($me.porteurProfile.headline -eq 'Founder & CEO @ Acme') ("got=$($me.porteurProfile.headline)")

  # Org + member with new fields
  $uid=$reg.userId; if(-not $uid){$uid=$reg.id}
  $orgId=(Invoke-RestMethod -Uri "$base/api/organizations?createdByUserId=$uid" -Headers $H)[0].id
  $mem=Invoke-RestMethod -Method Post -Uri "$base/api/organizations/$orgId/members" -Headers $H -ContentType 'application/json' -Body (@{fullName='Sam Dev';headline='CTO — backend';avatarUrl='https://a/b.png';linkedInUrl='https://linkedin.com/in/sam';expertise=@('Java','Kafka');type='INTERNAL'}|ConvertTo-Json)
  Chk 'member create returns headline' ($mem.headline -eq 'CTO — backend') ("got=$($mem.headline)")
  Chk 'member create returns linkedInUrl' ($mem.linkedInUrl -eq 'https://linkedin.com/in/sam') ("got=$($mem.linkedInUrl)")
  $org=Invoke-RestMethod -Uri "$base/api/organizations/$orgId" -Headers $H
  $row=$org.members | Where-Object { $_.id -eq $mem.id }
  Chk 'org GET member carries avatarUrl' ($row.avatarUrl -eq 'https://a/b.png') ("got=$($row.avatarUrl)")
  Chk 'org GET member carries headline' ($row.headline -eq 'CTO — backend') ("got=$($row.headline)")
}
catch { $r.Add("ABORT :: $($_.Exception.Message) :: line $($_.InvocationInfo.ScriptLineNumber)") }
$r | ForEach-Object { Write-Output $_ }
Write-Output ("=== {0} probleme(s) ===" -f (@($r | Where-Object { $_ -like 'FAIL*' -or $_ -like 'ABORT*' })).Count)
