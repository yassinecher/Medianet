/**
 * Full-data backup.
 *
 * Aggregates every dataset an admin can read — through the existing gateway APIs
 * — into a single JSON file the admin downloads and keeps. It is a point-in-time
 * snapshot (a "backup file with all data"), not a live sync: nothing is deleted
 * or changed by exporting. Sections that fail to load are recorded rather than
 * aborting the whole backup, so a partial outage still yields a usable file.
 */
import {
  programmesApi, candidaturesApi, notificationsApi, tasksApi, usersApi,
  organizationsApi, partnersApi, rolesApi, contactsApi, contactGroupsApi,
  catalogApi, pitchApi, CATALOG_CATEGORIES,
} from '@/lib/api'

const unwrap = (r: any): any[] => r?.data?.content ?? r?.data ?? []

export interface BackupProgress {
  (step: string): void
}

export interface BackupResult {
  filename: string
  counts: Record<string, number>
  failed: string[]
}

/** Build the backup object, download it as JSON, and return a small summary. */
export async function downloadFullBackup(onStep?: BackupProgress): Promise<BackupResult> {
  const failed: string[] = []
  const counts: Record<string, number> = {}

  // Helper: run one section, record failure instead of throwing.
  const section = async <T>(name: string, run: () => Promise<T>, fallback: T): Promise<T> => {
    onStep?.(name)
    try { return await run() } catch { failed.push(name); return fallback }
  }

  // Top-level collections (each independent).
  const [
    programmes, candidatures, invitations, tasks, users,
    organizations, partners, roles, contacts, contactGroups,
  ] = await Promise.all([
    section('Programmes', () => programmesApi.list().then(unwrap), []),
    section('Candidatures', () => candidaturesApi.all().then(unwrap), []),
    section('Invitations', () => notificationsApi.list().then(unwrap), []),
    section('Tâches', () => tasksApi.all().then(unwrap), []),
    section('Utilisateurs', () => usersApi.list().then(unwrap), []),
    section('Organisations', () => organizationsApi.list().then(unwrap), []),
    section('Partenaires', () => partnersApi.list().then(unwrap), []),
    section('Rôles', () => rolesApi.list().then(unwrap), []),
    section('Contacts', () => contactsApi.list().then(unwrap), []),
    section('Groupes de contacts', () => contactGroupsApi.list().then(unwrap), []),
  ])

  // Catalogs (one call per category).
  const catalogs: Record<string, any[]> = {}
  await Promise.all(Object.values(CATALOG_CATEGORIES).map((cat) =>
    section(`Catalogue ${cat}`, () => catalogApi.list(cat).then(unwrap), []).then((v) => { catalogs[cat] = v })))

  // Pitch submissions are per-programme — pull them for every programme.
  onStep?.('Vidéos & analyses de pitch')
  const pitchSubmissions: any[] = []
  await Promise.all((programmes as any[]).map(async (p) => {
    if (p?.id == null) return
    try { pitchSubmissions.push(...unwrap(await pitchApi.list(p.id))) }
    catch { /* skip this programme's pitches */ }
  }))

  const data: any = {
    programmes, candidatures, invitations, tasks, users,
    organizations, partners, roles, contacts, contactGroups,
    catalogs, pitchSubmissions,
  }
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) counts[k] = v.length
    else if (v && typeof v === 'object') counts[k] = Object.values(v).reduce((a: number, x: any) => a + (Array.isArray(x) ? x.length : 0), 0)
  }

  const backup = {
    _meta: {
      app: 'Medianet Incubateur',
      kind: 'full-data-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      counts,
      failedSections: failed,
    },
    data,
  }

  const filename = `medianet-backup-${new Date().toISOString().slice(0, 10)}.json`
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)

  return { filename, counts, failed }
}
