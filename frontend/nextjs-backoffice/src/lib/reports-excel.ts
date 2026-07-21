/**
 * Excel report builders — turn a programme's live data into the exact workbooks
 * the incubation team keeps by hand today. Three deliverables, one per template:
 *
 *   1. downloadScoresWorkbook       → « SCORES des startups & sélection finale »
 *        a synthesis/selection sheet + one scoring sheet per project
 *        (criteria as columns, a coefficient row, one row per jury, a final score).
 *   2. downloadApplicationsWorkbook → « Critères de sélection projet »
 *        Fiches projets (raw application forms) + Liste des entretiens
 *        (jury schedule) + Grille de notation (the blank scoring grid).
 *   3. downloadScheduleWorkbook     → « Programme de Workshops / Conférences »
 *        the sessions→days→activities agenda + the accompanied-startups roster.
 *
 * Data-driven and dependency-free (see spreadsheetml.ts). Loosely typed so it
 * tolerates whatever the candidature / session / criteria endpoints return.
 */
import { downloadWorkbook, type Sheet, type Row } from '@/lib/spreadsheetml'

const round2 = (n: number) => Math.round(n * 100) / 100
const num = (v: any): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}
const day = (d: any): string => (d ? String(d).slice(0, 10) : '')
const time = (t: any): string => (t ? String(t).slice(0, 5) : '')
const joinList = (xs: any): string => (Array.isArray(xs) ? xs.filter(Boolean).join(', ') : (xs ?? '') || '')
const yesno = (v: any): string => (v === true ? 'Oui' : v === false ? 'Non' : '')

const STATUS_FR: Record<string, string> = {
  PENDING: 'En attente', UNDER_EVALUATION: 'En évaluation', UNDER_REVIEW: 'En revue',
  ACCEPTED: 'Accepté', REJECTED: 'Refusé',
}
const SESSION_FR: Record<string, string> = {
  CANDIDATURE_SUBMISSION: 'Candidature', PRESELECTION: 'Présélection',
  PITCH_DAY: 'Pitch Day', INCUBATION: 'Incubation',
}
const ACTIVITY_FR: Record<string, string> = {
  WORKSHOP: 'Workshop', KEYNOTE: 'Conférence', PANEL: 'Panel', PITCH: 'Pitch',
  TRAINING_STEP: 'Formation', NETWORKING: 'Networking', BREAK: 'Pause',
  ACTIVITY: 'Activité', OTHER: 'Autre',
}

// ── shared helpers ───────────────────────────────────────────────────────────
function projectName(c: any): string { return c.projectName ?? c.companyName ?? c.title ?? `Candidature ${c.id}` }
function founder(c: any): string { return c.founderName ?? c.porteurName ?? c.contactEmail ?? '' }
function slug(s: string): string { return (s || 'programme').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) }
function generatedRow(cols: number): Row { return [{ v: 'Généré le ' + new Date().toLocaleString('fr-FR'), colspan: cols }] }

interface CritCol { id?: number; name: string; weight: number | null }

/** Ordered criterion columns — from the criteria list, else inferred from the scores. */
function critColumns(criteria: any[], evals: any[]): CritCol[] {
  const fromProp = (criteria ?? [])
    .filter((c: any) => c.active !== false)
    .sort((a: any, b: any) => (a.criterionOrder ?? 0) - (b.criterionOrder ?? 0))
    .map((c: any) => ({ id: c.id, name: c.name, weight: num(c.weight) }))
  if (fromProp.length) return fromProp
  const seen: CritCol[] = []
  for (const ev of (evals ?? [])) for (const cs of (ev.criteriaScores ?? []))
    if (cs.criteriaName && !seen.some((s) => s.name === cs.criteriaName))
      seen.push({ id: cs.criteriaId, name: cs.criteriaName, weight: num(cs.weight) })
  return seen
}

function scoreFor(ev: any, col: CritCol): number | null {
  const hit = (ev.criteriaScores ?? []).find((cs: any) =>
    (col.id != null && cs.criteriaId === col.id) || cs.criteriaName === col.name)
  return hit ? num(hit.score) : null
}

/** Union of jury (assigned + submitted) for a candidature, each with its evaluation. */
function juryRows(c: any): { name: string; ev: any | null }[] {
  const keyOf = (x: any) => (x.juryEmail || x.juryName || '').toLowerCase().trim()
  const map = new Map<string, { name: string; ev: any | null }>()
  for (const a of (c.juryAssignments ?? [])) {
    const k = keyOf(a) || (a.juryName ?? '')
    if (k && !map.has(k)) map.set(k, { name: a.juryName || a.juryEmail || 'Jury', ev: null })
  }
  for (const e of (c.evaluations ?? [])) {
    const k = keyOf(e) || (e.juryName ?? '')
    const name = e.juryName || e.juryEmail || 'Jury'
    if (map.has(k)) map.get(k)!.ev = e
    else map.set(k || name, { name, ev: e })
  }
  return Array.from(map.values())
}

/** Final score = totalScore, else the mean of jury weighted scores. */
function finalOf(c: any): number | null {
  const t = num(c.totalScore)
  if (t != null) return t
  const ws = (c.evaluations ?? []).map((e: any) => num(e.weightedScore)).filter((x: any) => x != null) as number[]
  return ws.length ? round2(ws.reduce((a, b) => a + b, 0) / ws.length) : null
}

// ════════════════════════════════════════════════════════════════════════════
// 1) SCORES & SÉLECTION  (template: « SCORES des startups & séléction … »)
// ════════════════════════════════════════════════════════════════════════════
export function downloadScoresWorkbook(programmeName: string, candidatures: any[], criteria: any[] = []) {
  const cands = [...(candidatures ?? [])]
    .map((c) => ({ ...c, _final: finalOf(c) }))
    .sort((a, b) => (b._final ?? -1) - (a._final ?? -1))

  // — Synthesis / selection sheet —
  const synth: Row[] = [
    [{ v: `Scores & sélection — ${programmeName}`, style: 'title', colspan: 7 }],
    generatedRow(7),
    [],
    ['#', 'Projet', 'Porteur', 'Secteur', 'Évaluations', 'Score final', 'Décision'].map((h) => ({ v: h, style: 'head' })),
  ]
  cands.forEach((c, i) => synth.push([
    i + 1,
    projectName(c),
    founder(c),
    c.sector ?? '',
    (c.evaluations ?? []).length,
    { v: c._final != null ? round2(c._final) : '', style: c._final != null && c._final >= 7 ? 'good' : undefined },
    { v: STATUS_FR[c.status] ?? c.status ?? '', style: c.status === 'ACCEPTED' ? 'good' : c.status === 'REJECTED' ? 'bad' : undefined },
  ]))
  const sheets: Sheet[] = [{ name: 'Synthèse & sélection', rows: synth, colWidths: [30, 210, 160, 110, 80, 80, 90] }]

  // — One scoring sheet per project —
  for (const c of cands) {
    const evals: any[] = c.evaluations ?? []
    const cols = critColumns(criteria, evals)
    const nc = cols.length
    const width = nc + 2
    const sumCoeff = cols.reduce((s, col) => s + (col.weight ?? 0), 0)
    const jrs = juryRows(c)

    const rows: Row[] = [
      [{ v: projectName(c), style: 'title', colspan: width }],
      [{ v: 'Présenté par :', style: 'bold' }, { v: founder(c), colspan: Math.max(1, nc) },
       { v: c._final != null ? round2(c._final) : '', style: 'good' }],
      [{ v: 'Statut :', style: 'bold' }, { v: STATUS_FR[c.status] ?? c.status ?? '', colspan: Math.max(1, nc) },
       { v: 'Score final', style: 'sub' }],
      [],
      [{ v: 'Critère', style: 'head' }, ...cols.map((col) => ({ v: col.name, style: 'head' })), { v: 'Moyenne', style: 'head' }],
      [{ v: 'Coefficient', style: 'bold' }, ...cols.map((col) => ({ v: col.weight != null ? round2(col.weight) : '' })),
       { v: sumCoeff ? round2(sumCoeff) : '' }],
    ]
    for (const jr of jrs) {
      rows.push([
        jr.name,
        ...cols.map((col) => (jr.ev ? (scoreFor(jr.ev, col) ?? '') : '')),
        jr.ev && num(jr.ev.weightedScore) != null ? round2(num(jr.ev.weightedScore)!) : '',
      ])
    }
    if (jrs.length === 0) rows.push([{ v: 'Aucun jury assigné', colspan: width }])
    rows.push([{ v: 'Score Final', style: 'sub', colspan: nc + 1 }, { v: c._final != null ? round2(c._final) : '', style: 'good' }])

    sheets.push({ name: projectName(c) || `Projet ${c.id}`, rows, colWidths: [170, ...cols.map(() => 92), 92] })
  }

  downloadWorkbook(`scores-${slug(programmeName)}.xls`, sheets)
}

// ════════════════════════════════════════════════════════════════════════════
// 2) FICHES PROJETS & ENTRETIENS  (template: « critéres de selection porjet »)
// ════════════════════════════════════════════════════════════════════════════
export function downloadApplicationsWorkbook(programmeName: string, candidatures: any[], criteria: any[] = []) {
  const cands = [...(candidatures ?? [])].sort((a, b) => day(a.submittedAt).localeCompare(day(b.submittedAt)))

  // — Sheet: Fiches projets (raw application forms) —
  const fpHead = [
    'Horodateur', 'Nom du projet', 'Porteur', 'Adresse e-mail', 'Téléphone', 'Nb fondateurs',
    'Description', 'Problème', 'Solution', 'Unicité', 'Technologie', 'Secteur',
    'Marché cible', 'Clients ?', 'Déjà incubé ?', 'Statut',
  ]
  const fiches: Row[] = [
    [{ v: `Fiches projets — ${programmeName}`, style: 'title', colspan: fpHead.length }],
    generatedRow(fpHead.length),
    [],
    fpHead.map((h) => ({ v: h, style: 'head' })),
  ]
  for (const c of cands) {
    fiches.push([
      c.submittedAt ? String(c.submittedAt).replace('T', ' ').slice(0, 16) : '',
      projectName(c), founder(c), c.contactEmail ?? c.founderEmail ?? c.porteurEmail ?? '',
      c.contactPhone ?? '', c.teamSize ?? '',
      c.projectDescription ?? '', c.problemStatement ?? '', c.solutionDescription ?? '',
      c.competitiveAdvantage ?? '', c.technologyDescription ?? '', c.sector ?? c.domain ?? '',
      c.targetMarket ?? '', yesno(c.hasCustomers), yesno(c.hasPriorIncubation),
      STATUS_FR[c.status] ?? c.status ?? '',
    ])
  }
  if (cands.length === 0) fiches.push([{ v: 'Aucune candidature', colspan: fpHead.length }])

  // — Sheet: Liste des entretiens (jury schedule) —
  const juryNames: string[] = []
  for (const c of cands) for (const jr of juryRows(c)) if (!juryNames.includes(jr.name)) juryNames.push(jr.name)
  const enHead = ['Nom du projet', 'Porteur', 'Ville', "Type d'entretien", "Date de l'entretien", "Heure", 'Lien MEET', ...juryNames]
  const entretiens: Row[] = [
    [{ v: `Liste des entretiens — ${programmeName}`, style: 'title', colspan: enHead.length }],
    generatedRow(enHead.length),
    [],
    enHead.map((h) => ({ v: h, style: 'head' })),
  ]
  for (const c of cands) {
    const jset = new Map<string, boolean>() // name → submitted?
    for (const jr of juryRows(c)) jset.set(jr.name, !!jr.ev)
    entretiens.push([
      projectName(c), founder(c), c.city ?? c.region ?? '', '', '', '', '',
      ...juryNames.map((n) => (jset.has(n) ? (jset.get(n) ? '✔' : '•') : '')),
    ])
  }
  if (cands.length === 0) entretiens.push([{ v: 'Aucune candidature', colspan: enHead.length }])

  // — Sheet: Grille de notation (the blank scoring grid) —
  const cols = critColumns(criteria, cands.flatMap((c) => c.evaluations ?? []))
  const grille: Row[] = [
    [{ v: `Grille de notation — ${programmeName}`, style: 'title', colspan: 3 }],
    [{ v: 'Barème appliqué à chaque projet lors des entretiens.', colspan: 3 }],
    [],
    ['Critère de sélection', 'Coefficient', 'Note'].map((h) => ({ v: h, style: 'head' })),
  ]
  for (const col of cols) grille.push([col.name, col.weight != null ? round2(col.weight) : '', '/10'])
  const sumCoeff = cols.reduce((s, col) => s + (col.weight ?? 0), 0)
  grille.push([{ v: 'Total', style: 'sub' }, { v: sumCoeff ? round2(sumCoeff) : '', style: 'sub' }, { v: '', style: 'sub' }])
  if (cols.length === 0) grille.push([{ v: 'Aucun critère défini', colspan: 3 }])

  downloadWorkbook(`fiches-projets-${slug(programmeName)}.xls`, [
    { name: 'Fiches projets', rows: fiches, colWidths: [130, 170, 150, 190, 100, 80, 260, 260, 260, 240, 240, 120, 220, 70, 90, 100] },
    { name: 'Liste des entretiens', rows: entretiens, colWidths: [180, 150, 120, 120, 130, 110, 160, ...juryNames.map(() => 110)] },
    { name: 'Grille de notation', rows: grille, colWidths: [300, 100, 80] },
  ])
}

// ════════════════════════════════════════════════════════════════════════════
// 3) PROGRAMME WORKSHOPS / CONFÉRENCES  (template: « Programme de Workshop… »)
// ════════════════════════════════════════════════════════════════════════════
export function downloadScheduleWorkbook(programmeName: string, sessions: any[], candidatures: any[] = []) {
  const nameById = new Map<number, string>()
  for (const c of (candidatures ?? [])) if (c.id != null) nameById.set(c.id, projectName(c))
  const startupsOf = (s: any): string => {
    const ids: any[] = s.startupIds ?? []
    if (!ids.length) return ''
    const named = ids.map((id) => nameById.get(Number(id))).filter(Boolean)
    return named.length ? named.join(', ') : `${ids.length} startup(s)`
  }

  const ordered = [...(sessions ?? [])].sort((a, b) => day(a.startDate).localeCompare(day(b.startDate)))

  // — Sheet: Programme Conférences & Workshops (agenda) —
  const agHead = ['Nom', 'Date', 'Intervenant', 'Heure', 'Type', 'Statut', 'Lieu', 'Startups']
  const agenda: Row[] = [
    [{ v: `Programme de Conférences / Workshops — ${programmeName}`, style: 'title', colspan: agHead.length }],
    generatedRow(agHead.length),
    [],
    agHead.map((h) => ({ v: h, style: 'head' })),
  ]
  let agendaRows = 0
  for (const s of ordered) {
    const days: any[] = [...(s.days ?? [])].sort((a, b) => (a.dayOrder ?? 0) - (b.dayOrder ?? 0))
    const activities = days.flatMap((d) => (d.activities ?? []).map((a: any) => ({ d, a })))
    if (activities.length) {
      for (const { d, a } of activities) {
        agenda.push([
          a.title ?? s.title ?? '',
          day(d.date ?? s.startDate),
          joinList(a.guests?.length ? a.guests : a.responsibles) || joinList(s.guests),
          time(a.startTime) + (a.endTime ? ` - ${time(a.endTime)}` : ''),
          ACTIVITY_FR[a.type] ?? a.type ?? '',
          SESSION_FR[s.status] ?? s.status ?? '',
          a.location ?? d.location ?? s.location ?? '',
          startupsOf(s),
        ])
        agendaRows++
      }
    } else {
      // A session with no activity agenda still appears as one schedule row.
      agenda.push([
        s.title ?? '',
        day(s.startDate) + (s.endDate && day(s.endDate) !== day(s.startDate) ? ` → ${day(s.endDate)}` : ''),
        joinList(s.guests) || joinList(s.responsibles),
        '',
        SESSION_FR[s.sessionType] ?? s.sessionType ?? '',
        s.status ?? '',
        s.location ?? '',
        startupsOf(s),
      ])
      agendaRows++
    }
  }
  if (agendaRows === 0) agenda.push([{ v: 'Aucune session planifiée', colspan: agHead.length }])

  // — Sheet: Startups accompagnées (cohort roster) —
  const cohort = [...(candidatures ?? [])]
    .filter((c) => c.status === 'ACCEPTED')
    .sort((a, b) => (finalOf(b) ?? -1) - (finalOf(a) ?? -1))
  const roster = cohort.length ? cohort : [...(candidatures ?? [])].sort((a, b) => (finalOf(b) ?? -1) - (finalOf(a) ?? -1))
  const roHead = ['Startup', 'Porteur', 'Secteur', 'Score final', 'Statut']
  const suivi: Row[] = [
    [{ v: `Startups accompagnées — ${programmeName}`, style: 'title', colspan: roHead.length }],
    [{ v: cohort.length ? `${cohort.length} startup(s) sélectionnée(s)` : 'Aucune startup encore acceptée — liste complète ci-dessous', colspan: roHead.length }],
    [],
    roHead.map((h) => ({ v: h, style: 'head' })),
  ]
  for (const c of roster) {
    const f = finalOf(c)
    suivi.push([
      projectName(c), founder(c), c.sector ?? '',
      f != null ? round2(f) : '',
      { v: STATUS_FR[c.status] ?? c.status ?? '', style: c.status === 'ACCEPTED' ? 'good' : undefined },
    ])
  }
  if (roster.length === 0) suivi.push([{ v: 'Aucune startup', colspan: roHead.length }])

  downloadWorkbook(`programme-workshops-${slug(programmeName)}.xls`, [
    { name: 'Conférences & Workshops', rows: agenda, colWidths: [240, 120, 220, 120, 110, 90, 150, 220] },
    { name: 'Startups accompagnées', rows: suivi, colWidths: [210, 160, 120, 90, 100] },
  ])
}
