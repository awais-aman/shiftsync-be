import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ShiftStatus } from '@prisma/client';
import { toZonedTime } from 'date-fns-tz';
import {
  type ListShiftsFilters,
  type ShiftWithRelations,
  ShiftRepository,
} from '@/database/repositories/shift.repository';
import { LocationRepository } from '@/database/repositories/location.repository';
import { SkillRepository } from '@/database/repositories/skill.repository';
import { SwapRepository } from '@/database/repositories/swap.repository';
import { LocationDto } from '@/locations/dto/location.dto';
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
    private readonly prisma: PrismaService,
  ) {}

  async list(filters: ListShiftsFilters): Promise<ShiftDto[]> {
    const rows = await this.shiftRepository.list(filters);
    return rows.map((row) => this.toDto(row));
  }

  async findById(id: string): Promise<ShiftDto> {
    const shift = await this.shiftRepository.findById(id);
    if (!shift) throw new NotFoundException(`Shift ${id} not found`);
    return this.toDto(shift);
  }

  async create(dto: CreateShiftDto): Promise<ShiftDto> {
    if (dto.endAt <= dto.startAt) {
      throw new BadRequestException('endAt must be after startAt');
    }

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
    return this.toDto(created);
  }

  async update(id: string, dto: UpdateShiftDto): Promise<ShiftDto> {
    const existing = await this.shiftRepository.findById(id);
    if (!existing) throw new NotFoundException(`Shift ${id} not found`);

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

    return this.toDto(updated);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.shiftRepository.delete(id);
  }

  async publish(id: string, expectedVersion: number): Promise<ShiftDto> {
    const existing = await this.shiftRepository.findById(id);
    if (!existing) throw new NotFoundException(`Shift ${id} not found`);
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
    return this.toDto(updated);
  }

  async unpublish(id: string, expectedVersion: number): Promise<ShiftDto> {
    const existing = await this.shiftRepository.findById(id);
    if (!existing) throw new NotFoundException(`Shift ${id} not found`);
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
    return this.toDto(updated);
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
