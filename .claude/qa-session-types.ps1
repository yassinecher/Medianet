# QA — exercises every session-type edit path through the gateway,
# mirroring exactly what the Parcours UI panels send. Cleans up after itself.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080'
$results = New-Object System.Collections.Generic.List[string]
function Check($name, $cond, $detail) {
  if ($cond) { $script:results.Add("PASS  $name") }
  else { $script:results.Add("FAIL  $name :: $detail") }
}
$today = Get-Date
function D($n) { $today.AddDays($n).ToString('yyyy-MM-dd') }

$pid_ = 0
try {
  # ── Auth ──
  $login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' `
    -Body (@{ email = 'admin@medianet.dz'; password = 'Admin1234!' } | ConvertTo-Json)
  $token = $login.token
  if (-not $token) { $token = $login.accessToken }
  $H = @{ Authorization = "Bearer $token" }
  Check 'login admin' ([bool]$token) 'no token in response'

  # ── Programme + criteria ──
  $prog = Invoke-RestMethod -Method Post -Uri "$base/api/programmes" -Headers $H -ContentType 'application/json' `
    -Body (@{ title = 'QA Sessions Test'; type = 'PUBLIC'; status = 'OPEN'; description = 'qa temp' } | ConvertTo-Json)
  $pid_ = $prog.id
  Check 'create programme' ($pid_ -gt 0) ($prog | ConvertTo-Json -Compress)

  $c1 = Invoke-RestMethod -Method Post -Uri "$base/api/programmes/$pid_/criteria" -Headers $H -ContentType 'application/json' -Body (@{ name = 'Innovation'; weight = 0.5 } | ConvertTo-Json)
  $c2 = Invoke-RestMethod -Method Post -Uri "$base/api/programmes/$pid_/criteria" -Headers $H -ContentType 'application/json' -Body (@{ name = 'Equipe'; weight = 0.3 } | ConvertTo-Json)
  Check 'create 2 criteria' ($c1.id -gt 0 -and $c2.id -gt 0) ''

  function NewSession($body) {
    Invoke-RestMethod -Method Post -Uri "$base/api/programmes/$pid_/phases" -Headers $H -ContentType 'application/json' -Body ($body | ConvertTo-Json)
  }
  function UpdSession($sid, $body) {
    Invoke-RestMethod -Method Put -Uri "$base/api/programmes/$pid_/phases/$sid" -Headers $H -ContentType 'application/json' -Body ($body | ConvertTo-Json)
  }

  # ── Create every session type ──
  $a = NewSession @{ title = 'Plage Std'; durationKind = 'range'; startDate = (D 0); endDate = (D 10); color = '#0EA5E9' }
  Check 'S1 plage STANDARD (type par defaut INCUBATION)' ($a.id -gt 0 -and $a.sessionType -eq 'INCUBATION' -and $a.durationKind -eq 'range') ("type=" + $a.sessionType)

  $b = NewSession @{ title = 'Journee Libre'; durationKind = 'day'; startDate = (D 2); endDate = (D 2); color = '#A855F7' }
  Check 'S2 journee AUTONOME (sans plage)' ($b.id -gt 0 -and $null -eq $b.parentSessionId -and $b.durationKind -eq 'day') ("parent=" + $b.parentSessionId)

  $c = NewSession @{ title = 'Candidature QA'; durationKind = 'range'; startDate = (D -1); endDate = (D 5); sessionType = 'CANDIDATURE_SUBMISSION'; color = '#10B981' }
  Check 'S3 session CANDIDATURE' ($c.sessionType -eq 'CANDIDATURE_SUBMISSION') ("type=" + $c.sessionType)

  $d = NewSession @{ title = 'Evaluation QA'; durationKind = 'range'; startDate = (D 6); endDate = (D 12); sessionType = 'PRESELECTION'; color = '#F59E0B' }
  Check 'S4 session EVALUATION' ($d.sessionType -eq 'PRESELECTION') ("type=" + $d.sessionType)

  $e = NewSession @{ title = 'Jour Atelier'; durationKind = 'day'; startDate = (D 3); endDate = (D 3); parentSessionId = $a.id }
  Check 'S5 journee IMBRIQUEE dans la plage' ($e.parentSessionId -eq $a.id) ("parent=" + $e.parentSessionId)

  # ── Standard edits (panel fields) ──
  $r = UpdSession $a.id @{ title = 'Plage Std v2'; color = '#EF4444'; location = 'Salle A'; description = 'desc qa'; status = 'ACTIVE'; lane = 'Cohorte A' }
  Check 'E1 std: titre/couleur/lieu/desc/statut/voie' ($r.title -eq 'Plage Std v2' -and $r.color -eq '#EF4444' -and $r.location -eq 'Salle A' -and $r.status -eq 'ACTIVE' -and $r.lane -eq 'Cohorte A') ($r | ConvertTo-Json -Compress)

  $r = UpdSession $a.id @{ startDate = (D 1); endDate = (D 11) }
  Check 'E2 std: deplacement de dates (drag)' ($r.startDate -eq (D 1) -and $r.endDate -eq (D 11)) ("$($r.startDate) -> $($r.endDate)")

  $r = UpdSession $b.id @{ durationKind = 'range'; endDate = (D 4) }
  Check 'E3 bascule journee->plage' ($r.durationKind -eq 'range' -and $r.endDate -eq (D 4)) ("kind=" + $r.durationKind)
  $r = UpdSession $b.id @{ durationKind = 'day'; endDate = (D 2) }
  Check 'E4 bascule plage->journee' ($r.durationKind -eq 'day') ("kind=" + $r.durationKind)

  $r = UpdSession $a.id @{ sessionType = 'PRESELECTION' }
  Check 'E5 fonction std->evaluation' ($r.sessionType -eq 'PRESELECTION') ("type=" + $r.sessionType)
  $r = UpdSession $a.id @{ sessionType = 'INCUBATION' }
  Check 'E6 fonction retour standard' ($r.sessionType -eq 'INCUBATION') ("type=" + $r.sessionType)

  # ── Evaluation edits: criteres de session + poids ──
  $wjson = (@{ "$($c1.id)" = 0.7 } | ConvertTo-Json -Compress)
  $r = UpdSession $d.id @{ focusCriteriaIds = @($c1.id); criterionWeightsJson = $wjson }
  Check 'E7 eval: criteres de session + poids' (@($r.focusCriteriaIds).Count -eq 1 -and $r.criterionWeightsJson -eq $wjson) ("w=" + $r.criterionWeightsJson)

  # ── Nesting edits ──
  $r = UpdSession $e.id @{ parentSessionId = -1 }
  Check 'E8 journee detachee (-1 sentinel)' ($null -eq $r.parentSessionId) ("parent=" + $r.parentSessionId)
  $r = UpdSession $e.id @{ parentSessionId = $a.id }
  Check 'E9 journee re-imbriquee' ($r.parentSessionId -eq $a.id) ("parent=" + $r.parentSessionId)

  # ── Candidature: deadline auto-sync + flags ──
  $null = UpdSession $c.id @{ endDate = (D 7) }
  $p2 = Invoke-RestMethod -Uri "$base/api/programmes/$pid_" -Headers $H
  Check 'E10 cloture candidatures suit la fin de session' ($p2.applicationDeadline -eq (D 7)) ("deadline=" + $p2.applicationDeadline)
  Check 'E11 candidatureSessionId expose' ($p2.candidatureSessionId -eq $c.id) ("id=" + $p2.candidatureSessionId)
  Check 'E12 acceptingApplications=true pendant la fenetre' ($p2.acceptingApplications -eq $true) ("acc=" + $p2.acceptingApplications)

  # ── Evaluation: liste a evaluer (selection persistee) ──
  $sel = Invoke-RestMethod -Method Post -Uri "$base/api/candidatures/programme/$pid_/selections" -Headers $H -ContentType 'application/json' `
    -Body (@{ name = 'Top 10 QA'; candidatureIds = @() } | ConvertTo-Json)
  Check 'E13 creation version de liste' ($sel.id -gt 0) ($sel | ConvertTo-Json -Compress)
  $r = UpdSession $d.id @{ evaluationSelectionId = $sel.id }
  Check 'E14 eval: liste a evaluer persistee' ($r.evaluationSelectionId -eq $sel.id) ("got=" + $r.evaluationSelectionId)
  $r = UpdSession $d.id @{ evaluationSelectionId = -1 }
  Check 'E15 eval: -1 efface la liste' ($null -eq $r.evaluationSelectionId) ("got=" + $r.evaluationSelectionId)
  Invoke-RestMethod -Method Delete -Uri "$base/api/candidatures/selections/$($sel.id)" -Headers $H | Out-Null

  # ── Journee: agenda (jour + activites) ──
  $day = Invoke-RestMethod -Method Post -Uri "$base/api/programmes/$pid_/sessions/$($e.id)/days" -Headers $H -ContentType 'application/json' `
    -Body (@{ title = 'Programme du jour'; date = (D 3) } | ConvertTo-Json)
  Check 'E16 ajout jour a la journee' ($day.id -gt 0) ($day | ConvertTo-Json -Compress)
  $act = Invoke-RestMethod -Method Post -Uri "$base/api/programmes/$pid_/sessions/$($e.id)/days/$($day.id)/activities" -Headers $H -ContentType 'application/json' `
    -Body (@{ title = 'Atelier pitch'; startTime = '09:00'; endTime = '10:30'; color = '#EC4899' } | ConvertTo-Json)
  Check 'E17 ajout activite 09:00-10:30' ($act.id -gt 0 -and ("" + $act.startTime) -like '09:00*') ("start=" + $act.startTime)
  $act2 = Invoke-RestMethod -Method Put -Uri "$base/api/programmes/$pid_/sessions/$($e.id)/days/$($day.id)/activities/$($act.id)" -Headers $H -ContentType 'application/json' `
    -Body (@{ title = 'Atelier pitch v2'; endTime = '11:00' } | ConvertTo-Json)
  Check 'E18 edition activite' ($act2.title -eq 'Atelier pitch v2') ("title=" + $act2.title)

  $list = Invoke-RestMethod -Uri "$base/api/programmes/$pid_/sessions" -Headers $H
  $eL = $list | Where-Object { $_.id -eq $e.id }
  Check 'E19 sessions list renvoie days[].activities (timeline/calendrier)' (@($eL.days).Count -ge 1 -and @($eL.days[0].activities).Count -ge 1) ("days=" + (@($eL.days).Count))

  # ── Deletions ──
  Invoke-RestMethod -Method Delete -Uri "$base/api/programmes/$pid_/phases/$($b.id)" -Headers $H | Out-Null
  $list2 = Invoke-RestMethod -Uri "$base/api/programmes/$pid_/sessions" -Headers $H
  Check 'E20 suppression journee autonome' (-not ($list2 | Where-Object { $_.id -eq $b.id })) ''

  Invoke-RestMethod -Method Delete -Uri "$base/api/programmes/$pid_/phases/$($a.id)" -Headers $H | Out-Null
  $list3 = Invoke-RestMethod -Uri "$base/api/programmes/$pid_/sessions" -Headers $H
  Check 'E21 cascade plage -> journee imbriquee supprimee' (-not ($list3 | Where-Object { $_.id -eq $e.id })) ''
}
catch {
  $results.Add("ABORT :: $($_.Exception.Message) :: line $($_.InvocationInfo.ScriptLineNumber)")
}
finally {
  if ($pid_ -gt 0) {
    try { Invoke-RestMethod -Method Delete -Uri "$base/api/programmes/$pid_" -Headers $H | Out-Null; $results.Add('CLEANUP programme supprime') }
    catch { $results.Add("CLEANUP FAILED :: $($_.Exception.Message)") }
  }
}

$results | ForEach-Object { Write-Output $_ }
$fails = @($results | Where-Object { $_ -like 'FAIL*' -or $_ -like 'ABORT*' }).Count
Write-Output "=== $($results.Count) lignes, $fails probleme(s) ==="
