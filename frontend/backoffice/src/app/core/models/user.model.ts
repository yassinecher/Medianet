// ── Role-specific profile interfaces ──────────────────────────────────────

export interface AdminProfile {
  id?: number;
  department?: string;
  phoneNumber?: string;
  adminLevel?: string;      // SUPER_ADMIN | ADMIN
  lastLoginAt?: string;
}

export interface MentorProfile {
  id?: number;
  title?: string;
  bio?: string;
  expertise?: string[];
  specializations?: string[];
  rating?: number;
  availability?: string;    // FULL_TIME | PART_TIME | WEEKENDS | ON_DEMAND
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

// ── Main user model ────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;

  /** All role names, e.g. ["ADMIN", "MENTOR"] */
  roles: string[];

  /** Direct permission slugs granted to this user */
  directPermissions: string[];

  /** Effective permissions = direct + all role permissions */
  allPermissions: string[];

  /** Primary role name – kept for backward compat */
  role: string;

  active: boolean;
  createdAt: string;

  // Role-specific profiles (null when role not assigned)
  adminProfile?:   AdminProfile  | null;
  mentorProfile?:  MentorProfile | null;
  porteurProfile?: PorteurProfile | null;
  juryProfile?:    JuryProfile   | null;
}

export interface AuthResponse {
  token: string;
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  role: string;
}

/** slug → human-readable label */
export interface PermissionCatalog {
  [slug: string]: string;
}

/** role name → human-readable label */
export interface RoleCatalog {
  [name: string]: string;
}
