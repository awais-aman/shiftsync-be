import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type AvailabilityException,
  type AvailabilityRecurring,
} from '@prisma/client';
import { AvailabilityRepository } from '@/database/repositories/availability.repository';
import { AvailabilityDto } from '@/availability/dto/availability.dto';
import { CreateAvailabilityExceptionDto } from '@/availability/dto/create-exception.dto';
import { CreateRecurringAvailabilityDto } from '@/availability/dto/create-recurring.dto';
import { AvailabilityExceptionDto } from '@/availability/dto/exception.dto';
import { RecurringAvailabilityDto } from '@/availability/dto/recurring.dto';
import { NotificationsService } from '@/notifications/notifications.service';

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly availabilityRepository: AvailabilityRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Notify managers of any location this staff is certified at. */
  private notifyManagers(staffId: string, action: string): void {
    void this.notificationsService.notifyManagersOfStaff(staffId, {
      type: 'availability_changed',
      title: 'Staff availability changed',
      body: action,
      payload: { staffId, action },
    });
  }

  async getForStaff(staffId: string): Promise<AvailabilityDto> {
    const [recurring, exceptions] = await Promise.all([
      this.availabilityRepository.listRecurring(staffId),
      this.availabilityRepository.listExceptions(staffId),
    ]);
    return {
      recurring: recurring.map((row) => this.toRecurringDto(row)),
      exceptions: exceptions.map((row) => this.toExceptionDto(row)),
    };
  }

  async createRecurring(
    staffId: string,
    dto: CreateRecurringAvailabilityDto,
  ): Promise<RecurringAvailabilityDto> {
    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException(
        'endTime must be later than startTime (overnight not supported)',
      );
    }

    try {
      const created = await this.availabilityRepository.createRecurring({
        staffId,
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
        timezone: dto.timezone,
      });
      this.notifyManagers(staffId, 'recurring window added');
      return this.toRecurringDto(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A recurring window already exists for this weekday and start time',
        );
      }
      throw error;
    }
  }

  async updateRecurring(
    staffId: string,
    id: string,
    dto: CreateRecurringAvailabilityDto,
  ): Promise<RecurringAvailabilityDto> {
    const existing = await this.availabilityRepository.findRecurringById(id);
    if (!existing) throw new NotFoundException(`Recurring window ${id} not found`);
    if (existing.staffId !== staffId) {
      throw new ForbiddenException('Cannot modify another user\'s availability');
    }
    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException('endTime must be later than startTime');
    }

    try {
      const updated = await this.availabilityRepository.updateRecurring(id, {
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
        timezone: dto.timezone,
      });
      this.notifyManagers(staffId, 'recurring window updated');
      return this.toRecurringDto(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A recurring window already exists for this weekday and start time',
        );
      }
      throw error;
    }
  }

  async deleteRecurring(staffId: string, id: string): Promise<void> {
    const existing = await this.availabilityRepository.findRecurringById(id);
    if (!existing) throw new NotFoundException(`Recurring window ${id} not found`);
    if (existing.staffId !== staffId) {
      throw new ForbiddenException('Cannot modify another user\'s availability');
    }
    await this.availabilityRepository.deleteRecurring(id);
    this.notifyManagers(staffId, 'recurring window removed');
  }

  async createException(
    staffId: string,
    dto: CreateAvailabilityExceptionDto,
  ): Promise<AvailabilityExceptionDto> {
    this.validateExceptionTimes(dto);
    const created = await this.availabilityRepository.createException({
      staffId,
      date: dto.date,
      isAvailable: dto.isAvailable,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      timezone: dto.timezone,
    });
    this.notifyManagers(staffId, 'exception added');
    return this.toExceptionDto(created);
  }

  async updateException(
    staffId: string,
    id: string,
    dto: CreateAvailabilityExceptionDto,
  ): Promise<AvailabilityExceptionDto> {
    const existing = await this.availabilityRepository.findExceptionById(id);
    if (!existing) throw new NotFoundException(`Exception ${id} not found`);
    if (existing.staffId !== staffId) {
      throw new ForbiddenException('Cannot modify another user\'s availability');
    }
    this.validateExceptionTimes(dto);

    const updated = await this.availabilityRepository.updateException(id, {
      date: dto.date,
      isAvailable: dto.isAvailable,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      timezone: dto.timezone,
    });
    this.notifyManagers(staffId, 'exception updated');
    return this.toExceptionDto(updated);
  }

  async deleteException(staffId: string, id: string): Promise<void> {
    const existing = await this.availabilityRepository.findExceptionById(id);
    if (!existing) throw new NotFoundException(`Exception ${id} not found`);
    if (existing.staffId !== staffId) {
      throw new ForbiddenException('Cannot modify another user\'s availability');
    }
    await this.availabilityRepository.deleteException(id);
    this.notifyManagers(staffId, 'exception removed');
  }

  private validateExceptionTimes(dto: CreateAvailabilityExceptionDto): void {
    const hasStart = dto.startTime !== undefined && dto.startTime !== null;
    const hasEnd = dto.endTime !== undefined && dto.endTime !== null;
    if (hasStart !== hasEnd) {
      throw new BadRequestException(
        'startTime and endTime must both be provided or both omitted',
      );
    }
    if (hasStart && hasEnd && dto.endTime! <= dto.startTime!) {
      throw new BadRequestException('endTime must be later than startTime');
    }
  }

  private toRecurringDto(row: AvailabilityRecurring): RecurringAvailabilityDto {
    return {
      id: row.id,
      staffId: row.staffId,
      weekday: row.weekday,
      startTime: row.startTime,
      endTime: row.endTime,
      timezone: row.timezone,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toExceptionDto(row: AvailabilityException): AvailabilityExceptionDto {
    return {
      id: row.id,
      staffId: row.staffId,
      date: row.date.toISOString().slice(0, 10),
      isAvailable: row.isAvailable,
      startTime: row.startTime,
      endTime: row.endTime,
      timezone: row.timezone,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
