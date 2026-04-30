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
import { Provides } from '@/shared/constants';
import type { ConstraintResult } from '@/types/assignment';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    @Inject(Provides.Supabase) private readonly supabase: SupabaseClient,
    private readonly assignmentRepository: AssignmentRepository,
    private readonly constraintEngine: ConstraintEngine,
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

  async delete(shiftId: string, staffId: string): Promise<void> {
    const existing = await this.assignmentRepository.findOne(shiftId, staffId);
    if (!existing) {
      throw new NotFoundException('Assignment not found');
    }
    await this.assignmentRepository.delete(shiftId, staffId);
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
