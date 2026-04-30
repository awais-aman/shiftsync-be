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
}

export enum RoutePaths {
  Me = 'me',
  Locations = 'locations',
  Skills = 'skills',
  Team = 'team',
  Shifts = 'shifts',
  Availability = 'availability',
}

export const IsPublic = 'isPublic';

export const PUBLISH_CUTOFF_HOURS = 48;
