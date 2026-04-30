import type { UserRole } from '@prisma/client';
import type { Location } from '@/types/location';
import type { Skill } from '@/types/skill';

export type TeamMember = {
  id: string;
  email?: string;
  role: UserRole;
  displayName?: string;
  desiredHoursPerWeek?: number;
  certifications: Location[];
  skills: Skill[];
  managedLocations: Location[];
};
