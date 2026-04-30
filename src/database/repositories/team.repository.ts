import { Injectable } from '@nestjs/common';
import type { Location, Skill, User } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

export type MemberWithJoins = User & {
  certifications: { location: Location }[];
  skills: { skill: Skill }[];
  managedLocations: { location: Location }[];
};

@Injectable()
export class TeamRepository {
  constructor(private readonly prisma: PrismaService) {}

  listMembers(): Promise<MemberWithJoins[]> {
    return this.prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
      include: {
        certifications: { include: { location: true } },
        skills: { include: { skill: true } },
        managedLocations: { include: { location: true } },
      },
    });
  }

  findMemberById(id: string): Promise<MemberWithJoins | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        certifications: { include: { location: true } },
        skills: { include: { skill: true } },
        managedLocations: { include: { location: true } },
      },
    });
  }

  async setCertifications(
    staffId: string,
    locationIds: string[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.staffCertification.deleteMany({ where: { staffId } }),
      this.prisma.staffCertification.createMany({
        data: locationIds.map((locationId) => ({ staffId, locationId })),
        skipDuplicates: true,
      }),
    ]);
  }

  async setSkills(staffId: string, skillIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.staffSkill.deleteMany({ where: { staffId } }),
      this.prisma.staffSkill.createMany({
        data: skillIds.map((skillId) => ({ staffId, skillId })),
        skipDuplicates: true,
      }),
    ]);
  }

  async setManagedLocations(
    managerId: string,
    locationIds: string[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.managerLocation.deleteMany({ where: { managerId } }),
      this.prisma.managerLocation.createMany({
        data: locationIds.map((locationId) => ({ managerId, locationId })),
        skipDuplicates: true,
      }),
    ]);
  }

  async locationsExist(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const count = await this.prisma.location.count({
      where: { id: { in: ids } },
    });
    return count === ids.length;
  }

  async skillsExist(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const count = await this.prisma.skill.count({
      where: { id: { in: ids } },
    });
    return count === ids.length;
  }
}
