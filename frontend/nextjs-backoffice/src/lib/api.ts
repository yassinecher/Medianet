import axios from 'axios'
import Cookies from 'js-cookie'
import toast from 'react-hot-toast'

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
export const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } })

api.interceptors.request.use((c) => {
  const t = Cookies.get('admin_token')
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (typeof window !== 'undefined') {
      if (err.response?.status === 401) {
        Cookies.remove('admin_token')
        window.location.href = '/login'
      }
      if (err.response?.status === 403) {
        // Backend 403s carry the missing permission ("Accès refusé — permission
        // requise : users:update"). Toast it globally (deduped) and normalize
        // `data.message` so page-level catch blocks show the same reason.
        const data = err.response.data ?? {}
        const msg: string = data.message ?? data.error ?? 'Accès refusé : permission insuffisante.'
        err.response.data = { ...data, message: msg }
        toast.error(msg, { id: 'forbidden' })
      }
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (email: string, password: string) => api.post('/api/auth/login', { email, password }),
  /** Current account (UserDto — includes allPermissions + directPermissions). */
  me: () => api.get('/api/auth/me'),
  /** Re-issue the JWT with fresh roles/permissions (same payload as login). */
  refresh: () => api.post('/api/auth/refresh'),
}

/**
 * Live auth events (SSE): `permissions-changed`, `account-disabled`, `connected`.
 * Fetch-based (EventSource can't send the Authorization header). Resolves when
 * the stream closes; throws on connection failure — callers reconnect.
 */
export async function streamAuthEvents(
  onEvent: (type: string, payload: any) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = Cookies.get('admin_token')
  if (!token) throw new Error('not authenticated')
  const res = await fetch(`${API_URL}/api/auth/events/stream`, {
    headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`auth events HTTP ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      let eventName = 'message'
      const dataLines: string[] = []
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
      }
      if (dataLines.length === 0) continue
      let payload: any = dataLines.join('\n')
      try { payload = JSON.parse(payload) } catch { /* keep raw string */ }
      onEvent(eventName, payload)
    }
  }
}

/** Role definitions (dynamic RBAC): admins create roles and pick their permissions. */
export interface RoleDto {
  id: number
  name: string
  displayName: string
  description?: string
  /** Built-in role: not renamable/deletable (ADMIN: permission set locked too). */
  systemRole: boolean
  /** Permissions OWNED by the role (excluding inherited). */
  permissions: string[]
  /** Parent role this one inherits from (live: parent edits propagate). */
  parentName?: string | null
  /** Permissions inherited from the parent chain. */
  inheritedPermissions: string[]
  userCount: number
}
export const rolesApi = {
  list:   () => api.get<RoleDto[]>('/api/auth/roles'),
  create: (data: { name: string; displayName: string; description?: string; permissions?: string[]; parentName?: string }) =>
    api.post<RoleDto>('/api/auth/roles', data),
  /** parentName: undefined = unchanged, '' = remove inheritance. */
  update: (id: number, data: Partial<{ name: string; displayName: string; description: string; permissions: string[]; parentName: string }>) =>
    api.put<RoleDto>(`/api/auth/roles/${id}`, data),
  delete: (id: number) => api.delete(`/api/auth/roles/${id}`),
}

export const programmesApi = {
  list: (params?: object) => api.get('/api/programmes', { params }),
  get: (id: number) => api.get(`/api/programmes/${id}`),
  create: (data: unknown) => api.post('/api/programmes', data),
  update: (id: number, data: unknown) => api.put(`/api/programmes/${id}`, data),
  delete: (id: number) => api.delete(`/api/programmes/${id}`),
  phases: (id: number) => api.get(`/api/programmes/${id}/phases`),
  criteria: (id: number) => api.get(`/api/programmes/${id}/criteria`),
  addPhase: (id: number, data: unknown) => api.post(`/api/programmes/${id}/phases`, data),
  updatePhase: (pid: number, phid: number, data: unknown) => api.put(`/api/programmes/${pid}/phases/${phid}`, data),
  deletePhase: (pid: number, phid: number) => api.delete(`/api/programmes/${pid}/phases/${phid}`),
  addCriteria: (id: number, data: unknown) => api.post(`/api/programmes/${id}/criteria`, data),
  addCriterion: (id: number, data: unknown) => api.post(`/api/programmes/${id}/criteria`, data),
  deleteCriterion: (pid: number, cid: number) => api.delete(`/api/programmes/${pid}/criteria/${cid}`),
}

/** The trash — soft-deleted programmes, sessions, tasks and pitch submissions. */
export interface TrashItem { type: 'programme' | 'session' | 'task' | 'pitch'; id: number; label: string; deletedAt: string }
export const trashApi = {
  list: () => api.get<TrashItem[]>('/api/programmes/trash'),
  restore: (type: string, id: number) => api.post(`/api/programmes/trash/${type}/${id}/restore`),
  purge: (type: string, id: number) => api.delete(`/api/programmes/trash/${type}/${id}`),
}

/** Unified Session model — replaces phases vocabulary on the new UI. */
export const sessionsApi = {
  list:    (programmeId: number) => api.get(`/api/programmes/${programmeId}/sessions`),
  create:  (programmeId: number, data: unknown) => api.post(`/api/programmes/${programmeId}/sessions`, data),
  update:  (programmeId: number, sid: number, data: unknown) =>
    api.put(`/api/programmes/${programmeId}/sessions/${sid}`, data),
  delete:  (programmeId: number, sid: number) =>
    api.delete(`/api/programmes/${programmeId}/sessions/${sid}`),
  // Days
  days:    (programmeId: number, sid: number) =>
    api.get(`/api/programmes/${programmeId}/sessions/${sid}/days`),
  addDay:  (programmeId: number, sid: number, data: unknown) =>
    api.post(`/api/programmes/${programmeId}/sessions/${sid}/days`, data),
  updateDay: (programmeId: number, sid: number, dayId: number, data: unknown) =>
    api.put(`/api/programmes/${programmeId}/sessions/${sid}/days/${dayId}`, data),
  deleteDay: (programmeId: number, sid: number, dayId: number) =>
    api.delete(`/api/programmes/${programmeId}/sessions/${sid}/days/${dayId}`),
  // Activities
  addActivity: (programmeId: number, sid: number, dayId: number, data: unknown) =>
    api.post(`/api/programmes/${programmeId}/sessions/${sid}/days/${dayId}/activities`, data),
  updateActivity: (programmeId: number, sid: number, dayId: number, aid: number, data: unknown) =>
    api.put(`/api/programmes/${programmeId}/sessions/${sid}/days/${dayId}/activities/${aid}`, data),
  deleteActivity: (programmeId: number, sid: number, dayId: number, aid: number) =>
    api.delete(`/api/programmes/${programmeId}/sessions/${sid}/days/${dayId}/activities/${aid}`),
}

/** Reusable session presets for the Parcours library (global + per-programme). */
export const sessionPresetsApi = {
  /** Global presets + (optionally) those local to a programme. */
  list:   (programmeId?: number) =>
    api.get('/api/session-presets', { params: programmeId != null ? { programmeId } : {} }),
  create: (data: { programmeId?: number | null; sessionType?: string; title: string; color?: string; durationKind?: string; sortOrder?: number }) =>
    api.post('/api/session-presets', data),
  update: (id: number, data: Partial<{ sessionType: string; title: string; color: string; durationKind: string; sortOrder: number }>) =>
    api.put(`/api/session-presets/${id}`, data),
  delete: (id: number) => api.delete(`/api/session-presets/${id}`),
}

/** Catalog of all session types — drives the SessionType dropdown. */
export const SESSION_TYPES = [
  'CANDIDATURE_SUBMISSION',
  'PRESELECTION',
  'PITCH_DAY',
  'ONBOARDING',
  'INCUBATION',
  'DEMO_DAY',
  'TRAINING_DAY',
] as const
export type SessionType = (typeof SESSION_TYPES)[number]

export const ACTIVITY_TYPES = [
  'ACTIVITY', 'TRAINING_STEP', 'KEYNOTE', 'WORKSHOP',
  'PANEL', 'PITCH', 'BREAK', 'NETWORKING', 'OTHER',
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

/** Organizations + members API. */
export const organizationsApi = {
  list:   (params?: { type?: string; internal?: boolean; createdByUserId?: number }) =>
    api.get('/api/organizations', { params }),
  get:    (id: number) => api.get(`/api/organizations/${id}`),
  create: (data: unknown) => api.post('/api/organizations', data),
  update: (id: number, data: unknown) => api.put(`/api/organizations/${id}`, data),
  delete: (id: number) => api.delete(`/api/organizations/${id}`),
  // Members
  listMembers:   (id: number) => api.get(`/api/organizations/${id}/members`),
  addMember:     (id: number, data: unknown) => api.post(`/api/organizations/${id}/members`, data),
  updateMember:  (id: number, memberId: number, data: unknown) =>
    api.put(`/api/organizations/${id}/members/${memberId}`, data),
  removeMember:  (id: number, memberId: number) =>
    api.delete(`/api/organizations/${id}/members/${memberId}`),
}

export const ORGANIZATION_TYPES = [
  'STARTUP', 'INCUBATOR', 'UNIVERSITY', 'ASSOCIATION',
  'SPONSOR', 'CORPORATE', 'GOVERNMENT', 'OTHER',
] as const
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number]

export const MEMBER_TYPES = ['INTERNAL', 'EXTERNAL'] as const
export type MemberType = (typeof MEMBER_TYPES)[number]

/** Reusable named application-form templates (saved custom schemas). */
export const formTemplatesApi = {
  list:   () => api.get('/api/form-templates'),
  create: (data: { name: string; schemaJson: string }) => api.post('/api/form-templates', data),
  delete: (id: number) => api.delete(`/api/form-templates/${id}`),
}

/** Reusable parcours templates: full session structures with relative dates. */
export const parcoursTemplatesApi = {
  list:   () => api.get('/api/parcours-templates'),
  create: (data: { name: string; structureJson: string; sessionCount: number }) =>
    api.post('/api/parcours-templates', data),
  delete: (id: number) => api.delete(`/api/parcours-templates/${id}`),
}

/** Admin-managed reference lists (organisation types, programme sectors, …). */
export const catalogApi = {
  list:   (category: string) => api.get('/api/catalog', { params: { category } }),
  create: (data: { category: string; value: string; label?: string; sortOrder?: number }) =>
    api.post('/api/catalog', data),
  update: (id: number, data: { label?: string; value?: string; sortOrder?: number; active?: boolean }) =>
    api.put(`/api/catalog/${id}`, data),
  delete: (id: number) => api.delete(`/api/catalog/${id}`),
}
/** Catalogue categories. */
export const CATALOG_CATEGORIES = {
  ORGANIZATION_TYPE: 'organization_type',
  PROGRAMME_SECTOR: 'programme_sector',
  SESSION_TYPE: 'session_type',
} as const

export interface PartnerUpsert {
  name?: string; logoUrl?: string; description?: string; website?: string
  contactEmail?: string; contactPhone?: string; publicVisible?: boolean
}
export const partnersApi = {
  list: () => api.get('/api/partners'),
  create: (data: PartnerUpsert & { name: string }) => api.post('/api/partners', data),
  update: (id: number, data: PartnerUpsert) => api.put(`/api/partners/${id}`, data),
  delete: (id: number) => api.delete(`/api/partners/${id}`),
  addToProgramme: (programmeId: number, partnerId: number) =>
    api.post(`/api/programmes/${programmeId}/partners/${partnerId}`),
  removeFromProgramme: (programmeId: number, partnerId: number) =>
    api.delete(`/api/programmes/${programmeId}/partners/${partnerId}`),
}

/** File upload API (MinIO-backed). Returns absolute URLs the frontend can use directly. */
export const filesApi = {
  /** Upload an image (PNG / JPG / WebP / SVG / GIF). Returns { url }. */
  uploadImage: async (file: File, folder = 'uploads') => {
    const form = new FormData()
    form.append('file', file)
    const r = await api.post<{ url: string }>(
      `/api/files/upload?folder=${encodeURIComponent(folder)}`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return r.data.url
  },
  /** Upload any file type. */
  uploadAny: async (file: File, folder = 'documents') => {
    const form = new FormData()
    form.append('file', file)
    const r = await api.post<{ url: string }>(
      `/api/files/upload-any?folder=${encodeURIComponent(folder)}`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return r.data.url
  },
  /** Delete a previously-uploaded file by URL. */
  delete: (url: string) => api.delete(`/api/files?url=${encodeURIComponent(url)}`),
}

/** AI Assistant API */
export const adminAiApi = {
  info:  () => api.get<{ backend: string; model: string; configured: boolean }>('/api/admin-ai/info'),
  debug: () => api.get('/api/admin-ai/debug'),
  /** Generate or improve a single form field. mode: 'generate' | 'enhance'.
   *  60s client timeout so a saturated provider never leaves the UI spinning. */
  fieldSuggest: (data: { field: string; mode?: 'generate' | 'enhance'; current?: string; context?: string; locale?: string }) =>
    api.post<{ value?: string; values?: string[]; error?: string }>('/api/admin-ai/field-suggest', data, { timeout: 60000 }),
  // ── Settings ────────────────────────────────────────────────────────────
  getSettings: () => api.get('/api/admin-ai/settings'),
  updateSettings: (data: {
    apiKey?: string | null; model?: string; baseUrl?: string;
    temperature?: number; maxTokens?: number;
    provider?: string; fallbackModels?: string;
    unsplashAccessKey?: string | null;
    pexelsApiKey?: string | null
  }) => api.put('/api/admin-ai/settings', data),
  testConnection: (data: { apiKey?: string; model?: string }) =>
    api.post('/api/admin-ai/settings/test', data),
  // ── Models catalog ──────────────────────────────────────────────────────
  models: (params?: {
    q?: string; freeOnly?: boolean; toolsOnly?: boolean; visionOnly?: boolean;
    provider?: string; minContext?: number; refresh?: boolean
  }) => api.get('/api/admin-ai/models', { params }),
  // ── Chat / conversations / actions ──────────────────────────────────────
  chat: (data: { conversationId?: number; message: string }, signal?: AbortSignal) =>
    api.post<{
      conversationId: number; text: string;
      pendingActionIds: number[]; suggestions?: string[];
      clarification?: {
        question: string
        multiSelect: boolean
        options: Array<{ label: string; description?: string }>
      }
      plan?: {
        title: string
        summary?: string
        steps: Array<{
          label: string
          tool: string
          args: Record<string, any>
          optional?: boolean
          dependsOnStep?: number
          fillField?: string
        }>
      }
    }>('/api/admin-ai/chat', data, { signal }),
  /**
   * Live variant of chat — POSTs to the SSE endpoint and invokes `onEvent` for
   * each named event (`status`, `tool_start`, `tool_end`, `action_proposed`,
   * `text`, `done`, `error`). Resolves once the stream closes. Throws before
   * the first event if the endpoint is unreachable (caller falls back to the
   * blocking chat()).
   */
  chatStream: async (
    data: { conversationId?: number; message: string },
    onEvent: (type: string, payload: any) => void,
    signal?: AbortSignal,
  ): Promise<void> => {
    const token = Cookies.get('admin_token')
    const res = await fetch(`${API_URL}/api/admin-ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
      signal,
    })
    if (!res.ok || !res.body) throw new Error(`stream HTTP ${res.status}`)
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('text/event-stream')) throw new Error(`unexpected content-type: ${ct}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      // SSE frames are separated by a blank line
      let idx: number
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        let eventName = 'message'
        const dataLines: string[] = []
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim()
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
        }
        if (dataLines.length === 0) continue
        let payload: any = dataLines.join('\n')
        try { payload = JSON.parse(payload) } catch { /* keep raw string */ }
        onEvent(eventName, payload)
      }
    }
  },
  /** Execute a (possibly edited) action plan from the wizard. */
  executePlan: (data: { conversationId?: number; plan: any }) =>
    api.post<{ ok: number; failed: number; results: any[] }>('/api/admin-ai/plan/execute', data),
  /** Generate JSON content for a single landing-page section (no agent loop). */
  landingSuggest: (data: { section: string; brief?: string; locale?: string }) =>
    api.post<Record<string, any>>('/api/admin-ai/landing-suggest', data),
  /** Image search for the editors — same provider chain as the AI's search_photos tool. */
  searchPhotos: (data: { query: string; context?: string; count?: number; width?: number; height?: number }) =>
    api.post<{
      items: Array<{ url: string; thumbnail?: string; credit?: string; title?: string; size?: string }>
      query: string; source: string; count: number
    }>('/api/admin-ai/search-photos', data),
  conversations: () => api.get('/api/admin-ai/conversations'),
  messages: (id: number) => api.get(`/api/admin-ai/conversations/${id}/messages`),
  deleteConversation: (id: number) => api.delete(`/api/admin-ai/conversations/${id}`),
  actions: (status?: string) => api.get('/api/admin-ai/actions', { params: status ? { status } : {} }),
  confirm: (id: number) => api.post(`/api/admin-ai/actions/${id}/confirm`),
  cancel:  (id: number) => api.post(`/api/admin-ai/actions/${id}/cancel`),
  revert:  (id: number) => api.post(`/api/admin-ai/actions/${id}/revert`),
}

/** Pitch / presentation-day submissions. */
export interface PitchSubmissionDto {
  id: number
  programmeId: number
  sessionId?: number | null
  kind?: 'TRAINING' | 'FINAL'
  porteurId: number
  porteurName?: string
  companyName?: string
  projectName?: string
  title?: string
  videoUrl?: string
  videoFilename?: string
  transcript?: string
  autoTranscribed?: boolean
  durationSeconds?: number | null
  notes?: string
  status: 'DRAFT' | 'SUBMITTED' | 'PROCESSING' | 'ANALYZED' | 'FAILED'
  aiScore?: number | null
  aiAnalysisJson?: string | null
  aiEnhanced?: boolean
  analyzedAt?: string
  updatedAt?: string
}
export const pitchApi = {
  /** Admin/reviewer: all submissions for a programme (optionally one session). */
  list: (programmeId: number, sessionId?: number) =>
    api.get<PitchSubmissionDto[]>('/api/pitch/submissions', { params: { programmeId, ...(sessionId ? { sessionId } : {}) } }),
  get: (id: number) => api.get<PitchSubmissionDto>(`/api/pitch/submissions/${id}`),
  /** Porteur: create/update own submission. */
  upsert: (data: Partial<PitchSubmissionDto>) => api.post<PitchSubmissionDto>('/api/pitch/submissions', data),
  mine: () => api.get<PitchSubmissionDto[]>('/api/pitch/submissions/mine'),
  /** Presentation sessions of a programme + caller's submission per session. */
  presentations: (programmeId: number) => api.get<any[]>(`/api/pitch/presentations/${programmeId}`),
  /** Save the AI analysis result on a submission. */
  saveAnalysis: (id: number, aiScore: number | null, aiAnalysisJson: string) =>
    api.put<PitchSubmissionDto>(`/api/pitch/submissions/${id}/analysis`, { aiScore, aiAnalysisJson }),
  /** Run the AI pitch analysis (returns score + advice; does not persist). */
  analyze: (submissionId: number) => api.post<any>('/api/admin-ai/pitch/analyze', { submissionId }),
}

/** Reports module — aggregated statistics from each service (reports:read). */
export const reportsApi = {
  users:        () => api.get('/api/auth/reports/users'),
  candidatures: () => api.get('/api/candidatures/reports'),
  programmes:   () => api.get('/api/programmes/reports'),
  invitations:  () => api.get('/api/notifications/reports'),
  // Programme-scoped variants (Rapports tab of a programme)
  programmeCandidatures: (programmeId: number) =>
    api.get(`/api/candidatures/reports/programme/${programmeId}`),
  programmeSessions: (programmeId: number) =>
    api.get(`/api/programmes/reports/${programmeId}`),
  programmeInvitations: (programmeId: number) =>
    api.get(`/api/notifications/reports/programme/${programmeId}`),
}

/** Landing page admin API */
export const landingPageApi = {
  get:    () => api.get('/api/landing-page'),
  update: (data: unknown) => api.put('/api/landing-page', data),
  reset:  () => api.post('/api/landing-page/reset'),
}

export const candidaturesApi = {
  list: (params?: object) => api.get('/api/candidatures', { params }),
  all: (params?: object) => api.get('/api/candidatures', { params }),
  get: (id: number) => api.get(`/api/candidatures/${id}`),
  byProgramme: (id: number, status?: string) => api.get(`/api/candidatures/programme/${id}`, { params: { status } }),
  programmeStats: (id: number) => api.get(`/api/candidatures/programme/${id}/stats`),
  /** JURY scoring */
  evaluate: (id: number, data: unknown) => api.post(`/api/candidatures/${id}/evaluate`, data),
  /** ADMIN final decision */
  accept: (id: number) => api.patch(`/api/candidatures/${id}/accept`),
  reject: (id: number, reason: string) => api.patch(`/api/candidatures/${id}/reject`, { reason }),
  assignJury: (id: number, data: { juryAssignments: { juryId?: number; juryEmail: string; juryName: string }[]; phaseId?: number }) =>
    api.post(`/api/candidatures/${id}/assign-jury`, data),
  /** Change the jury: remove a single assignment (others keep their links). */
  removeJury: (id: number, assignmentId: number) => api.delete(`/api/candidatures/${id}/jury/${assignmentId}`),
  /** Medi (LLM) scoring — full-context candidature evaluation (programme + org + team + responses). */
  mediScore: (id: number) => api.post(`/api/admin-ai/score/${id}`),
  /** Saved candidature-list versions (shortlists) for the Présélection session */
  listSelections:  (programmeId: number) => api.get(`/api/candidatures/programme/${programmeId}/selections`),
  createSelection: (programmeId: number, data: { name: string; candidatureIds: number[] }) =>
    api.post(`/api/candidatures/programme/${programmeId}/selections`, data),
  updateSelection: (id: number, data: { name?: string; candidatureIds?: number[] }) =>
    api.put(`/api/candidatures/selections/${id}`, data),
  deleteSelection: (id: number) => api.delete(`/api/candidatures/selections/${id}`),
}

export const tasksApi = {
  /** ADMIN / MENTOR — list all tasks, optional ?status= or ?programmeId= */
  all: (params?: object) => api.get('/api/tasks', { params }),
  /** ADMIN / MENTOR — list tasks for one programme */
  byProgramme: (programmeId: number) => api.get(`/api/programmes/${programmeId}/tasks`),
  /** ADMIN / MENTOR — create. The payload must include programmeId. */
  create: (data: unknown) => api.post('/api/tasks', data),
  /** ADMIN / MENTOR — full update */
  update: (id: number, data: unknown) => api.put(`/api/tasks/${id}`, data),
  /** Self-update of status (porteur) OR convenience for admin/mentor */
  updateStatus: (id: number, data: { status: string }) => api.patch(`/api/tasks/${id}/status`, data),
  /** ADMIN / MENTOR — review a submitted deliverable: approve → COMPLETED, else → IN_PROGRESS */
  review: (id: number, data: { approve: boolean; reviewNote?: string }) => api.patch(`/api/tasks/${id}/review`, data),
  /** ADMIN — delete */
  delete: (id: number) => api.delete(`/api/tasks/${id}`),
}

export const notificationsApi = {
  /** ADMIN — list every invitation, newest first */
  list: (params?: object) => api.get('/api/notifications/invitations', { params }),
  get: (id: number) => api.get(`/api/notifications/invitations/${id}`),
  byProgramme: (programmeId: number, params?: object) =>
    api.get(`/api/notifications/invitations/programme/${programmeId}`, { params }),
  /** Global counts (status, type) */
  stats: () => api.get('/api/notifications/invitations/stats'),
  programmeStats: (programmeId: number) =>
    api.get(`/api/notifications/invitations/programme/${programmeId}/stats`),
  /** ADMIN — create + send one invitation */
  create: (data: unknown) => api.post('/api/notifications/invitations', data),
  /** ADMIN — bulk send same invitation to many recipients */
  bulk: (data: unknown) => api.post('/api/notifications/invitations/bulk', data),
  bulkInvite: (data: unknown) => api.post('/api/notifications/invitations/bulk', data),
  /** Resend the email for a PENDING / FAILED invitation */
  resend: (id: number) => api.post(`/api/notifications/invitations/${id}/resend`),
  /** Cancel / delete an invitation (token becomes invalid) */
  cancel: (id: number) => api.delete(`/api/notifications/invitations/${id}`),
  /** Invitations tied to a specific session (phase) / activity */
  byPhase: (phaseId: number) => api.get(`/api/notifications/invitations/phase/${phaseId}`),
  byActivity: (activityId: number) => api.get(`/api/notifications/invitations/activity/${activityId}`),
  /** Freeform email to a list of addresses */
  sendEmail: (data: unknown) => api.post('/api/notifications/email/send', data),
  /** Notify a session's participants (per-type emails) + archive each send */
  sessionNotify: (data: unknown) => api.post('/api/notifications/email/session-notify', data),
}

/** Managed contact list — reusable invitees curated by admins. */
export const contactsApi = {
  list:   () => api.get('/api/notifications/contacts'),
  create: (data: { name: string; email: string; organization?: string; tag?: string }) =>
    api.post('/api/notifications/contacts', data),
  update: (id: number, data: Partial<{ name: string; email: string; organization: string; tag: string }>) =>
    api.put(`/api/notifications/contacts/${id}`, data),
  delete: (id: number) => api.delete(`/api/notifications/contacts/${id}`),
}

/** Mailing groups / lists — named sets of contact ids. */
export const contactGroupsApi = {
  list:   () => api.get('/api/notifications/contact-groups'),
  create: (data: { name: string; color?: string; contactIds?: number[] }) =>
    api.post('/api/notifications/contact-groups', data),
  update: (id: number, data: Partial<{ name: string; color: string; contactIds: number[] }>) =>
    api.put(`/api/notifications/contact-groups/${id}`, data),
  delete: (id: number) => api.delete(`/api/notifications/contact-groups/${id}`),
}

export const usersApi = {
  list: (params?: object) => api.get('/api/auth/users', { params }),
  byRole: (role: string) => api.get(`/api/auth/users/role/${role}`),
  get: (id: number) => api.get(`/api/auth/users/${id}`),
  /** Look up a single user by email (404 when no account exists) */
  byEmail: (email: string) => api.get('/api/auth/users/by-email', { params: { email } }),
  /** Toggle active/disabled */
  toggleActive: (id: number) => api.patch(`/api/auth/users/${id}/toggle-active`),
  /** Set the single primary role (PORTEUR/JURY/MENTOR/ADMIN) */
  setRole: (id: number, role: string) => api.patch(`/api/auth/users/${id}/role`, { role }),
  /** Sync the full role set */
  syncRoles: (id: number, roles: string[]) => api.put(`/api/auth/users/${id}/roles`, { roles }),
  /** Add roles to existing */
  assignRoles: (id: number, roles: string[]) => api.post(`/api/auth/users/${id}/roles/assign`, { roles }),
  /** Remove specific roles */
  removeRoles: (id: number, roles: string[]) => api.post(`/api/auth/users/${id}/roles/remove`, { roles }),
  /** Edit a user's basic data (name + email) */
  updateUser: (id: number, data: { firstName?: string; lastName?: string; email?: string }) =>
    api.put(`/api/auth/users/${id}`, data),
  /** Direct permission management (server auto-adds read for create/update/delete) */
  grantPermissions:  (id: number, permissions: string[]) => api.post(`/api/auth/users/${id}/permissions/grant`, { permissions }),
  revokePermissions: (id: number, permissions: string[]) => api.post(`/api/auth/users/${id}/permissions/revoke`, { permissions }),
  syncPermissions:   (id: number, permissions: string[]) => api.put(`/api/auth/users/${id}/permissions`, { permissions }),
  /**
   * Grouped permission catalog: modules with labels/descriptions and
   * GENERAL/ADMIN scopes (see CatalogModule in components/PermissionMatrix).
   * Role catalog: see rolesApi.list.
   */
  permissionsCatalog: () => api.get('/api/auth/permissions'),
  /** Profile updates by role */
  updateAdminProfile:   (id: number, data: unknown) => api.put(`/api/auth/users/${id}/profile/admin`, data),
  updateMentorProfile:  (id: number, data: unknown) => api.put(`/api/auth/users/${id}/profile/mentor`, data),
  updatePorteurProfile: (id: number, data: unknown) => api.put(`/api/auth/users/${id}/profile/porteur`, data),
  updateJuryProfile:    (id: number, data: unknown) => api.put(`/api/auth/users/${id}/profile/jury`, data),
}

/** Sociétés incubées — admin-managed alumni catalogue (public FO page). */
export interface IncubatedUpsert {
  name?: string; logoUrl?: string; description?: string; website?: string
  sector?: string; cohortYear?: string; publicVisible?: boolean; sortOrder?: number
}
export const incubatedAdminApi = {
  list: () => api.get('/api/incubated-companies'),
  create: (data: IncubatedUpsert & { name: string }) => api.post('/api/incubated-companies', data),
  update: (id: number, data: IncubatedUpsert) => api.put(`/api/incubated-companies/${id}`, data),
  delete: (id: number) => api.delete(`/api/incubated-companies/${id}`),
}
