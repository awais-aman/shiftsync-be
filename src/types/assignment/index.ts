export type ShiftAssignment = {
  id: string;
  shiftId: string;
  staffId: string;
  staffDisplayName?: string | null;
  staffEmail?: string;
  assignedById: string;
  assignedAt: string;
};

export type ConstraintRule =
  | 'not_certified'
  | 'missing_skill'
  | 'unavailable'
  | 'double_booking'
  | 'min_rest';

export type ConstraintViolation = {
  rule: ConstraintRule;
  severity: 'block';
  message: string;
};

export type ConstraintResult = {
  allowed: boolean;
  blocking: ConstraintViolation[];
};
