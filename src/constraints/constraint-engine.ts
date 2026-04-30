import { Injectable } from '@nestjs/common';
import { toZonedTime } from 'date-fns-tz';
import type {
  ConstraintResult,
  ConstraintViolation,
} from '@/types/assignment';
import {
  CONSECUTIVE_DAYS_BLOCK,
  CONSECUTIVE_DAYS_WARN,
  COUNTED_SHIFT_MIN_HOURS,
  DAILY_OVERTIME_BLOCK_HOURS,
  DAILY_OVERTIME_WARN_HOURS,
  MIN_REST_HOURS,
  WEEKLY_OVERTIME_WARN_HOURS,
} from '@/shared/constants';

export type EvaluationStaff = {
  id: string;
  displayName?: string | null;
  certifiedLocationIds: Set<string>;
  skillIds: Set<string>;
};

export type EvaluationShift = {
  id: string;
  locationId: string;
  startAt: Date;
  endAt: Date;
  requiredSkillId: string;
  /** Location's IANA timezone, used to interpret recurring availability windows. */
  locationTimezone: string;
};

export type RecurringWindow = {
  weekday: number;
  /** "HH:MM" 24h, interpreted in `timezone`. */
  startTime: string;
  endTime: string;
  timezone: string;
};

export type AvailabilityException = {
  /** YYYY-MM-DD interpreted in `timezone`. */
  date: string;
  isAvailable: boolean;
  startTime?: string | null;
  endTime?: string | null;
  timezone: string;
};

export type EvaluationAvailability = {
  recurring: RecurringWindow[];
  exceptions: AvailabilityException[];
};

export type ExistingAssignment = {
  shiftId: string;
  startAt: Date;
  endAt: Date;
  /** IANA timezone of the location for that shift. Used for date-bucketing. */
  locationTimezone: string;
};

export type OvertimeOverride = {
  /** YYYY-MM-DD in the location timezone of the day being granted as 7th day. */
  effectiveDate: string;
};

export type EvaluationContext = {
  staff: EvaluationStaff;
  shift: EvaluationShift;
  availability: EvaluationAvailability;
  /** Staff's other assignments. Pass them all; the engine filters relevant ones. */
  existingAssignments: ExistingAssignment[];
  overtimeOverrides: OvertimeOverride[];
};

@Injectable()
export class ConstraintEngine {
  evaluate(ctx: EvaluationContext): ConstraintResult {
    const blocking: ConstraintViolation[] = [];
    const warnings: ConstraintViolation[] = [];

    if (!ctx.staff.certifiedLocationIds.has(ctx.shift.locationId)) {
      blocking.push({
        rule: 'not_certified',
        severity: 'block',
        message: `${this.staffName(ctx.staff)} is not certified to work at this location`,
      });
    }

    if (!ctx.staff.skillIds.has(ctx.shift.requiredSkillId)) {
      blocking.push({
        rule: 'missing_skill',
        severity: 'block',
        message: `${this.staffName(ctx.staff)} does not have the required skill for this shift`,
      });
    }

    if (!this.isAvailable(ctx)) {
      blocking.push({
        rule: 'unavailable',
        severity: 'block',
        message: `${this.staffName(ctx.staff)} is not available during the shift's time window`,
      });
    }

    if (this.hasOverlap(ctx)) {
      blocking.push({
        rule: 'double_booking',
        severity: 'block',
        message: `${this.staffName(ctx.staff)} is already assigned to another shift overlapping this time`,
      });
    }

    if (this.violatesMinRest(ctx)) {
      blocking.push({
        rule: 'min_rest',
        severity: 'block',
        message: `${this.staffName(ctx.staff)} would have less than ${MIN_REST_HOURS} hours rest from an adjacent shift`,
      });
    }

    this.evaluateOvertime(ctx, blocking, warnings);
    this.evaluateConsecutiveDays(ctx, blocking, warnings);

    return {
      allowed: blocking.length === 0,
      blocking,
      warnings,
    };
  }

  private staffName(staff: EvaluationStaff): string {
    return staff.displayName?.trim() || `Staff ${staff.id.slice(0, 8)}`;
  }

  /**
   * The shift fits within at least one availability window. Exceptions on the
   * shift's date OVERRIDE the recurring schedule for that date.
   */
  private isAvailable(ctx: EvaluationContext): boolean {
    const { shift, availability } = ctx;
    const tz = shift.locationTimezone;
    const startLocal = toZonedTime(shift.startAt, tz);
    const endLocal = toZonedTime(shift.endAt, tz);

    const shiftStartMin = startLocal.getHours() * 60 + startLocal.getMinutes();
    const shiftEndMin = endLocal.getHours() * 60 + endLocal.getMinutes();
    const dateKey = this.formatDateInTz(shift.startAt, tz);

    const dateExceptions = availability.exceptions.filter(
      (e) => e.date === dateKey,
    );

    if (
      dateExceptions.some(
        (e) => !e.isAvailable && (!e.startTime || !e.endTime),
      )
    ) {
      return false;
    }

    const baseWindows = this.recurringWindowsFor(
      availability.recurring,
      startLocal.getDay(),
      tz,
    );

    let effective = baseWindows;
    for (const ex of dateExceptions) {
      if (!ex.startTime || !ex.endTime) continue;
      const exStart = this.toMinutes(ex.startTime);
      const exEnd = this.toMinutes(ex.endTime);
      if (ex.isAvailable) {
        effective = [...effective, [exStart, exEnd]];
      } else {
        effective = effective.flatMap((win) =>
          this.subtractWindow(win, [exStart, exEnd]),
        );
      }
    }

    return effective.some(
      ([start, end]) => start <= shiftStartMin && end >= shiftEndMin,
    );
  }

  private recurringWindowsFor(
    recurring: RecurringWindow[],
    weekday: number,
    locationTz: string,
  ): Array<[number, number]> {
    return recurring
      .filter((r) => r.weekday === weekday && r.timezone === locationTz)
      .map((r) => [this.toMinutes(r.startTime), this.toMinutes(r.endTime)]);
  }

  private toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  private subtractWindow(
    win: [number, number],
    cut: [number, number],
  ): Array<[number, number]> {
    const [a, b] = win;
    const [c, d] = cut;
    if (d <= a || c >= b) return [[a, b]];
    const out: Array<[number, number]> = [];
    if (a < c) out.push([a, c]);
    if (d < b) out.push([d, b]);
    return out;
  }

  private formatDateInTz(date: Date, tz: string): string {
    const local = toZonedTime(date, tz);
    const y = local.getFullYear();
    const m = String(local.getMonth() + 1).padStart(2, '0');
    const d = String(local.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private hasOverlap(ctx: EvaluationContext): boolean {
    const { shift, existingAssignments } = ctx;
    return existingAssignments.some(
      (a) =>
        a.shiftId !== shift.id &&
        a.startAt < shift.endAt &&
        a.endAt > shift.startAt,
    );
  }

  private violatesMinRest(ctx: EvaluationContext): boolean {
    const { shift, existingAssignments } = ctx;
    const minRestMs = MIN_REST_HOURS * 60 * 60 * 1000;
    return existingAssignments.some((a) => {
      if (a.shiftId === shift.id) return false;
      if (a.startAt < shift.endAt && a.endAt > shift.startAt) return false;
      const gapBefore = shift.startAt.getTime() - a.endAt.getTime();
      const gapAfter = a.startAt.getTime() - shift.endAt.getTime();
      const gap = Math.max(gapBefore, gapAfter);
      return gap >= 0 && gap < minRestMs;
    });
  }

  /**
   * Daily-hours and weekly-hours rules. The proposed shift counts toward the
   * totals. Existing overlapping assignments are excluded so they don't
   * double-count.
   */
  private evaluateOvertime(
    ctx: EvaluationContext,
    blocking: ConstraintViolation[],
    warnings: ConstraintViolation[],
  ): void {
    const tz = ctx.shift.locationTimezone;
    const proposedDate = this.formatDateInTz(ctx.shift.startAt, tz);
    const proposedHours = this.shiftHours(ctx.shift.startAt, ctx.shift.endAt);

    let dailyHoursOthers = 0;
    let weeklyHoursOthers = 0;
    const weekKey = this.weekKeyFor(ctx.shift.startAt, tz);

    for (const a of ctx.existingAssignments) {
      if (a.shiftId === ctx.shift.id) continue;
      // Overlapping rows are caught by double_booking; don't count them here either.
      if (a.startAt < ctx.shift.endAt && a.endAt > ctx.shift.startAt) continue;

      const aDate = this.formatDateInTz(a.startAt, a.locationTimezone);
      const aHours = this.shiftHours(a.startAt, a.endAt);
      if (aDate === proposedDate) {
        dailyHoursOthers += aHours;
      }
      if (this.weekKeyFor(a.startAt, a.locationTimezone) === weekKey) {
        weeklyHoursOthers += aHours;
      }
    }

    const dailyTotal = dailyHoursOthers + proposedHours;
    const weeklyTotal = weeklyHoursOthers + proposedHours;
    const name = this.staffName(ctx.staff);

    if (dailyTotal > DAILY_OVERTIME_BLOCK_HOURS) {
      blocking.push({
        rule: 'daily_overtime_block',
        severity: 'block',
        message: `${name} would work ${dailyTotal.toFixed(1)}h that day, exceeding the ${DAILY_OVERTIME_BLOCK_HOURS}h daily limit`,
      });
    } else if (dailyTotal > DAILY_OVERTIME_WARN_HOURS) {
      warnings.push({
        rule: 'daily_overtime_warn',
        severity: 'warn',
        message: `${name} would work ${dailyTotal.toFixed(1)}h that day, above the ${DAILY_OVERTIME_WARN_HOURS}h daily warning threshold`,
      });
    }

    if (weeklyTotal > WEEKLY_OVERTIME_WARN_HOURS) {
      warnings.push({
        rule: 'weekly_overtime_warn',
        severity: 'warn',
        message: `${name} would reach ${weeklyTotal.toFixed(1)}h this week, above the ${WEEKLY_OVERTIME_WARN_HOURS}h warning threshold`,
      });
    }
  }

  /**
   * Counts consecutive distinct dates with a worked shift (≥ 1h) running
   * backwards from the proposed shift's date. The proposed shift is included
   * in the streak.
   */
  private evaluateConsecutiveDays(
    ctx: EvaluationContext,
    blocking: ConstraintViolation[],
    warnings: ConstraintViolation[],
  ): void {
    const tz = ctx.shift.locationTimezone;
    const proposedDate = this.formatDateInTz(ctx.shift.startAt, tz);

    const workedDates = new Set<string>([proposedDate]);
    for (const a of ctx.existingAssignments) {
      if (a.shiftId === ctx.shift.id) continue;
      if (this.shiftHours(a.startAt, a.endAt) < COUNTED_SHIFT_MIN_HOURS) continue;
      workedDates.add(this.formatDateInTz(a.startAt, a.locationTimezone));
    }

    let streak = 0;
    let cursor = proposedDate;
    while (workedDates.has(cursor)) {
      streak += 1;
      cursor = this.previousDate(cursor);
    }

    const name = this.staffName(ctx.staff);

    if (streak >= CONSECUTIVE_DAYS_BLOCK) {
      const hasOverride = ctx.overtimeOverrides.some(
        (o) => o.effectiveDate === proposedDate,
      );
      if (!hasOverride) {
        blocking.push({
          rule: 'consecutive_7_block',
          severity: 'block',
          message: `${name} would be working a ${streak}th consecutive day; requires manager override with documented reason`,
        });
      }
    } else if (streak >= CONSECUTIVE_DAYS_WARN) {
      warnings.push({
        rule: 'consecutive_6_warn',
        severity: 'warn',
        message: `${name} would be working a ${streak}th consecutive day`,
      });
    }
  }

  private shiftHours(startAt: Date, endAt: Date): number {
    return (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60);
  }

  /** Sunday-anchored week key (YYYY-MM-DD of that week's Sunday) in `tz`. */
  private weekKeyFor(date: Date, tz: string): string {
    const local = toZonedTime(date, tz);
    const dayOfWeek = local.getDay();
    const sunday = new Date(local);
    sunday.setDate(sunday.getDate() - dayOfWeek);
    const y = sunday.getFullYear();
    const m = String(sunday.getMonth() + 1).padStart(2, '0');
    const d = String(sunday.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** YYYY-MM-DD math without timezone conversion (assumes inputs are wall-clock). */
  private previousDate(yyyymmdd: string): string {
    const [y, m, d] = yyyymmdd.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - 1);
    const y2 = date.getUTCFullYear();
    const m2 = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d2 = String(date.getUTCDate()).padStart(2, '0');
    return `${y2}-${m2}-${d2}`;
  }
}
