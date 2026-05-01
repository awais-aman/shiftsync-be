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
import { AuditService } from '@/audit/audit.service';
import { LocationScopeService } from '@/common/scope/location-scope.service';
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
    private readonly auditService: AuditService,
    private readonly scopeService: LocationScopeService,
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
    void this.auditService.record({
      actorId: staffId,
      entityType: 'swap_request',
      entityId: created.id,
      action: 'swap_create',
      after: {
        type: created.type,
        requesterId: staffId,
        targetStaffId: dto.targetStaffId,
      },
      locationId: requestingAssignment.shift.locationId,
    });
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
    const [outgoing, incoming, awaitingAll, ctx] = await Promise.all([
      this.swapRepository.listOutgoing(staffId),
      this.swapRepository.listIncoming(staffId),
      role === UserRole.admin || role === UserRole.manager
        ? this.swapRepository.listAwaitingApproval()
        : Promise.resolve([] as SwapWithRelations[]),
      role === UserRole.manager
        ? this.scopeService.contextFor(staffId)
        : Promise.resolve(null),
    ]);

    // Managers only see swaps for shifts at their managed locations.
    const awaitingApproval =
      ctx && ctx.managedLocationIds
        ? awaitingAll.filter((row) =>
            ctx.managedLocationIds!.includes(
              row.requestingAssignment.shift.locationId,
            ),
          )
        : awaitingAll;

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
    void this.auditService.record({
      actorId: requesterId,
      entityType: 'swap_request',
      entityId: id,
      action: 'swap_cancel',
      before: { status: swap.status },
      after: { status: SwapStatus.cancelled },
      locationId: swap.requestingAssignment.shift.locationId,
    });
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
    void this.auditService.record({
      actorId: peerId,
      entityType: 'swap_request',
      entityId: id,
      action: 'swap_accept',
      before: { status: swap.status },
      after: { status: SwapStatus.accepted_by_peer },
      locationId: swap.requestingAssignment.shift.locationId,
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
      await this.scopeService.assertCanManageLocation(
        decidedById,
        swap.requestingAssignment.shift.locationId,
      );

      if (swap.type === SwapType.drop) {
        if (
          swap.status !== SwapStatus.pending &&
          swap.status !== SwapStatus.accepted_by_peer
        ) {
          throw new BadRequestException(
            `Drop is in status ${swap.status}; only pending or claimed drops can be approved`,
          );
        }

        if (swap.targetStaffId) {
          // Drop was claimed by a staff member: re-run engine on the claimer
          // and transfer the assignment.
          const result = await this.evaluateForApprove(
            swap.requestingAssignment.shiftId,
            swap.targetStaffId,
            null,
          );
          if (!result.allowed) {
            throw new BadRequestException(
              `Cannot approve drop: ${result.messages.join('; ')}`,
            );
          }
          await tx.shiftAssignment.delete({
            where: { id: swap.requestingAssignmentId },
          });
          await tx.shiftAssignment.create({
            data: {
              shiftId: swap.requestingAssignment.shiftId,
              staffId: swap.targetStaffId,
              assignedById: decidedById,
            },
          });
        } else {
          // Unclaimed drop: just remove the requester's assignment.
          await tx.shiftAssignment.delete({
            where: { id: swap.requestingAssignmentId },
          });
        }
      } else {
        if (swap.status !== SwapStatus.accepted_by_peer) {
          throw new BadRequestException(
            'Swap must be accepted by the peer before manager approval',
          );
        }
        if (!swap.targetStaffId) {
          throw new BadRequestException('Swap is missing target staff');
        }

        // Re-run engine on the peer for the requester's shift, excluding
        // their swap-out assignment if any (it's about to be removed).
        const result = await this.evaluateForApprove(
          swap.requestingAssignment.shiftId,
          swap.targetStaffId,
          swap.targetAssignmentId ?? null,
        );
        if (!result.allowed) {
          throw new BadRequestException(
            `Cannot approve swap: ${result.messages.join('; ')}`,
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
      void this.auditService.record({
        actorId: decidedById,
        entityType: 'swap_request',
        entityId: id,
        action: 'swap_approve',
        before: { status: swap.status },
        after: { status: SwapStatus.approved },
        locationId: swap.requestingAssignment.shift.locationId,
      });

      return this.toDto(refreshed);
    });
  }

  async reject(
    id: string,
    decidedById: string,
    reason?: string,
  ): Promise<SwapRequestDto> {
    const swap = await this.requireActive(id);
    await this.scopeService.assertCanManageLocation(
      decidedById,
      swap.requestingAssignment.shift.locationId,
    );
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
    void this.auditService.record({
      actorId: decidedById,
      entityType: 'swap_request',
      entityId: id,
      action: 'swap_reject',
      before: { status: swap.status },
      after: { status: SwapStatus.rejected, reason },
      locationId: swap.requestingAssignment.shift.locationId,
    });
    return this.toDto({ ...swap, ...updated });
  }

  /**
   * Open drop requests the staff member is qualified to claim:
   * - status pending, type drop
   * - shift's required skill is in the staff's skills
   * - shift's location is in the staff's certified locations
   * - the staff is not the requester and not already assigned to that shift
   * The constraint engine is the authoritative check on actual claim.
   */
  async listOpenForStaff(staffId: string): Promise<SwapRequestDto[]> {
    // Expire overdue first so the list is fresh.
    await this.expireOverdueDrops();

    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      select: {
        skills: { select: { skillId: true } },
        certifications: { select: { locationId: true } },
      },
    });
    if (!staff) return [];

    const skillIds = staff.skills.map((s) => s.skillId);
    const locationIds = staff.certifications.map((c) => c.locationId);
    if (skillIds.length === 0 || locationIds.length === 0) return [];

    const rows = await this.prisma.swapRequest.findMany({
      where: {
        type: SwapType.drop,
        status: SwapStatus.pending,
        requesterId: { not: staffId },
        requestingAssignment: {
          shift: {
            requiredSkillId: { in: skillIds },
            locationId: { in: locationIds },
            // Don't list shifts the staff is already on.
            assignments: { none: { staffId } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, displayName: true } },
        targetStaff: { select: { id: true, displayName: true } },
        requestingAssignment: {
          include: { shift: { include: { location: true } } },
        },
      },
    });

    return rows.map((row) => this.toDto(row));
  }

  async claim(id: string, claimerId: string): Promise<SwapRequestDto> {
    const swap = await this.requireActive(id);
    if (swap.type !== SwapType.drop) {
      throw new BadRequestException('Only drop requests can be claimed');
    }
    if (swap.status !== SwapStatus.pending) {
      throw new BadRequestException(
        `Drop is in status ${swap.status}; only pending drops can be claimed`,
      );
    }
    if (swap.requesterId === claimerId) {
      throw new BadRequestException('Cannot claim your own drop request');
    }
    if (swap.targetStaffId) {
      throw new ConflictException(
        'Drop has already been claimed by another staff member',
      );
    }

    // Constraint engine must clear the claimer for this shift.
    const result = await this.evaluateForApprove(
      swap.requestingAssignment.shiftId,
      claimerId,
      null,
    );
    if (!result.allowed) {
      throw new BadRequestException(
        `Cannot claim this shift: ${result.messages.join('; ')}`,
      );
    }

    await this.prisma.swapRequest.update({
      where: { id },
      data: {
        targetStaffId: claimerId,
        status: SwapStatus.accepted_by_peer,
      },
    });

    // Notify requester their drop was claimed; managers see it in the queue.
    void this.notificationsService.notify({
      userId: swap.requesterId,
      type: 'swap_accepted',
      title: 'A coworker has claimed your drop request',
      body: 'Awaiting manager approval',
      payload: { swapId: id },
    });
    void this.auditService.record({
      actorId: claimerId,
      entityType: 'swap_request',
      entityId: id,
      action: 'swap_accept',
      before: { status: swap.status, targetStaffId: null },
      after: { status: SwapStatus.accepted_by_peer, targetStaffId: claimerId },
      locationId: swap.requestingAssignment.shift.locationId,
    });

    const refreshed = await this.swapRepository.findById(id);
    if (!refreshed) throw new NotFoundException('Swap disappeared');
    return this.toDto(refreshed);
  }

  /** Used by ShiftsService when a shift is edited; cancels affected pending swaps. */
  async cancelActiveForShift(
    shiftId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return this.swapRepository.cancelActiveForShift(shiftId, tx);
  }

  /**
   * Run the constraint engine for a candidate (peer or claimer) on the
   * requester's shift, optionally excluding one of their assignments (for
   * swap approve where the peer's other assignment is about to be removed).
   */
  private async evaluateForApprove(
    shiftId: string,
    candidateStaffId: string,
    excludeAssignmentId: string | null,
  ): Promise<{ allowed: boolean; messages: string[] }> {
    const data = await this.assignmentRepository.loadEvaluationData(
      shiftId,
      candidateStaffId,
    );
    if (!data.shift || !data.staff) {
      return {
        allowed: false,
        messages: ['Cannot reload data for re-validation'],
      };
    }
    const filtered = excludeAssignmentId
      ? data.staffAssignments.filter((a) => a.id !== excludeAssignmentId)
      : data.staffAssignments;
    const result = this.constraintEngine.evaluate({
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
      existingAssignments: filtered.map((a) => ({
        shiftId: a.shift.id,
        startAt: a.shift.startAt,
        endAt: a.shift.endAt,
        locationTimezone: a.shift.location.timezone,
      })),
      overtimeOverrides: data.overrides.map((o) => ({
        effectiveDate: o.effectiveDate.toISOString().slice(0, 10),
      })),
    });
    return {
      allowed: result.allowed,
      messages: result.blocking.map((v) => v.message),
    };
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

