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
  | 'min_rest'
  | 'daily_overtime_warn'
  | 'daily_overtime_block'
  | 'weekly_overtime_warn'
  | 'consecutive_6_warn'
  | 'consecutive_7_block';

export type ConstraintSeverity = 'block' | 'warn';

export type ConstraintViolation = {
  rule: ConstraintRule;
  severity: ConstraintSeverity;
  message: string;
};

export type ConstraintResult = {
  allowed: boolean;
  blocking: ConstraintViolation[];
  warnings: ConstraintViolation[];
};
