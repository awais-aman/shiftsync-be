import { Injectable, NotFoundException } from '@nestjs/common';
import type { Location } from '@prisma/client';
import { LocationRepository } from '@/database/repositories/location.repository';
import { CreateLocationDto } from '@/locations/dto/create-location.dto';
import { LocationDto } from '@/locations/dto/location.dto';
import { UpdateLocationDto } from '@/locations/dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly locationRepository: LocationRepository) {}

  async list(): Promise<LocationDto[]> {
    const rows = await this.locationRepository.list();
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
