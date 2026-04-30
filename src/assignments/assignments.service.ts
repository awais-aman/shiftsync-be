import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { ConstraintEngine } from '@/constraints/constraint-engine';
import {
  AssignmentRejectedError,
  AssignmentRepository,
  type AssignmentWithStaff,
  type EvaluationData,
} from '@/database/repositories/assignment.repository';
import { AssignmentDto } from '@/assignments/dto/assignment.dto';
import { AuditService } from '@/audit/audit.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/database/prisma.service';
import { Provides } from '@/shared/constants';
import type { ConstraintResult } from '@/types/assignment';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    @Inject(Provides.Supabase) private readonly supabase: SupabaseClient,
    private readonly assignmentRepository: AssignmentRepository,
    private readonly constraintEngine: ConstraintEngine,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async listForShift(shiftId: string): Promise<AssignmentDto[]> {
    const rows = await this.assignmentRepository.listForShift(shiftId);
    if (rows.length === 0) return [];
    const emailById = await this.fetchEmailMap();
    return rows.map((row) => this.toDto(row, emailById.get(row.staffId)));
  }

  async create(
    shiftId: string,
    staffId: string,
    assignedById: string,
  ): Promise<AssignmentDto> {
    try {
      const created = await this.assignmentRepository.createTransactional(
        shiftId,
        staffId,
        assignedById,
        async (data) => {
          const result = this.runEngine(data, shiftId, staffId);
          if (result.allowed) return { allowed: true };
          return {
            allowed: false,
            reason: result.blocking.map((v) => v.message).join('; '),
          };
        },
      );
      const email = await this.fetchEmail(staffId);
      void this.notificationsService.notify({
        userId: staffId,
        type: 'shift_assigned',
        title: 'You\'ve been assigned to a shift',
        body: `Shift ${shiftId} starts soon — check your schedule`,
        payload: { shiftId, assignmentId: created.id },
        email: true,
      });
      void this.auditService.record({
        actorId: assignedById,
        entityType: 'shift_assignment',
        entityId: created.id,
        action: 'assign',
        after: { shiftId, staffId, assignmentId: created.id },
      });
      return this.toDto(created, email);
    } catch (error) {
      if (error instanceof AssignmentRejectedError) {
        throw new BadRequestException(error.message);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This staff member is already assigned to this shift',
        );
      }
      if (this.isExclusionViolation(error)) {
        throw new ConflictException(
          'Database rejected the assignment: staff is already booked for an overlapping shift',
        );
      }
      this.logger.error(
        `Unexpected error creating assignment: ${this.describeError(error)}`,
      );
      throw error;
    }
  }

  /**
   * Top-N qualified staff suggestions for a shift, ranked by lowest weekly
   * hours so far (fairness bias). Returns staff who would clear every
   * constraint engine rule.
   */
  async suggest(
    shiftId: string,
    limit: number,
  ): Promise<
    Array<{ staffId: string; displayName: string | null; weeklyHours: number }>
  > {
    const shiftRow = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      select: { locationId: true, requiredSkillId: true },
    });
    if (!shiftRow) throw new NotFoundException(`Shift ${shiftId} not found`);

    // Pre-filter: role=staff, has skill, certified at location. The engine
    // does the rest (availability, overlap, min-rest, overtime).
    const candidates = await this.prisma.user.findMany({
      where: {
        role: 'staff',
        skills: { some: { skillId: shiftRow.requiredSkillId } },
        certifications: { some: { locationId: shiftRow.locationId } },
      },
      select: { id: true, displayName: true },
    });

    const ranked: Array<{
      staffId: string;
      displayName: string | null;
      weeklyHours: number;
    }> = [];

    for (const staff of candidates) {
      const data = await this.assignmentRepository.loadEvaluationData(
        shiftId,
        staff.id,
      );
      if (!data.shift || !data.staff) continue;
      const result = this.runEngine(data, shiftId, staff.id);
      if (!result.allowed) continue;
      ranked.push({
        staffId: staff.id,
        displayName: staff.displayName,
        weeklyHours: this.weeklyHoursFor(data),
      });
    }

    ranked.sort((a, b) => a.weeklyHours - b.weeklyHours);
    return ranked.slice(0, limit);
  }

  private weeklyHoursFor(data: EvaluationData): number {
    if (!data.shift) return 0;
    // Sunday-anchored week containing the shift start, in shift location tz.
    // Approximation: bucket by UTC day-of-week with no tz conversion (good
    // enough for fairness ranking; precise math lives in the engine).
    const shiftStart = data.shift.startAt;
    const day = shiftStart.getUTCDay();
    const sunday = new Date(shiftStart);
    sunday.setUTCDate(sunday.getUTCDate() - day);
    sunday.setUTCHours(0, 0, 0, 0);
    const nextSunday = new Date(sunday);
    nextSunday.setUTCDate(nextSunday.getUTCDate() + 7);

    let hours = 0;
    for (const a of data.staffAssignments) {
      if (a.shift.startAt >= sunday && a.shift.startAt < nextSunday) {
        hours +=
          (a.shift.endAt.getTime() - a.shift.startAt.getTime()) /
          (1000 * 60 * 60);
      }
    }
    return hours;
  }

  async dryRun(shiftId: string, staffId: string): Promise<ConstraintResult> {
    const data = await this.assignmentRepository.loadEvaluationData(
      shiftId,
      staffId,
    );
    if (!data.shift) {
      throw new NotFoundException(`Shift ${shiftId} not found`);
    }
    if (!data.staff) {
      throw new NotFoundException(`Staff ${staffId} not found`);
    }
    return this.runEngine(data, shiftId, staffId);
  }

  async delete(
    shiftId: string,
    staffId: string,
    actorId: string,
  ): Promise<void> {
    const existing = await this.assignmentRepository.findOne(shiftId, staffId);
    if (!existing) {
      throw new NotFoundException('Assignment not found');
    }
    await this.assignmentRepository.delete(shiftId, staffId);
    void this.notificationsService.notify({
      userId: staffId,
      type: 'shift_unassigned',
      title: 'You were unassigned from a shift',
      payload: { shiftId },
      email: true,
    });
    void this.auditService.record({
      actorId,
      entityType: 'shift_assignment',
      entityId: existing.id,
      action: 'unassign',
      before: { shiftId, staffId, assignmentId: existing.id },
    });
  }

  private runEngine(
    data: EvaluationData,
    shiftId: string,
    staffId: string,
  ): ConstraintResult {
    if (!data.shift) {
      return {
        allowed: false,
        blocking: [
          {
            rule: 'not_certified',
            severity: 'block',
            message: `Shift ${shiftId} not found`,
          },
        ],
        warnings: [],
      };
    }
    if (!data.staff) {
      return {
        allowed: false,
        blocking: [
          {
            rule: 'not_certified',
            severity: 'block',
            message: `Staff ${staffId} not found`,
          },
        ],
        warnings: [],
      };
    }

    return this.constraintEngine.evaluate({
      staff: {
        id: data.staff.id,
        displayName: data.staff.displayName,
        certifiedLocationIds: new Set(
          data.staff.certifications.map((c) => c.locationId),
        ),
        skillIds: new Set(data.staff.skills.map((s) => s.skillId)),
      },
      shift: {
        id: data.shift.id,
        locationId: data.shift.locationId,
        startAt: data.shift.startAt,
        endAt: data.shift.endAt,
        requiredSkillId: data.shift.requiredSkillId,
        locationTimezone: data.shift.location.timezone,
      },
      availability: {
        recurring: data.staff.recurringAvailability.map((r) => ({
          weekday: r.weekday,
          startTime: r.startTime,
          endTime: r.endTime,
          timezone: r.timezone,
        })),
        exceptions: data.staff.availabilityExceptions.map((e) => ({
          date: e.date.toISOString().slice(0, 10),
          isAvailable: e.isAvailable,
          startTime: e.startTime,
          endTime: e.endTime,
          timezone: e.timezone,
        })),
      },
      existingAssignments: data.staffAssignments.map((a) => ({
        shiftId: a.shift.id,
        startAt: a.shift.startAt,
        endAt: a.shift.endAt,
        locationTimezone: a.shift.location.timezone,
      })),
      overtimeOverrides: data.overrides.map((o) => ({
        effectiveDate: o.effectiveDate.toISOString().slice(0, 10),
      })),
    });
  }

  private isExclusionViolation(error: unknown): boolean {
    return this.assignmentRepository.isExclusionViolation(error);
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    return String(error);
  }

  private async fetchEmailMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const { data, error } = await this.supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) {
      this.logger.error(`Failed to list auth users: ${error.message}`);
      return map;
    }
    for (const u of data.users) {
      if (u.email) map.set(u.id, u.email);
    }
    return map;
  }

  private async fetchEmail(staffId: string): Promise<string | undefined> {
    const { data, error } =
      await this.supabase.auth.admin.getUserById(staffId);
    if (error) {
      this.logger.error(
        `Failed to load auth user ${staffId}: ${error.message}`,
      );
      return undefined;
    }
    return data.user?.email ?? undefined;
  }

  private toDto(row: AssignmentWithStaff, email?: string): AssignmentDto {
    return {
      id: row.id,
      shiftId: row.shiftId,
      staffId: row.staffId,
      staffDisplayName: row.staff.displayName,
      staffEmail: email,
      assignedById: row.assignedById,
      assignedAt: row.assignedAt.toISOString(),
    };
  }
}
