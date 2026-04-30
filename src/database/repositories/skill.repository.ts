import { Injectable } from '@nestjs/common';
import type { Prisma, Skill } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class SkillRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<Skill[]> {
    return this.prisma.skill.findMany({ orderBy: { name: 'asc' } });
  }

  findById(id: string): Promise<Skill | null> {
    return this.prisma.skill.findUnique({ where: { id } });
  }

  findByName(name: string): Promise<Skill | null> {
    return this.prisma.skill.findUnique({ where: { name } });
  }

  create(data: Prisma.SkillCreateInput): Promise<Skill> {
    return this.prisma.skill.create({ data });
  }

  update(id: string, data: Prisma.SkillUpdateInput): Promise<Skill> {
    return this.prisma.skill.update({ where: { id }, data });
  }

  delete(id: string): Promise<Skill> {
    return this.prisma.skill.delete({ where: { id } });
  }
}
