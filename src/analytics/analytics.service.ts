import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { LocationScopeService } from '@/common/scope/location-scope.service';
import { PrismaService } from '@/database/prisma.service';
import { FairnessReportDto } from '@/analytics/dto/fairness.dto';
import { OvertimeProjectionDto } from '@/analytics/dto/overtime-projection.dto';
import {
  DAILY_OVERTIME_BLOCK_HOURS,
  WEEKLY_OVERTIME_WARN_HOURS,
} from '@/shared/constants';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: LocationScopeService,
  ) {}

  async fairness(
    actorId: string,
    range: { from?: Date; to?: Date } = {},
  ): Promise<FairnessReportDto> {
    const ctx = await this.scopeService.contextFor(actorId);
    const allowedLocationIds =
      ctx.role === UserRole.admin ? null : (ctx.managedLocationIds ?? []);

    // Default range: 4 weeks ending today.
    const to = range.to ?? new Date();
    const from =
      range.from ?? new Date(to.getTime() - 28 * 24 * 60 * 60 * 1000);

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        shift: {
          startAt: { gte: from, lt: to },
          ...(allowedLocationIds
            ? { locationId: { in: allowedLocationIds } }
            : {}),
        },
      },
      include: {
        staff: {
          select: { id: true, displayName: true, desiredHoursPerWeek: true },
        },
        shift: { select: { startAt: true, endAt: true, isPremium: true } },
      },
    });

    const byStaff = new Map<
      string,
      {
        displayName: string | null;
        desiredHoursPerWeek: number | null;
        totalHours: number;
        premiumShifts: number;
      }
    >();

    for (const a of assignments) {
      const hours =
        (a.shift.endAt.getTime() - a.shift.startAt.getTime()) /
        (1000 * 60 * 60);
      const existing = byStaff.get(a.staffId) ?? {
        displayName: a.staff.displayName,
        desiredHoursPerWeek: a.staff.desiredHoursPerWeek ?? null,
        totalHours: 0,
        premiumShifts: 0,
      };
      existing.totalHours += hours;
      if (a.shift.isPremium) existing.premiumShifts += 1;
      byStaff.set(a.staffId, existing);
    }

    // Always include staff who had zero shifts (so under-scheduling is visible).
    // Filter by staff who could in theory work at the visible locations.
    const staff = await this.prisma.user.findMany({
      where: {
        role: UserRole.staff,
        ...(allowedLocationIds
          ? {
              certifications: {
                some: { locationId: { in: allowedLocationIds } },
              },
            }
          : {}),
      },
      select: { id: true, displayName: true, desiredHoursPerWeek: true },
    });
    for (const s of staff) {
      if (!byStaff.has(s.id)) {
        byStaff.set(s.id, {
          displayName: s.displayName,
          desiredHoursPerWeek: s.desiredHoursPerWeek ?? null,
          totalHours: 0,
          premiumShifts: 0,
        });
      }
    }

    const rows = Array.from(byStaff.entries())
      .map(([staffId, agg]) => ({
        staffId,
        displayName: agg.displayName,
        totalHours: round1(agg.totalHours),
        premiumShifts: agg.premiumShifts,
        desiredHoursPerWeek: agg.desiredHoursPerWeek,
        varianceVsDesired:
          agg.desiredHoursPerWeek === null
            ? null
            : round1(agg.totalHours - agg.desiredHoursPerWeek * weeksBetween(from, to)),
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    const premiumShiftsAverage =
      rows.length === 0
        ? 0
        : round1(
            rows.reduce((sum, r) => sum + r.premiumShifts, 0) / rows.length,
          );

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      rows,
      premiumShiftsAverage,
    };
  }

  async overtimeProjection(
    actorId: string,
    weekStart?: Date,
  ): Promise<OvertimeProjectionDto> {
    const ctx = await this.scopeService.contextFor(actorId);
    const allowedLocationIds =
      ctx.role === UserRole.admin ? null : (ctx.managedLocationIds ?? []);

    const start = weekStart ? sundayOfWeek(weekStart) : sundayOfWeek(new Date());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        shift: {
          startAt: { gte: start, lt: end },
          ...(allowedLocationIds
            ? { locationId: { in: allowedLocationIds } }
            : {}),
        },
      },
      include: {
        staff: { select: { id: true, displayName: true } },
        shift: { select: { startAt: true, endAt: true } },
      },
    });

    const byStaff = new Map<
      string,
      { displayName: string | null; weeklyHours: number }
    >();
    for (const a of assignments) {
      const hours =
        (a.shift.endAt.getTime() - a.shift.startAt.getTime()) /
        (1000 * 60 * 60);
      const existing = byStaff.get(a.staffId) ?? {
        displayName: a.staff.displayName,
        weeklyHours: 0,
      };
      existing.weeklyHours += hours;
      byStaff.set(a.staffId, existing);
    }

    const rows = Array.from(byStaff.entries())
      .map(([staffId, agg]) => ({
        staffId,
        displayName: agg.displayName,
        weeklyHours: round1(agg.weeklyHours),
        warningLevel: levelFor(agg.weeklyHours),
      }))
      .sort((a, b) => b.weeklyHours - a.weeklyHours);

    return {
      weekStart: start.toISOString().slice(0, 10),
      weekEnd: new Date(end.getTime() - 1).toISOString().slice(0, 10),
      rows,
    };
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function weeksBetween(from: Date, to: Date): number {
  return Math.max(
    1,
    (to.getTime() - from.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
}

function sundayOfWeek(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

function levelFor(hours: number): 'ok' | 'warn' | 'block' {
  // Block tracks the daily threshold but at the weekly aggregate it's the
  // closest signal we have for "schedule is unsafe."
  if (hours > DAILY_OVERTIME_BLOCK_HOURS * 5) return 'block';
  if (hours > WEEKLY_OVERTIME_WARN_HOURS) return 'warn';
  return 'ok';
}
