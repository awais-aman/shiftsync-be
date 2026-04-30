import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SwapStatus,
  type Location,
  type Shift,
  type ShiftAssignment,
  type SwapRequest,
  type User,
} from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

const ACTIVE_STATUSES: SwapStatus[] = [
  SwapStatus.pending,
  SwapStatus.accepted_by_peer,
];

export type SwapWithRelations = SwapRequest & {
  requester: Pick<User, 'id' | 'displayName'>;
  targetStaff: Pick<User, 'id' | 'displayName'> | null;
  requestingAssignment: ShiftAssignment & {
    shift: Shift & { location: Location };
  };
};

@Injectable()
export class SwapRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    requester: { select: { id: true, displayName: true } },
    targetStaff: { select: { id: true, displayName: true } },
    requestingAssignment: {
      include: { shift: { include: { location: true } } },
    },
  } as const;

  findById(id: string): Promise<SwapWithRelations | null> {
    return this.prisma.swapRequest.findUnique({
      where: { id },
      include: this.include,
    });
  }

  /** Swaps the user originated. */
  listOutgoing(staffId: string): Promise<SwapWithRelations[]> {
    return this.prisma.swapRequest.findMany({
      where: { requesterId: staffId },
      orderBy: { createdAt: 'desc' },
      include: this.include,
    });
  }

  /** Swap requests where this staff is the target peer. */
  listIncoming(staffId: string): Promise<SwapWithRelations[]> {
    return this.prisma.swapRequest.findMany({
      where: { targetStaffId: staffId },
      orderBy: { createdAt: 'desc' },
      include: this.include,
    });
  }

  /** All requests waiting on a manager decision (any status that is not final). */
  listAwaitingApproval(): Promise<SwapWithRelations[]> {
    return this.prisma.swapRequest.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      orderBy: { createdAt: 'desc' },
      include: this.include,
    });
  }

  /** Pending requests for a shift; used by the shifts service when a shift is edited. */
  listActiveForShift(shiftId: string): Promise<SwapWithRelations[]> {
    return this.prisma.swapRequest.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        OR: [
          { requestingAssignment: { shiftId } },
          { targetAssignment: { shiftId } },
        ],
      },
      include: this.include,
    });
  }

  countActiveForRequester(requesterId: string): Promise<number> {
    return this.prisma.swapRequest.count({
      where: { requesterId, status: { in: ACTIVE_STATUSES } },
    });
  }

  create(
    data: Prisma.SwapRequestUncheckedCreateInput,
  ): Promise<SwapRequest> {
    return this.prisma.swapRequest.create({ data });
  }

  updateStatus(
    id: string,
    data: {
      status: SwapStatus;
      decidedById?: string;
      decidedAt?: Date;
      rejectionReason?: string | null;
    },
  ): Promise<SwapRequest> {
    return this.prisma.swapRequest.update({
      where: { id },
      data: {
        status: data.status,
        decidedById: data.decidedById,
        decidedAt: data.decidedAt,
        rejectionReason: data.rejectionReason ?? null,
      },
    });
  }

  /** Cancel any active swap requests linked to this shift's assignments. */
  async cancelActiveForShift(
    shiftId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const result = await client.swapRequest.updateMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        OR: [
          { requestingAssignment: { shiftId } },
          { targetAssignment: { shiftId } },
        ],
      },
      data: { status: SwapStatus.cancelled },
    });
    return result.count;
  }
}
