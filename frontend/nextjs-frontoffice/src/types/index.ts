export type UserRole = 'ADMIN' | 'MENTOR' | 'PORTEUR' | 'JURY'

export interface User {
  id: number
  email: string
  firstName: string
  lastName: string
  /** Primary role string — kept for backward compat */
  role: UserRole
  /** Full set of roles the user has been granted */
  roles?: string[]
  phone?: string
}

export type ProgrammeStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'EVALUATION' | 'CLOSED' | 'CANCELLED'

/** Layout shown to porteurs on /programmes/[id]/candidater */
export type FormTemplate = 'STANDARD' | 'MINIMAL' | 'FOODSTART' | 'TECH' | 'AGRITECH'

export interface Partner { id: number; name: string; logoUrl?: string }

export interface Programme {
  id: number
  title: string
  name?: string           // legacy alias
  description?: string
  type?: string
  domain?: string         // legacy alias
  sectors?: string[]
  region?: string
  location?: string
  latitude?: number
  longitude?: number
  maxApplications?: number
  maxParticipants?: number  // legacy alias
  maxStartups?: number
  status: ProgrammeStatus
  formTemplate?: FormTemplate
  /** JSON-encoded custom form schema. When set, overrides formTemplate. */
  customFormSchema?: string
  startDate?: string
  endDate?: string
  applicationDeadline?: string
  phases?: Phase[]
  criteria?: Criteria[]
  partners?: Partner[]
  // Rich presentation
  tagline?: string
  logoUrl?: string
  bannerImageUrl?: string
  applicationUrl?: string
  // Key stats
  expertCount?: number
  trainingSessionsCount?: number
  mentoringHoursPerMonth?: number
  // Structured lists
  objectives?: string[]
  benefits?: string[]
}

export interface Phase {
  id: number
  programmeId: number
  title?: string
  name?: string           // legacy alias
  description?: string
  startDate?: string
  endDate?: string
  phaseOrder: number
  isActive?: boolean
}

export interface Criteria {
  id: number
  name: string
  description?: string
  weight: number
  criterionOrder: number
  active: boolean
}

/** Canonical statuses matching the backend `CandidatureStatus` enum */
export type CandidatureStatus = 'PENDING' | 'UNDER_EVALUATION' | 'ACCEPTED' | 'REJECTED'

export interface Candidature {
  id: number
  porteurId: number
  programmeId?: number
  programmeName?: string
  projectName: string
  projectDescription?: string
  sector?: string
  fundingRequired?: number
  teamSize?: number
  status: CandidatureStatus
  submittedAt?: string
  /** JSON-encoded answers for custom form fields */
  customAnswers?: string
  evaluation?: { weightedScore?: number; recommendation?: string }
}

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface Task {
  id: number
  title: string
  description?: string
  programmeName?: string
  assignedByName?: string
  dueDate?: string
  priority: TaskPriority
  status: TaskStatus
}
