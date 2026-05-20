export interface Candidature {
  id: number;
  sessionId: number;
  porteurId: number;
  porteurEmail: string;
  porteurName: string;
  projectName: string;
  projectDescription: string;
  domain: string;
  targetMarket: string;
  currentStage: string;
  teamSize: number;
  techStack: string;
  problemStatement: string;
  solutionDescription: string;
  businessModel: string;
  teamBackground: string;
  status: 'PENDING' | 'UNDER_EVALUATION' | 'ACCEPTED' | 'REJECTED';
  totalScore: number | null;
  rejectionReason: string | null;
  submittedAt: string;
  updatedAt: string;
  evaluations: Evaluation[];
  juryAssignments: JuryAssignment[];
}

export interface Evaluation {
  id: number;
  candidatureId: number;
  juryId: number;
  juryEmail: string;
  juryName: string;
  innovationScore: number;
  feasibilityScore: number;
  marketImpactScore: number;
  teamQualityScore: number;
  weightedScore: number;
  comment: string;
  evaluatedAt: string;
}

export interface JuryAssignment {
  id: number;
  candidatureId: number;
  juryId: number;
  juryEmail: string;
  juryName: string;
  assignedAt: string;
}

export interface CandidatureStats {
  total: number;
  pending: number;
  underEvaluation: number;
  accepted: number;
  rejected: number;
}
