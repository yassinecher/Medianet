import axios from 'axios'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
export const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } })

api.interceptors.request.use((c) => {
  const t = Cookies.get('admin_token')
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      Cookies.remove('admin_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (email: string, password: string) => api.post('/api/auth/login', { email, password }),
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

export const partnersApi = {
  list: () => api.get('/api/partners'),
  create: (data: { name: string; logoUrl?: string }) => api.post('/api/partners', data),
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
  assignJury: (id: number, data: { juryAssignments: { juryId: number; juryEmail: string; juryName: string }[] }) =>
    api.post(`/api/candidatures/${id}/assign-jury`, data),
  aiScore: (id: number) => api.post(`/api/ai/score/${id}`),
  aiMatch: (candidatureId: number) => api.post(`/api/ai/match/${candidatureId}`),
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
  /** Freeform email to a list of addresses */
  sendEmail: (data: unknown) => api.post('/api/notifications/email/send', data),
}

export const usersApi = {
  list: (params?: object) => api.get('/api/auth/users', { params }),
  byRole: (role: string) => api.get(`/api/auth/users/role/${role}`),
  get: (id: number) => api.get(`/api/auth/users/${id}`),
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
  /** Catalog endpoints */
  rolesCatalog: () => api.get('/api/auth/roles'),
  permissionsCatalog: () => api.get('/api/auth/permissions'),
  /** Profile updates by role */
  updateAdminProfile:   (id: number, data: unknown) => api.put(`/api/auth/users/${id}/profile/admin`, data),
  updateMentorProfile:  (id: number, data: unknown) => api.put(`/api/auth/users/${id}/profile/mentor`, data),
  updatePorteurProfile: (id: number, data: unknown) => api.put(`/api/auth/users/${id}/profile/porteur`, data),
  updateJuryProfile:    (id: number, data: unknown) => api.put(`/api/auth/users/${id}/profile/jury`, data),
}
