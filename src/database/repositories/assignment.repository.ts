import { Injectable } from '@nestjs/common';
import type {
  AvailabilityException,
  AvailabilityRecurring,
  Location,
  Prisma,
  Shift,
  ShiftAssignment,
  Skill,
  StaffCertification,
  StaffSkill,
  User,
} from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

export type AssignmentWithStaff = ShiftAssignment & {
  staff: User;
};

export type EvaluationData = {
  shift: (Shift & { location: Location; requiredSkill: Skill }) | null;
  staff:
    | (User & {
        certifications: StaffCertification[];
        skills: StaffSkill[];
        recurringAvailability: AvailabilityRecurring[];
        availabilityExceptions: AvailabilityException[];
      })
    | null;
  /** All current assignments of this staff (across all shifts), with each shift's times. */
  staffAssignments: Array<
    ShiftAssignment & { shift: Pick<Shift, 'id' | 'startAt' | 'endAt'> }
  >;
};

@Injectable()
export class AssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForShift(shiftId: string): Promise<AssignmentWithStaff[]> {
    return this.prisma.shiftAssignment.findMany({
      where: { shiftId },
      orderBy: { assignedAt: 'asc' },
      include: { staff: true },
    });
  }

  findOne(
    shiftId: string,
    staffId: string,
  ): Promise<AssignmentWithStaff | null> {
    return this.prisma.shiftAssignment.findUnique({
      where: { shiftId_staffId: { shiftId, staffId } },
      include: { staff: true },
    });
  }

  async loadEvaluationData(
    shiftId: string,
    staffId: string,
  ): Promise<EvaluationData> {
    const [shift, staff, staffAssignments] = await Promise.all([
      this.prisma.shift.findUnique({
        where: { id: shiftId },
        include: { location: true, requiredSkill: true },
      }),
      this.prisma.user.findUnique({
        where: { id: staffId },
        include: {
          certifications: true,
          skills: true,
          recurringAvailability: true,
          availabilityExceptions: true,
        },
      }),
      this.prisma.shiftAssignment.findMany({
        where: { staffId },
        include: {
          shift: { select: { id: true, startAt: true, endAt: true } },
        },
      }),
    ]);
    return { shift, staff, staffAssignments };
  }

  /**
   * Performs the assignment INSIDE a transaction. The DB-level EXCLUDE constraint
   * provides the final guarantee against concurrent double-booking; this also
   * locks the staff's existing rows FOR UPDATE so the constraint engine's view
   * is consistent with what the INSERT will see.
   */
  async createTransactional(
    shiftId: string,
    staffId: string,
    assignedById: string,
    runEngineCheck: (
      data: EvaluationData,
    ) => Promise<{ allowed: boolean; reason?: string }>,
  ): Promise<AssignmentWithStaff> {
    return this.prisma.$transaction(async (tx) => {
      // Read-and-lock the staff's existing assignments to serialize concurrent attempts.
      await tx.$queryRaw`
        SELECT id FROM shift_assignments WHERE staff_id = ${staffId}::uuid FOR UPDATE
      `;

      const [shift, staff, staffAssignments] = await Promise.all([
        tx.shift.findUnique({
          where: { id: shiftId },
          include: { location: true, requiredSkill: true },
        }),
        tx.user.findUnique({
          where: { id: staffId },
          include: {
            certifications: true,
            skills: true,
            recurringAvailability: true,
            availabilityExceptions: true,
          },
        }),
        tx.shiftAssignment.findMany({
          where: { staffId },
          include: {
            shift: { select: { id: true, startAt: true, endAt: true } },
          },
        }),
      ]);

      const result = await runEngineCheck({
        shift,
        staff,
        staffAssignments,
      });
      if (!result.allowed) {
        throw new AssignmentRejectedError(result.reason ?? 'Constraint violation');
      }

      const created = await tx.shiftAssignment.create({
        data: {
          shiftId,
          staffId,
          assignedById,
        },
        include: { staff: true },
      });
      return created;
    });
  }

  delete(shiftId: string, staffId: string): Promise<ShiftAssignment> {
    return this.prisma.shiftAssignment.delete({
      where: { shiftId_staffId: { shiftId, staffId } },
    });
  }

  isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Object &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  isExclusionViolation(error: unknown): boolean {
    if (!(error instanceof Object)) return false;
    const e = error as { code?: string; meta?: { code?: string } };
    // Postgres SQLSTATE 23P01 = exclusion_violation
    return e.code === '23P01' || e.meta?.code === '23P01';
  }
}

export class AssignmentRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssignmentRejectedError';
  }
}
