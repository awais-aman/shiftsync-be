export type OnDutyAssignedStaff = {
  id: string;
  displayName?: string | null;
  email?: string;
};

export type OnDutyShift = {
  id: string;
  startAt: string;
  endAt: string;
  requiredSkillName: string;
  headcount: number;
  assignedStaff: OnDutyAssignedStaff[];
};

export type OnDutyLocation = {
  locationId: string;
  locationName: string;
  locationTimezone: string;
  shifts: OnDutyShift[];
};
