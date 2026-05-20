export interface Session {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  submissionDeadline: string;
  status: 'OPEN' | 'EVALUATION' | 'CLOSED' | 'CANCELLED';
  maxProjects: number;
  createdByAdminId: number;
  createdByAdminName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionStats {
  total: number;
  open: number;
  evaluation: number;
  closed: number;
  cancelled: number;
}
