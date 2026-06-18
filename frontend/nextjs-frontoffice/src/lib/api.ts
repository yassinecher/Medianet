import axios from 'axios'
import Cookies from 'js-cookie'

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
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      Cookies.remove('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (email: string, password: string) => api.post('/api/auth/login', { email, password }),
  register: (data: unknown) => api.post('/api/auth/register', data),
  me: () => api.get('/api/auth/me'),
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
  delete: (url: string) => api.delete(`/api/files?url=${encodeURIComponent(url)}`),
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
