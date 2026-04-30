export enum Provides {
  Supabase = 'Supabase',
  SupabaseJwks = 'SupabaseJwks',
}

export enum Tables {
  Users = 'users',
  Locations = 'locations',
  Skills = 'skills',
  StaffCertifications = 'staff_certifications',
  StaffSkills = 'staff_skills',
  ManagerLocations = 'manager_locations',
  Shifts = 'shifts',
  ShiftAssignments = 'shift_assignments',
  AvailabilityRecurring = 'availability_recurring',
  AvailabilityExceptions = 'availability_exceptions',
  OvertimeOverrides = 'overtime_overrides',
  SwapRequests = 'swap_requests',
}

export enum RoutePaths {
  Me = 'me',
  Locations = 'locations',
  Skills = 'skills',
  Team = 'team',
  Shifts = 'shifts',
  Availability = 'availability',
  Overtime = 'overtime',
  SwapRequests = 'swap-requests',
}

export const IsPublic = 'isPublic';

export const PUBLISH_CUTOFF_HOURS = 48;
export const MIN_REST_HOURS = 10;
export const DAILY_OVERTIME_WARN_HOURS = 8;
export const DAILY_OVERTIME_BLOCK_HOURS = 12;
export const WEEKLY_OVERTIME_WARN_HOURS = 35;
export const CONSECUTIVE_DAYS_WARN = 6;
export const CONSECUTIVE_DAYS_BLOCK = 7;
/** Min shift duration that counts toward "consecutive worked days". */
export const COUNTED_SHIFT_MIN_HOURS = 1;
export const MAX_PENDING_SWAP_REQUESTS_PER_STAFF = 3;
export const DROP_REQUEST_EXPIRY_HOURS_BEFORE_SHIFT = 24;
