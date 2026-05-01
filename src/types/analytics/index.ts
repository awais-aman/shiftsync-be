export type StaffFairnessRow = {
  staffId: string;
  displayName: string | null;
  totalHours: number;
  premiumShifts: number;
  desiredHoursPerWeek?: number | null;
  /** Hours - desiredHoursPerWeek; positive = over, negative = under. Null if no desired set. */
  varianceVsDesired: number | null;
};

export type FairnessReport = {
  from: string;
  to: string;
  rows: StaffFairnessRow[];
  premiumShiftsAverage: number;
};

export type OvertimeProjectionRow = {
  staffId: string;
  displayName: string | null;
  weeklyHours: number;
  warningLevel: 'ok' | 'warn' | 'block';
};

export type OvertimeProjection = {
  weekStart: string;
  weekEnd: string;
  rows: OvertimeProjectionRow[];
};
