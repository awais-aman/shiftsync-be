import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ShiftStatus, UserRole } from '@prisma/client';
import { toZonedTime } from 'date-fns-tz';
import {
  type ListShiftsFilters,
  type ShiftWithRelations,
  ShiftRepository,
} from '@/database/repositories/shift.repository';
import { LocationRepository } from '@/database/repositories/location.repository';
import { SkillRepository } from '@/database/repositories/skill.repository';
import { SwapRepository } from '@/database/repositories/swap.repository';
import { AuditService } from '@/audit/audit.service';
import { LocationDto } from '@/locations/dto/location.dto';
import { LocationScopeService } from '@/common/scope/location-scope.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/database/prisma.service';
import { SkillDto } from '@/skills/dto/skill.dto';
import { CreateShiftDto } from '@/shifts/dto/create-shift.dto';
import { ShiftDto } from '@/shifts/dto/shift.dto';
import { UpdateShiftDto } from '@/shifts/dto/update-shift.dto';
import { PUBLISH_CUTOFF_HOURS } from '@/shared/constants';

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    private readonly shiftRepository: ShiftRepository,
    private readonly locationRepository: LocationRepository,
    private readonly skillRepository: SkillRepository,
    private readonly swapRepository: SwapRepository,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly scopeService: LocationScopeService,
    private readonly prisma: PrismaService,
  ) {}

  async list(
    filters: ListShiftsFilters,
    actorId: string,
  ): Promise<ShiftDto[]> {
    const ctx = await this.scopeService.contextFor(actorId);
    const scoped: ListShiftsFilters = { ...filters };
    if (ctx.role === UserRole.manager) {
      scoped.locationIdsAllowed = ctx.managedLocationIds ?? [];
    } else if (ctx.role === UserRole.staff) {
      scoped.locationIdsAllowed = ctx.certifiedLocationIds;
      scoped.publishedOnly = true;
    }
    const rows = await this.shiftRepository.list(scoped);
    return rows.map((row) => this.toDto(row));
  }

  async findById(id: string, actorId: string): Promise<ShiftDto> {
    const shift = await this.shiftRepository.findById(id);
    if (!shift) throw new NotFoundException(`Shift ${id} not found`);
    await this.assertCanRead(shift, actorId);
    return this.toDto(shift);
  }

  /** Throws ForbiddenException if the actor isn't allowed to see this shift. */
  private async assertCanRead(
    shift: ShiftWithRelations,
    actorId: string,
  ): Promise<void> {
    const ctx = await this.scopeService.contextFor(actorId);
    if (ctx.role === UserRole.admin) return;
    if (ctx.role === UserRole.manager) {
      if (!ctx.managedLocationIds?.includes(shift.locationId)) {
        throw new ForbiddenException('You do not manage this location');
      }
      return;
    }
    // Staff: published shifts at locations they're certified at.
    if (
      shift.status !== ShiftStatus.published ||
      !ctx.certifiedLocationIds.includes(shift.locationId)
    ) {
      throw new ForbiddenException('Shift not visible to you');
    }
  }

  async create(dto: CreateShiftDto, actorId: string): Promise<ShiftDto> {
    if (dto.endAt <= dto.startAt) {
      throw new BadRequestException('endAt must be after startAt');
    }

    await this.scopeService.assertCanManageLocation(actorId, dto.locationId);

    const location = await this.locationRepository.findById(dto.locationId);
    if (!location) {
      throw new BadRequestException(`Location ${dto.locationId} not found`);
    }
    const skill = await this.skillRepository.findById(dto.requiredSkillId);
    if (!skill) {
      throw new BadRequestException(`Skill ${dto.requiredSkillId} not found`);
    }

    const isPremium = this.computeIsPremium(dto.startAt, location.timezone);

    const created = await this.shiftRepository.create({
      locationId: dto.locationId,
      startAt: dto.startAt,
      endAt: dto.endAt,
      requiredSkillId: dto.requiredSkillId,
      headcount: dto.headcount,
      isPremium,
      status: ShiftStatus.draft,
    });
    void this.auditService.record({
      actorId,
      entityType: 'shift',
      entityId: created.id,
      action: 'create',
      after: this.snapshot(created),
      locationId: created.locationId,
    });
    return this.toDto(created);
  }

  async update(
    id: string,
    dto: UpdateShiftDto,
    actorId: string,
  ): Promise<ShiftDto> {
    const existing = await this.shiftRepository.findById(id);
    if (!existing) throw new NotFoundException(`Shift ${id} not found`);
    await this.scopeService.assertCanManageLocation(actorId, existing.locationId);
    if (dto.locationId && dto.locationId !== existing.locationId) {
      // Moving a shift to a different location requires authority over the
      // destination too.
      await this.scopeService.assertCanManageLocation(actorId, dto.locationId);
    }
    const before = this.snapshot(existing);

    const startAt = dto.startAt ?? existing.startAt;
    const endAt = dto.endAt ?? existing.endAt;
    if (endAt <= startAt) {
      throw new BadRequestException('endAt must be after startAt');
    }

    if (dto.locationId && dto.locationId !== existing.locationId) {
      const location = await this.locationRepository.findById(dto.locationId);
      if (!location) {
        throw new BadRequestException(`Location ${dto.locationId} not found`);
      }
    }
    if (dto.requiredSkillId && dto.requiredSkillId !== existing.requiredSkillId) {
      const skill = await this.skillRepository.findById(dto.requiredSkillId);
      if (!skill) {
        throw new BadRequestException(`Skill ${dto.requiredSkillId} not found`);
      }
    }

    const targetLocation =
      dto.locationId && dto.locationId !== existing.locationId
        ? await this.locationRepository.findById(dto.locationId)
        : existing.location;
    if (!targetLocation) {
      throw new BadRequestException('Target location not found');
    }
    const isPremium = this.computeIsPremium(startAt, targetLocation.timezone);

    const updated = await this.shiftRepository.updateWithVersion(
      id,
      dto.version,
      {
        ...(dto.locationId !== undefined && { locationId: dto.locationId }),
        ...(dto.startAt !== undefined && { startAt: dto.startAt }),
        ...(dto.endAt !== undefined && { endAt: dto.endAt }),
        ...(dto.requiredSkillId !== undefined && {
          requiredSkillId: dto.requiredSkillId,
        }),
        ...(dto.headcount !== undefined && { headcount: dto.headcount }),
        isPremium,
        version: { increment: 1 },
      },
    );
    if (!updated) {
      throw new ConflictException(
        'Shift was modified by someone else; reload and try again',
      );
    }

    // Auto-cancel any active swap requests touching this shift, since the
    // edit may have invalidated the original constraints.
    const cancelledCount = await this.swapRepository.cancelActiveForShift(id);
    if (cancelledCount > 0) {
      this.logger.log(
        `Cancelled ${cancelledCount} active swap request(s) due to edit of shift ${id}`,
      );
    }

    void this.notifyAssignees(id, {
      type: 'shift_edited',
      title: 'A shift you\'re assigned to was edited',
      payload: { shiftId: id },
    });

    void this.auditService.record({
      actorId,
      entityType: 'shift',
      entityId: id,
      action: 'update',
      before,
      after: this.snapshot(updated),
      locationId: updated.locationId,
    });

    return this.toDto(updated);
  }

  async delete(id: string, actorId: string): Promise<void> {
    const existing = await this.shiftRepository.findById(id);
    if (!existing) throw new NotFoundException(`Shift ${id} not found`);
    await this.scopeService.assertCanManageLocation(actorId, existing.locationId);
    await this.shiftRepository.delete(id);
    void this.auditService.record({
      actorId,
      entityType: 'shift',
      entityId: id,
      action: 'delete',
      before: this.snapshot(existing),
      locationId: existing.locationId,
    });
  }

  async publish(
    id: string,
    expectedVersion: number,
    actorId: string,
  ): Promise<ShiftDto> {
    const existing = await this.shiftRepository.findById(id);
    if (!existing) throw new NotFoundException(`Shift ${id} not found`);
    await this.scopeService.assertCanManageLocation(actorId, existing.locationId);
    this.assertWithinCutoff(existing.startAt, 'publish');
    if (existing.status === ShiftStatus.published) {
      throw new BadRequestException('Shift is already published');
    }

    const updated = await this.shiftRepository.updateWithVersion(
      id,
      expectedVersion,
      {
        status: ShiftStatus.published,
        publishedAt: new Date(),
        version: { increment: 1 },
      },
    );
    if (!updated) {
      throw new ConflictException(
        'Shift was modified by someone else; reload and try again',
      );
    }
    void this.notifyAssignees(id, {
      type: 'shift_published',
      title: 'A shift you\'re assigned to was published',
      payload: { shiftId: id },
    });
    void this.auditService.record({
      actorId,
      entityType: 'shift',
      entityId: id,
      action: 'publish',
      before: this.snapshot(existing),
      after: this.snapshot(updated),
      locationId: updated.locationId,
    });
    return this.toDto(updated);
  }

  async unpublish(
    id: string,
    expectedVersion: number,
    actorId: string,
  ): Promise<ShiftDto> {
    const existing = await this.shiftRepository.findById(id);
    if (!existing) throw new NotFoundException(`Shift ${id} not found`);
    await this.scopeService.assertCanManageLocation(actorId, existing.locationId);
    this.assertWithinCutoff(existing.startAt, 'unpublish');
    if (existing.status !== ShiftStatus.published) {
      throw new BadRequestException('Shift is not published');
    }

    const updated = await this.shiftRepository.updateWithVersion(
      id,
      expectedVersion,
      {
        status: ShiftStatus.draft,
        publishedAt: null,
        version: { increment: 1 },
      },
    );
    if (!updated) {
      throw new ConflictException(
        'Shift was modified by someone else; reload and try again',
      );
    }
    void this.auditService.record({
      actorId,
      entityType: 'shift',
      entityId: id,
      action: 'unpublish',
      before: this.snapshot(existing),
      after: this.snapshot(updated),
      locationId: updated.locationId,
    });
    return this.toDto(updated);
  }

  private snapshot(row: ShiftWithRelations): Record<string, unknown> {
    return {
      id: row.id,
      locationId: row.locationId,
      requiredSkillId: row.requiredSkillId,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      headcount: row.headcount,
      isPremium: row.isPremium,
      status: row.status,
      version: row.version,
    };
  }

  private async notifyAssignees(
    shiftId: string,
    template: {
      type: import('@prisma/client').NotificationType;
      title: string;
      body?: string;
      payload?: Record<string, unknown>;
    },
  ): Promise<void> {
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: { shiftId },
      select: { staffId: true },
    });
    if (assignments.length === 0) return;
    await this.notificationsService.notifyMany(
      assignments.map((a) => ({
        userId: a.staffId,
        type: template.type,
        title: template.title,
        body: template.body,
        payload: template.payload,
        email: true,
      })),
    );
  }

  /**
   * Friday or Saturday with start time at or after 17:00 in the location's
   * timezone. Premium tag drives fairness analytics.
   */
  private computeIsPremium(startAt: Date, timezone: string): boolean {
    const local = toZonedTime(startAt, timezone);
    const day = local.getDay();
    const hour = local.getHours();
    const isFriOrSat = day === 5 || day === 6;
    return isFriOrSat && hour >= 17;
  }

  private assertWithinCutoff(startAt: Date, action: string): void {
    const cutoffMs = PUBLISH_CUTOFF_HOURS * 60 * 60 * 1000;
    const remainingMs = startAt.getTime() - Date.now();
    if (remainingMs < cutoffMs) {
      throw new BadRequestException(
        `Cannot ${action} a shift starting in less than ${PUBLISH_CUTOFF_HOURS} hours`,
      );
    }
  }

  private toDto(row: ShiftWithRelations): ShiftDto {
    return {
      id: row.id,
      locationId: row.locationId,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      requiredSkillId: row.requiredSkillId,
      headcount: row.headcount,
      isPremium: row.isPremium,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      location: this.locationToDto(row.location),
      requiredSkill: this.skillToDto(row.requiredSkill),
    };
  }

  private locationToDto(location: ShiftWithRelations['location']): LocationDto {
    return {
      id: location.id,
      name: location.name,
      timezone: location.timezone,
      address: location.address,
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString(),
    };
  }

  private skillToDto(skill: ShiftWithRelations['requiredSkill']): SkillDto {
    return {
      id: skill.id,
      name: skill.name,
      createdAt: skill.createdAt.toISOString(),
      updatedAt: skill.updatedAt.toISOString(),
    };
  }
}
