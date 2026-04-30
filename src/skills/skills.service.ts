import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Skill } from '@prisma/client';
import { SkillRepository } from '@/database/repositories/skill.repository';
import { CreateSkillDto } from '@/skills/dto/create-skill.dto';
import { SkillDto } from '@/skills/dto/skill.dto';
import { UpdateSkillDto } from '@/skills/dto/update-skill.dto';

@Injectable()
export class SkillsService {
  constructor(private readonly skillRepository: SkillRepository) {}

  async list(): Promise<SkillDto[]> {
    const rows = await this.skillRepository.list();
    return rows.map(this.toDto);
  }

  async findById(id: string): Promise<SkillDto> {
    const skill = await this.skillRepository.findById(id);
    if (!skill) throw new NotFoundException(`Skill ${id} not found`);
    return this.toDto(skill);
  }

  async create(dto: CreateSkillDto): Promise<SkillDto> {
    const name = dto.name.trim().toLowerCase();
    const existing = await this.skillRepository.findByName(name);
    if (existing) {
      throw new ConflictException(`Skill "${name}" already exists`);
    }
    const created = await this.skillRepository.create({ name });
    return this.toDto(created);
  }

  async update(id: string, dto: UpdateSkillDto): Promise<SkillDto> {
    await this.findById(id);
    const data: { name?: string } = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim().toLowerCase();
      const existing = await this.skillRepository.findByName(name);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Skill "${name}" already exists`);
      }
      data.name = name;
    }
    const updated = await this.skillRepository.update(id, data);
    return this.toDto(updated);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.skillRepository.delete(id);
  }

  private toDto(row: Skill): SkillDto {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
