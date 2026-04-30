import type { ShiftStatus } from '@prisma/client';
import type { Location } from '@/types/location';
import type { Skill } from '@/types/skill';

export type Shift = {
  id: string;
  locationId: string;
  startAt: string;
  endAt: string;
  requiredSkillId: string;
  headcount: number;
  isPremium: boolean;
  status: ShiftStatus;
  publishedAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  location?: Location;
  requiredSkill?: Skill;
};
