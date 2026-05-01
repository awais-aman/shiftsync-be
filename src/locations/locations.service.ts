import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Location } from '@prisma/client';
import { LocationRepository } from '@/database/repositories/location.repository';
import { LocationScopeService } from '@/common/scope/location-scope.service';
import { CreateLocationDto } from '@/locations/dto/create-location.dto';
import { LocationDto } from '@/locations/dto/location.dto';
import { UpdateLocationDto } from '@/locations/dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly scopeService: LocationScopeService,
  ) {}

  async list(actorId: string): Promise<LocationDto[]> {
    const ctx = await this.scopeService.contextFor(actorId);
    const idsAllowed =
      ctx.role === UserRole.admin
        ? undefined
        : ctx.role === UserRole.manager
          ? (ctx.managedLocationIds ?? [])
          : ctx.certifiedLocationIds;
    const rows = await this.locationRepository.list({ idsAllowed });
    return rows.map(this.toDto);
  }

  async findById(id: string): Promise<LocationDto> {
    const location = await this.locationRepository.findById(id);
    if (!location) {
      throw new NotFoundException(`Location ${id} not found`);
    }
    return this.toDto(location);
  }

  async create(dto: CreateLocationDto): Promise<LocationDto> {
    const created = await this.locationRepository.create(dto);
    return this.toDto(created);
  }

  async update(id: string, dto: UpdateLocationDto): Promise<LocationDto> {
    await this.findById(id);
    const updated = await this.locationRepository.update(id, dto);
    return this.toDto(updated);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.locationRepository.delete(id);
  }

  private toDto(row: Location): LocationDto {
    return {
      id: row.id,
      name: row.name,
      timezone: row.timezone,
      address: row.address,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
