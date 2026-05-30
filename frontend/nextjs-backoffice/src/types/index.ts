export interface User {
  id: number
  email: string
  firstName: string
  lastName: string
  /** Primary role string — kept for backward compat */
  role: string
  /** Full set of role names assigned to the user */
  roles?: string[]
  phone?: string
  /** Whether the account is enabled (legacy alias) */
  enabled?: boolean
  /** Backend canonical field */
  active?: boolean
  createdAt?: string
}
export type ProgrammeStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'EVALUATION' | 'CLOSED' | 'CANCELLED'
/** Layout shown to porteurs on /programmes/[id]/candidater */
export type FormTemplate = 'STANDARD' | 'MINIMAL' | 'FOODSTART' | 'TECH' | 'AGRITECH'
export interface Partner { id: number; name: string; logoUrl?: string; createdAt?: string }
export interface Programme {
  id: number; title: string; name?: string; description?: string
  type?: string; domain?: string; sectors?: string[]; region?: string
  latitude?: number; longitude?: number
  maxApplications?: number; maxParticipants?: number; maxStartups?: number
  status: ProgrammeStatus
  formTemplate?: FormTemplate
  /** JSON-encoded custom form schema. When set, overrides formTemplate. */
  customFormSchema?: string
  startDate?: string; endDate?: string; applicationDeadline?: string
  phases?: Phase[]; criteria?: Criteria[]; partners?: Partner[]
  // Rich presentation
  tagline?: string; logoUrl?: string; bannerImageUrl?: string
  location?: string; applicationUrl?: string
  // Key stats
  expertCount?: number; trainingSessionsCount?: number; mentoringHoursPerMonth?: number
  // Structured lists
  objectives?: string[]; benefits?: string[]
}
export interface Phase { id?: number; programmeId?: number; title: string; name?: string; description?: string; startDate?: string; endDate?: string; phaseOrder?: number; order?: number; isActive?: boolean }
export interface Criteria { id?: number; programmeId?: number; name: string; description?: string; weight: number; maxScore?: number; criterionOrder?: number; active?: boolean; aiGenerated?: boolean }
/** Canonical statuses matching the backend `CandidatureStatus` enum */
export type CandidatureStatus = 'PENDING' | 'UNDER_EVALUATION' | 'ACCEPTED' | 'REJECTED'
export interface Candidature {
  id: number
  programmeId?: number
  programmeName?: string
  projectName?: string
  projectDescription?: string
  sector?: string
  fundingRequired?: number
  teamSize?: number
  status: string
  submittedAt?: string
  createdAt?: string
  aiScore?: number
  aiComment?: string
  scoreBreakdown?: Record<string, number>
  applicant?: { id: number; firstName: string; lastName: string; email: string }
  // legacy flat fields
  porteurId?: number
  porteurFirstName?: string
  porteurLastName?: string
  porteurEmail?: string
  /** JSON-encoded answers for custom form fields */
  customAnswers?: string
  evaluation?: Evaluation
}
export interface Evaluation { id: number; innovationScore?: number; feasibilityScore?: number; marketImpactScore?: number; teamQualityScore?: number; criteriaScores?: { criteriaId: number; criteriaName: string; score: number; weight: number }[]; globalComment?: string; weightedScore?: number; recommendation?: string }
export interface AiScoreResult { candidatureId: number; projectName: string; dynamicMode: boolean; innovation?: { score: number; commentary?: string }; feasibility?: { score: number; commentary?: string }; marketImpact?: { score: number; commentary?: string }; teamQuality?: { score: number; commentary?: string }; dynamicScores?: { criteriaId: number; criteriaName: string; weight: number; score: number; commentary?: string }[]; weightedScore: number; globalCommentary?: string; recommendation: 'ACCEPT' | 'REVIEW' | 'REJECT'; aiEnhanced: boolean }
/** Canonical statuses matching the backend `TaskStatus` enum */
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export interface Task { id: number; programmeId?: number; programmeName?: string; assignedToUserId?: number; assigneeId?: number; assignedToEmail?: string; assignedToName?: string; assignee?: { id: number; firstName: string; lastName: string; email: string }; assignedByUserId?: number; assignedByName?: string; title: string; description?: string; dueDate?: string; priority?: TaskPriority; status: string; completedAt?: string; createdAt?: string }
export interface Invitation { id: number; programmeId?: number; programmeName?: string; recipientEmail: string; recipientName?: string; type: string; status: string; requiresRsvp: boolean; rsvpDeadline?: string; sentAt?: string; respondedAt?: string; createdAt?: string }
export interface ProgrammeStats { total: number; soumises: number; enCoursEvaluation: number; acceptees: number; refusees: number; listeAttente: number }
