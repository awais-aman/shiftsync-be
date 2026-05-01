import { Inject, Injectable, Logger } from '@nestjs/common';
import { ShiftStatus, UserRole } from '@prisma/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { LocationScopeService } from '@/common/scope/location-scope.service';
import { PrismaService } from '@/database/prisma.service';
import { OnDutyLocationDto } from '@/on-duty/dto/on-duty.dto';
import { Provides } from '@/shared/constants';

@Injectable()
export class OnDutyService {
  private readonly logger = new Logger(OnDutyService.name);

  constructor(
    @Inject(Provides.Supabase) private readonly supabase: SupabaseClient,
    private readonly prisma: PrismaService,
    private readonly scopeService: LocationScopeService,
  ) {}

  /**
   * Currently active shifts (start_at <= now < end_at), grouped by location.
   * Only published shifts are returned (drafts are not "real" yet). Scope:
   * admin sees all, manager sees managed locations, staff sees certified ones.
   * Empty locations are included so the live grid still shows them.
   */
  async listForActor(actorId: string): Promise<OnDutyLocationDto[]> {
    const ctx = await this.scopeService.contextFor(actorId);
    const visibleLocationIds = await this.resolveVisibleLocationIds(ctx);
    if (visibleLocationIds === null) {
      // Admin: all locations.
    } else if (visibleLocationIds.length === 0) {
      return [];
    }

    const now = new Date();
    const locations = await this.prisma.location.findMany({
      where:
        visibleLocationIds === null
          ? {}
          : { id: { in: visibleLocationIds } },
      orderBy: { name: 'asc' },
      include: {
        shifts: {
          where: {
            status: ShiftStatus.published,
            startAt: { lte: now },
            endAt: { gt: now },
          },
          orderBy: { startAt: 'asc' },
          include: {
            requiredSkill: true,
            assignments: {
              include: { staff: true },
              orderBy: { assignedAt: 'asc' },
            },
          },
        },
      },
    });

    const staffIds = new Set<string>();
    for (const location of locations) {
      for (const shift of location.shifts) {
        for (const assignment of shift.assignments) {
          staffIds.add(assignment.staffId);
        }
      }
    }
    const emailById = await this.fetchEmailMap(staffIds);

    return locations.map((location) => ({
      locationId: location.id,
      locationName: location.name,
      locationTimezone: location.timezone,
      shifts: location.shifts.map((shift) => ({
        id: shift.id,
        startAt: shift.startAt.toISOString(),
        endAt: shift.endAt.toISOString(),
        requiredSkillName: shift.requiredSkill.name,
        headcount: shift.headcount,
        assignedStaff: shift.assignments.map((a) => ({
          id: a.staff.id,
          displayName: a.staff.displayName,
          email: emailById.get(a.staff.id),
        })),
      })),
    }));
  }

  private async resolveVisibleLocationIds(
    ctx: Awaited<ReturnType<LocationScopeService['contextFor']>>,
  ): Promise<string[] | null> {
    if (ctx.role === UserRole.admin) return null;
    if (ctx.role === UserRole.manager) return ctx.managedLocationIds ?? [];
    return ctx.certifiedLocationIds;
  }

  private async fetchEmailMap(
    ids: Set<string>,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.size === 0) return map;
    // listUsers paginates; for the small staff sets we have, a single page is fine.
    const { data, error } = await this.supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) {
      this.logger.error(`Failed to list auth users: ${error.message}`);
      return map;
    }
    for (const user of data.users) {
      if (ids.has(user.id) && user.email) map.set(user.id, user.email);
    }
    return map;
  }
}
