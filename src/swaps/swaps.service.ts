import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SwapStatus, SwapType, UserRole } from '@prisma/client';
import { ConstraintEngine } from '@/constraints/constraint-engine';
import { AssignmentRepository } from '@/database/repositories/assignment.repository';
import { PrismaService } from '@/database/prisma.service';
import {
  SwapRepository,
  type SwapWithRelations,
} from '@/database/repositories/swap.repository';
import { NotificationsService } from '@/notifications/notifications.service';
import { CreateSwapRequestDto } from '@/swaps/dto/create-swap.dto';
import { SwapRequestDto } from '@/swaps/dto/swap.dto';
import {
  DROP_REQUEST_EXPIRY_HOURS_BEFORE_SHIFT,
  MAX_PENDING_SWAP_REQUESTS_PER_STAFF,
} from '@/shared/constants';

const FINAL_STATUSES: SwapStatus[] = [
  SwapStatus.approved,
  SwapStatus.rejected,
  SwapStatus.cancelled,
  SwapStatus.expired,
];

@Injectable()
export class SwapsService {
  private readonly logger = new Logger(SwapsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly swapRepository: SwapRepository,
    private readonly assignmentRepository: AssignmentRepository,
    private readonly constraintEngine: ConstraintEngine,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    staffId: string,
    dto: CreateSwapRequestDto,
  ): Promise<SwapRequestDto> {
    const requestingAssignment = await this.prisma.shiftAssignment.findUnique({
      where: { id: dto.requestingAssignmentId },
      include: { shift: true },
    });
    if (!requestingAssignment) {
      throw new NotFoundException(
        `Assignment ${dto.requestingAssignmentId} not found`,
      );
    }
    if (requestingAssignment.staffId !== staffId) {
      throw new ForbiddenException(
        'You can only request swaps or drops for your own assignments',
      );
    }
    if (requestingAssignment.shift.startAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'Cannot request a swap or drop for a shift that has started',
      );
    }

    const activeCount = await this.swapRepository.countActiveForRequester(
      staffId,
    );
    if (activeCount >= MAX_PENDING_SWAP_REQUESTS_PER_STAFF) {
      throw new BadRequestException(
        `You already have ${activeCount} active swap or drop requests; resolve some before opening more`,
      );
    }

    if (dto.type === SwapType.swap) {
      if (!dto.targetStaffId) {
        throw new BadRequestException(
          'Swap requests require a targetStaffId (the peer)',
        );
      }
      if (dto.targetStaffId === staffId) {
        throw new BadRequestException('Cannot swap with yourself');
      }
      if (dto.targetAssignmentId) {
        const targetAssignment =
          await this.prisma.shiftAssignment.findUnique({
            where: { id: dto.targetAssignmentId },
          });
        if (!targetAssignment || targetAssignment.staffId !== dto.targetStaffId) {
          throw new BadRequestException(
            'targetAssignmentId must belong to targetStaffId',
          );
        }
      }
    }

    const expiresAt =
      dto.type === SwapType.drop
        ? new Date(
            requestingAssignment.shift.startAt.getTime() -
              DROP_REQUEST_EXPIRY_HOURS_BEFORE_SHIFT * 60 * 60 * 1000,
          )
        : null;

    const created = await this.swapRepository.create({
      type: dto.type,
      requestingAssignmentId: dto.requestingAssignmentId,
      requesterId: staffId,
      targetStaffId: dto.targetStaffId ?? null,
      targetAssignmentId: dto.targetAssignmentId ?? null,
      expiresAt,
    });

    // Notify the targeted peer for swaps. For drops, no peer to notify; managers
    // see the request in their approval queue.
    if (dto.type === SwapType.swap && dto.targetStaffId) {
      void this.notificationsService.notify({
        userId: dto.targetStaffId,
        type: 'swap_requested',
        title: 'A coworker wants to swap shifts with you',
        payload: { swapId: created.id },
        email: true,
      });
    }
    return this.toDto((await this.swapRepository.findById(created.id))!);
  }

  async listForUser(
    staffId: string,
    role: UserRole,
  ): Promise<{
    outgoing: SwapRequestDto[];
    incoming: SwapRequestDto[];
    awaitingApproval: SwapRequestDto[];
  }> {
    const [outgoing, incoming, awaitingApproval] = await Promise.all([
      this.swapRepository.listOutgoing(staffId),
      this.swapRepository.listIncoming(staffId),
      role === UserRole.admin || role === UserRole.manager
        ? this.swapRepository.listAwaitingApproval()
        : Promise.resolve([] as SwapWithRelations[]),
    ]);

    return {
      outgoing: outgoing.map((row) => this.toDto(row)),
      incoming: incoming.map((row) => this.toDto(row)),
      awaitingApproval: awaitingApproval.map((row) => this.toDto(row)),
    };
  }

  async findById(id: string): Promise<SwapRequestDto> {
    const swap = await this.requireActive(id, { allowFinal: true });
    return this.toDto(swap);
  }

  async cancel(id: string, requesterId: string): Promise<SwapRequestDto> {
    const swap = await this.requireActive(id);
    if (swap.requesterId !== requesterId) {
      throw new ForbiddenException(
        'Only the requester can cancel a swap request',
      );
    }
    const updated = await this.swapRepository.updateStatus(id, {
      status: SwapStatus.cancelled,
    });
    // Notify the peer if there was one (so they know the request vanished).
    if (swap.targetStaffId) {
      void this.notificationsService.notify({
        userId: swap.targetStaffId,
        type: 'swap_cancelled',
        title: 'A swap request was cancelled by the requester',
        payload: { swapId: id },
      });
    }
    return this.toDto({ ...swap, ...updated });
  }

  async accept(id: string, peerId: string): Promise<SwapRequestDto> {
    const swap = await this.requireActive(id);
    if (swap.type !== SwapType.swap) {
      throw new BadRequestException('Only swap requests can be accepted by a peer');
    }
    if (swap.targetStaffId !== peerId) {
      throw new ForbiddenException(
        'Only the targeted peer can accept this request',
      );
    }
    if (swap.status !== SwapStatus.pending) {
      throw new BadRequestException(
        `Swap is in status ${swap.status}; only pending swaps can be accepted`,
      );
    }
    const updated = await this.swapRepository.updateStatus(id, {
      status: SwapStatus.accepted_by_peer,
    });
    // Notify the requester their peer accepted; managers see it in the queue.
    void this.notificationsService.notify({
      userId: swap.requesterId,
      type: 'swap_accepted',
      title: 'Your swap was accepted by the peer',
      body: 'Awaiting manager approval',
      payload: { swapId: id },
    });
    return this.toDto({ ...swap, ...updated });
  }

  /**
   * Manager approves a swap (drop: pending only; swap: must be accepted_by_peer).
   * The actual assignment shuffle happens in a transaction; the constraint engine
   * is re-run on the post-swap assignee.
   */
  async approve(id: string, decidedById: string): Promise<SwapRequestDto> {
    return this.prisma.$transaction(async (tx) => {
      const swap = await tx.swapRequest.findUnique({
        where: { id },
        include: {
          requestingAssignment: { include: { shift: true } },
        },
      });
      if (!swap) throw new NotFoundException(`Swap ${id} not found`);
      this.assertNotFinal(swap.status);

      if (swap.type === SwapType.drop) {
        if (swap.status !== SwapStatus.pending) {
          throw new BadRequestException(
            `Drop is in status ${swap.status}; only pending drops can be approved`,
          );
        }
        // Approving a drop simply removes the requester's assignment.
        await tx.shiftAssignment.delete({
          where: { id: swap.requestingAssignmentId },
        });
      } else {
        if (swap.status !== SwapStatus.accepted_by_peer) {
          throw new BadRequestException(
            'Swap must be accepted by the peer before manager approval',
          );
        }
        if (!swap.targetStaffId) {
          throw new BadRequestException('Swap is missing target staff');
        }

        // Constraint engine re-run on the peer for the requester's shift.
        const evalData = await this.assignmentRepository.loadEvaluationData(
          swap.requestingAssignment.shiftId,
          swap.targetStaffId,
        );
        if (!evalData.shift || !evalData.staff) {
          throw new BadRequestException('Cannot reload data for re-validation');
        }
        // The peer's own existing assignment for this swap should be excluded
        // since it's about to be removed in the same transaction.
        const filteredAssignments = swap.targetAssignmentId
          ? evalData.staffAssignments.filter(
              (a) => a.id !== swap.targetAssignmentId,
            )
          : evalData.staffAssignments;

        const result = this.constraintEngine.evaluate({
          staff: {
            id: evalData.staff.id,
            displayName: evalData.staff.displayName,
            certifiedLocationIds: new Set(
              evalData.staff.certifications.map((c) => c.locationId),
            ),
            skillIds: new Set(evalData.staff.skills.map((s) => s.skillId)),
          },
          shift: {
            id: evalData.shift.id,
            locationId: evalData.shift.locationId,
            startAt: evalData.shift.startAt,
            endAt: evalData.shift.endAt,
            requiredSkillId: evalData.shift.requiredSkillId,
            locationTimezone: evalData.shift.location.timezone,
          },
          availability: {
            recurring: evalData.staff.recurringAvailability.map((r) => ({
              weekday: r.weekday,
              startTime: r.startTime,
              endTime: r.endTime,
              timezone: r.timezone,
            })),
            exceptions: evalData.staff.availabilityExceptions.map((e) => ({
              date: e.date.toISOString().slice(0, 10),
              isAvailable: e.isAvailable,
              startTime: e.startTime,
              endTime: e.endTime,
              timezone: e.timezone,
            })),
          },
          existingAssignments: filteredAssignments.map((a) => ({
            shiftId: a.shift.id,
            startAt: a.shift.startAt,
            endAt: a.shift.endAt,
            locationTimezone: a.shift.location.timezone,
          })),
          overtimeOverrides: evalData.overrides.map((o) => ({
            effectiveDate: o.effectiveDate.toISOString().slice(0, 10),
          })),
        });

        if (!result.allowed) {
          throw new BadRequestException(
            `Cannot approve swap: ${result.blocking
              .map((v) => v.message)
              .join('; ')}`,
          );
        }

        // Remove requester's assignment, optionally remove peer's assignment, add peer's.
        await tx.shiftAssignment.delete({
          where: { id: swap.requestingAssignmentId },
        });
        if (swap.targetAssignmentId) {
          await tx.shiftAssignment.delete({
            where: { id: swap.targetAssignmentId },
          });
        }
        await tx.shiftAssignment.create({
          data: {
            shiftId: swap.requestingAssignment.shiftId,
            staffId: swap.targetStaffId,
            assignedById: decidedById,
          },
        });
      }

      await tx.swapRequest.update({
        where: { id },
        data: {
          status: SwapStatus.approved,
          decidedById,
          decidedAt: new Date(),
        },
      });

      const refreshed = await this.swapRepository.findById(id);
      if (!refreshed) throw new NotFoundException('Swap disappeared');

      // Notify everyone affected (requester always, peer if swap).
      const targets: string[] = [refreshed.requesterId];
      if (refreshed.targetStaffId) targets.push(refreshed.targetStaffId);
      void this.notificationsService.notifyMany(
        targets.map((userId) => ({
          userId,
          type: 'swap_approved',
          title:
            refreshed.type === SwapType.drop
              ? 'Your drop request was approved'
              : 'Your swap was approved by the manager',
          payload: { swapId: id },
          email: true,
        })),
      );

      return this.toDto(refreshed);
    });
  }

  async reject(
    id: string,
    decidedById: string,
    reason?: string,
  ): Promise<SwapRequestDto> {
    const swap = await this.requireActive(id);
    const updated = await this.swapRepository.updateStatus(id, {
      status: SwapStatus.rejected,
      decidedById,
      decidedAt: new Date(),
      rejectionReason: reason ?? null,
    });
    const targets: string[] = [swap.requesterId];
    if (swap.targetStaffId) targets.push(swap.targetStaffId);
    void this.notificationsService.notifyMany(
      targets.map((userId) => ({
        userId,
        type: 'swap_rejected',
        title: 'A swap or drop request was rejected by the manager',
        body: reason ?? undefined,
        payload: { swapId: id },
      })),
    );
    return this.toDto({ ...swap, ...updated });
  }

  /** Used by ShiftsService when a shift is edited; cancels affected pending swaps. */
  async cancelActiveForShift(
    shiftId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return this.swapRepository.cancelActiveForShift(shiftId, tx);
  }

  /**
   * Used by a periodic job (or on-demand for a request being read) to expire
   * drop requests whose shift is within the cutoff window.
   */
  async expireOverdueDrops(): Promise<number> {
    const result = await this.prisma.swapRequest.updateMany({
      where: {
        type: SwapType.drop,
        status: SwapStatus.pending,
        expiresAt: { lt: new Date() },
      },
      data: { status: SwapStatus.expired },
    });
    return result.count;
  }

  private async requireActive(
    id: string,
    opts: { allowFinal?: boolean } = {},
  ): Promise<SwapWithRelations> {
    const swap = await this.swapRepository.findById(id);
    if (!swap) throw new NotFoundException(`Swap ${id} not found`);
    if (!opts.allowFinal && this.isFinal(swap.status)) {
      throw new ConflictException(
        `Swap is in final state ${swap.status} and cannot be modified`,
      );
    }
    return swap;
  }

  private assertNotFinal(status: SwapStatus): void {
    if (this.isFinal(status)) {
      throw new ConflictException(
        `Swap is in final state ${status} and cannot be modified`,
      );
    }
  }

  private isFinal(status: SwapStatus): boolean {
    return FINAL_STATUSES.includes(status);
  }

  private toDto(row: SwapWithRelations): SwapRequestDto {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      requestingAssignmentId: row.requestingAssignmentId,
      requesterId: row.requesterId,
      requesterDisplayName: row.requester.displayName,
      targetStaffId: row.targetStaffId,
      targetStaffDisplayName: row.targetStaff?.displayName ?? null,
      targetAssignmentId: row.targetAssignmentId,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      decidedById: row.decidedById,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      rejectionReason: row.rejectionReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      shiftId: row.requestingAssignment.shiftId,
      shiftStartAt: row.requestingAssignment.shift.startAt.toISOString(),
      shiftEndAt: row.requestingAssignment.shift.endAt.toISOString(),
      shiftLocationName: row.requestingAssignment.shift.location.name,
      shiftLocationTimezone:
        row.requestingAssignment.shift.location.timezone,
    };
  }
}

