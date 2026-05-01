import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { UserRepository } from '@/database/repositories/user.repository';

export type ScopeContext = {
  role: UserRole;
  /** null = unscoped (admin); array = the only locations this caller may touch. */
  managedLocationIds: string[] | null;
  /** Locations this caller is certified at as staff (only meaningful when role=staff). */
  certifiedLocationIds: string[];
};

@Injectable()
export class LocationScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userRepository: UserRepository,
  ) {}

  async contextFor(userId: string): Promise<ScopeContext> {
    const profile = await this.userRepository.findProfileById(userId);
    if (!profile) {
      throw new ForbiddenException('Profile not found');
    }

    if (profile.role === UserRole.admin) {
      return {
        role: UserRole.admin,
        managedLocationIds: null,
        certifiedLocationIds: [],
      };
    }

    if (profile.role === UserRole.manager) {
      const rows = await this.prisma.managerLocation.findMany({
        where: { managerId: userId },
        select: { locationId: true },
      });
      return {
        role: UserRole.manager,
        managedLocationIds: rows.map((r) => r.locationId),
        certifiedLocationIds: [],
      };
    }

    const rows = await this.prisma.staffCertification.findMany({
      where: { staffId: userId },
      select: { locationId: true },
    });
    return {
      role: UserRole.staff,
      managedLocationIds: [],
      certifiedLocationIds: rows.map((r) => r.locationId),
    };
  }

  /**
   * Throws ForbiddenException if the caller may not act on `locationId`.
   * Admin always passes; manager must manage that location; staff is never
   * allowed (this helper is for management actions only).
   */
  async assertCanManageLocation(
    userId: string,
    locationId: string,
  ): Promise<void> {
    const ctx = await this.contextFor(userId);
    if (ctx.managedLocationIds === null) return; // admin
    if (ctx.role !== UserRole.manager) {
      throw new ForbiddenException(
        'Only admins or managers can perform this action',
      );
    }
    if (!ctx.managedLocationIds.includes(locationId)) {
      throw new ForbiddenException('You do not manage this location');
    }
  }
}
