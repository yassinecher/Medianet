import axios from 'axios'
import Cookies from 'js-cookie'
import toast from 'react-hot-toast'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } })

api.interceptors.request.use((config) => {
  const token = Cookies.get('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (typeof window !== 'undefined') {
      if (error.response?.status === 401) {
        Cookies.remove('token')
        window.location.href = '/login'
      }
      if (error.response?.status === 403) {
        // Backend 403s name the missing permission — show it (deduped) and
        // normalize `data.message` for page-level catch blocks.
        const data = error.response.data ?? {}
        const msg: string = data.message ?? data.error ?? 'Accès refusé : permission insuffisante.'
        error.response.data = { ...data, message: msg }
        toast.error(msg, { id: 'forbidden' })
      }
    }
    return Promise.reject(error)
  }
)

/**
 * Live auth events (SSE): `permissions-changed`, `account-disabled`, `connected`.
 * Fetch-based (EventSource can't send the Authorization header). Resolves when
 * the stream closes; throws on connection failure — callers reconnect.
 */
export async function streamAuthEvents(
  onEvent: (type: string, payload: any) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = Cookies.get('token')
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

export const authApi = {
  login: (email: string, password: string) => api.post('/api/auth/login', { email, password }),
  register: (data: unknown) => api.post('/api/auth/register', data),
  me: () => api.get('/api/auth/me'),
  /** Re-issue the JWT with fresh roles/permissions (same payload as login). */
  refresh: () => api.post('/api/auth/refresh'),
  /** Update first/last name + optionally change password (requires currentPassword). */
  updateProfile: (data: {
    firstName: string
    lastName: string
    currentPassword?: string
    newPassword?: string
  }) => api.put('/api/auth/profile', data),
  /** Self-service porteur profile (bio, company, social links, avatar, headline…). */
  updatePorteurProfile: (data: {
    company?: string
    sector?: string
    city?: string
    phoneNumber?: string
    website?: string
    linkedInUrl?: string
    avatarUrl?: string
    headline?: string
    twitterUrl?: string
    bio?: string
  }) => api.put('/api/auth/profile/porteur', data),
}

export const landingPageApi = {
  get: () => api.get('/api/landing-page'),
}

/** File upload API (MinIO-backed). Returns an absolute URL the frontend uses directly. */
export const filesApi = {
  uploadImage: async (file: File, folder = 'avatars') => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await api.post(
      `/api/files/upload?folder=${encodeURIComponent(folder)}`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return (r.data?.url ?? r.data) as string
  },
  /** Upload a pitch video (up to 250 MB). Returns { url, filename }. */
  uploadVideo: async (file: File, folder = 'pitch-videos', onProgress?: (pct: number) => void) => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await api.post<{ url: string; filename: string }>(
      `/api/files/upload-video?folder=${encodeURIComponent(folder)}`,
      fd,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
        },
      },
    )
    return r.data
  },
  delete: (url: string) => api.delete(`/api/files?url=${encodeURIComponent(url)}`),
}

/** Pitch / presentation-day submissions (porteur side). */
export interface PitchSubmission {
  id: number
  programmeId: number
  sessionId?: number | null
  kind?: 'TRAINING' | 'FINAL'
  organizationId?: number
  companyName?: string
  projectName?: string
  title?: string
  videoUrl?: string
  videoFilename?: string
  transcript?: string
  autoTranscribed?: boolean
  /** Whisper segments [{start,end,text}] as JSON — transcript panel + markers. */
  segmentsJson?: string | null
  durationSeconds?: number | null
  notes?: string
  status: 'DRAFT' | 'SUBMITTED' | 'PROCESSING' | 'ANALYZED' | 'FAILED'
  aiScore?: number | null
  aiAnalysisJson?: string | null
  analyzedAt?: string
  updatedAt?: string
}
export const pitchApi = {
  mine: () => api.get<PitchSubmission[]>('/api/pitch/submissions/mine'),
  get: (id: number) => api.get<PitchSubmission>(`/api/pitch/submissions/${id}`),
  upsert: (data: Partial<PitchSubmission>) => api.post<PitchSubmission>('/api/pitch/submissions', data),
  /** Presentation sessions of a programme + my submissions per session. */
  presentations: (programmeId: number) => api.get<any[]>(`/api/pitch/presentations/${programmeId}`),
  /** Move a submission to PROCESSING / FAILED. */
  setStatus: (id: number, status: string) => api.put<PitchSubmission>(`/api/pitch/submissions/${id}/status`, { status }),
  /** Run AI analysis (auto-transcribe + video; returns score + advice; not persisted).
   *  No client timeout — CPU Whisper on a few-minute clip can take a while. */
  analyze: (submissionId: number) => api.post<any>('/api/admin-ai/pitch/analyze', { submissionId }, { timeout: 0 }),
  /** Persist the AI analysis (+ auto-transcript + segments) on the submission. */
  saveAnalysis: (id: number, result: any) =>
    api.put<PitchSubmission>(`/api/pitch/submissions/${id}/analysis`, {
      aiScore: result?.overallScore ?? null,
      aiAnalysisJson: JSON.stringify(result),
      transcript: result?.transcript,
      autoTranscribed: result?.autoTranscribed,
      durationSeconds: result?.durationSeconds,
      segmentsJson: result?.segmentsJson,
    }),
}

/** Whisper segment — one spoken chunk with its timestamps. */
export interface TranscriptSegment { start: number; end: number; text: string }

/**
 * Live pitch analysis over SSE — streams the real pipeline stages
 * (transcription, élocution, vision, criteria, LLM) then a final `done` event
 * carrying the full analysis. Fetch-based (EventSource can't send auth headers).
 */
export async function streamPitchAnalysis(
  submissionId: number,
  onEvent: (type: string, payload: any) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = Cookies.get('token')
  const res = await fetch(`${API_URL}/api/admin-ai/pitch/analyze/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ submissionId }),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`analyse HTTP ${res.status}`)

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
      try { payload = JSON.parse(payload) } catch { /* keep raw */ }
      onEvent(eventName, payload)
    }
  }
}

/** Org-member token invitation: a porteur added me to their organisation. */
export const orgInvitationsApi = {
  get: (token: string) => api.get(`/api/auth/org-invitations/${token}`),
  accept: (token: string, data: { firstName: string; lastName: string; password: string }) =>
    api.post(`/api/auth/org-invitations/${token}`, data),
}

export const programmesApi = {
  list: (params?: object) => api.get('/api/programmes', { params }),
  get: (id: number) => api.get(`/api/programmes/${id}`),
  phases: (id: number) => api.get(`/api/programmes/${id}/phases`),
  criteria: (id: number) => api.get(`/api/programmes/${id}/criteria`),
  partners: (id: number) => api.get(`/api/programmes/${id}/partners`),
}

export const candidaturesApi = {
  myList: () => api.get('/api/candidatures/my'),
  get: (id: number) => api.get(`/api/candidatures/${id}`),
  submit: (data: unknown) => api.post('/api/candidatures', data),
}

/** Public, no-login jury evaluation via an emailed token. */
export const evaluationApi = {
  getByToken: (token: string) => api.get(`/api/candidatures/evaluate/${token}`),
  submitByToken: (token: string, data: unknown) =>
    api.post(`/api/candidatures/evaluate/${token}`, data),
}

/** Medi (AI) scoring — full-context candidature evaluation. ADMIN + JURY. */
export const mediApi = {
  score: (candidatureId: number) => api.post(`/api/admin-ai/score/${candidatureId}`),
}

/** Logged-in jury (JURY role): candidatures assigned to me + submit a score. */
export const juryApi = {
  myAssignments: () => api.get('/api/candidatures/my-jury-assignments'),
  candidature: (id: number) => api.get(`/api/candidatures/${id}`),
  evaluate: (id: number, data: unknown) => api.post(`/api/candidatures/${id}/evaluate`, data),
}

export const tasksApi = {
  myTasks: () => api.get('/api/tasks/my'),
  updateStatus: (id: number, data: { status: string }) => api.patch(`/api/tasks/${id}/status`, data),
}

/** Organizations — porteurs list and pick their own; the same API also exposes
 *  partner/sponsor organisations the admin has registered. */
export const organizationsApi = {
  list:   (params?: { type?: string; internal?: boolean; createdByUserId?: number; memberUserId?: number }) =>
    api.get('/api/organizations', { params }),
  get:    (id: number) => api.get(`/api/organizations/${id}`),
  create: (data: {
    name: string
    type?: string
    description?: string
    sector?: string
    city?: string
    country?: string
    website?: string
    contactEmail?: string
    contactPhone?: string
    logoUrl?: string
  }) => api.post('/api/organizations', data),
  update: (id: number, data: unknown) => api.put(`/api/organizations/${id}`, data),
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

/** Member kind — INTERNAL (founding team) vs EXTERNAL (advisor, partner…). */
export const MEMBER_TYPES = ['INTERNAL', 'EXTERNAL'] as const

/** Admin-managed reference lists (organisation types, sectors…). Read-only here. */
export const catalogApi = {
  list: (category: string) => api.get('/api/catalog', { params: { category } }),
}
export const CATALOG_CATEGORIES = {
  ORGANIZATION_TYPE: 'organization_type',
  PROGRAMME_SECTOR: 'programme_sector',
} as const

export const notificationsApi = {
  rsvpAccept: (token: string) => axios.post(`${API_URL}/api/notifications/invitations/rsvp/${token}/accept`),
  rsvpDecline: (token: string) => axios.post(`${API_URL}/api/notifications/invitations/rsvp/${token}/decline`),
}
