import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type OvertimeOverride } from '@prisma/client';
import { OvertimeOverrideRepository } from '@/database/repositories/overtime-override.repository';
import { CreateOvertimeOverrideDto } from '@/overtime/dto/create-override.dto';
import { OvertimeOverrideDto } from '@/overtime/dto/override.dto';

@Injectable()
export class OvertimeService {
  constructor(
    private readonly overrideRepository: OvertimeOverrideRepository,
  ) {}

  async listForStaff(staffId: string): Promise<OvertimeOverrideDto[]> {
    const rows = await this.overrideRepository.listForStaff(staffId);
    return rows.map((row) => this.toDto(row));
  }

  async create(
    dto: CreateOvertimeOverrideDto,
    approvedById: string,
  ): Promise<OvertimeOverrideDto> {
    try {
      const created = await this.overrideRepository.create({
        staffId: dto.staffId,
        effectiveDate: dto.effectiveDate,
        reason: dto.reason.trim(),
        approvedById,
      });
      return this.toDto(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An override already exists for this staff member on this date',
        );
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const existing = await this.overrideRepository.findById(id);
    if (!existing) throw new NotFoundException(`Override ${id} not found`);
    await this.overrideRepository.delete(id);
  }

  private toDto(row: OvertimeOverride): OvertimeOverrideDto {
    return {
      id: row.id,
      staffId: row.staffId,
      effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
      reason: row.reason,
      approvedById: row.approvedById,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
