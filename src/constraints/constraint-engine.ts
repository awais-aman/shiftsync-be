import { Injectable } from '@nestjs/common';
import { toZonedTime } from 'date-fns-tz';
import type {
  ConstraintResult,
  ConstraintViolation,
} from '@/types/assignment';
import { MIN_REST_HOURS } from '@/shared/constants';

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
};

export type EvaluationContext = {
  staff: EvaluationStaff;
  shift: EvaluationShift;
  availability: EvaluationAvailability;
  /** Staff's other assignments. Pass them all; the engine filters relevant ones. */
  existingAssignments: ExistingAssignment[];
};

@Injectable()
export class ConstraintEngine {
  evaluate(ctx: EvaluationContext): ConstraintResult {
    const blocking: ConstraintViolation[] = [];

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

    return { allowed: blocking.length === 0, blocking };
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

    // Whole-day blackout exception → unavailable, full stop.
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
      // Skip overlapping ones; double_booking handles those with a clearer message.
      if (a.startAt < shift.endAt && a.endAt > shift.startAt) return false;
      const gapBefore = shift.startAt.getTime() - a.endAt.getTime();
      const gapAfter = a.startAt.getTime() - shift.endAt.getTime();
      const gap = Math.max(gapBefore, gapAfter);
      return gap >= 0 && gap < minRestMs;
    });
  }
}
