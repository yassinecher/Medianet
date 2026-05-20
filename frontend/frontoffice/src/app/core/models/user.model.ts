export interface AdminProfile {
  id?: number;
  department?: string;
  phoneNumber?: string;
  adminLevel?: string;
  lastLoginAt?: string;
}

export interface MentorProfile {
  id?: number;
  title?: string;
  bio?: string;
  expertise?: string[];
  specializations?: string[];
  rating?: number;
  availability?: string;
  linkedInUrl?: string;
  website?: string;
  yearsOfExperience?: number;
  sessionCount?: number;
}

export interface PorteurProfile {
  id?: number;
  company?: string;
  sector?: string;
  city?: string;
  phoneNumber?: string;
  website?: string;
  linkedInUrl?: string;
  bio?: string;
  candidatureCount?: number;
}

export interface JuryProfile {
  id?: number;
  title?: string;
  bio?: string;
  affiliation?: string;
  expertise?: string[];
  linkedInUrl?: string;
  evaluationCount?: number;
  averageScore?: number;
}

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  directPermissions: string[];
  allPermissions: string[];
  /** Primary role (backward compat) */
  role: string;
  active: boolean;
  createdAt: string;
  adminProfile?:   AdminProfile   | null;
  mentorProfile?:  MentorProfile  | null;
  porteurProfile?: PorteurProfile | null;
  juryProfile?:    JuryProfile    | null;
}

export interface AuthResponse {
  token: string;
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  /** Primary role (backward compat) */
  role: string;
}
