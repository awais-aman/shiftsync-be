import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { RoutePaths } from '@/shared/constants';
import { AuditEntryDto } from '@/audit/dto/audit-entry.dto';
import { ListAuditDto } from '@/audit/dto/list-audit.dto';
import { AuditService } from '@/audit/audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired JWT' })
@ApiForbiddenResponse({ description: 'Authenticated but lacks required role' })
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller(RoutePaths.Audit)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.admin, UserRole.manager)
  @ApiOperation({
    summary:
      'List audit entries; admin or manager. Filterable by entity, actor, location, and date range.',
  })
  @ApiOkResponse({ type: AuditEntryDto, isArray: true })
  list(@Query() query: ListAuditDto): Promise<AuditEntryDto[]> {
    return this.auditService.list({
      entityType: query.entityType,
      entityId: query.entityId,
      action: query.action,
      actorId: query.actorId,
      locationId: query.locationId,
      from: query.from,
      to: query.to,
    });
  }

  @Get('export.csv')
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Stream audit entries as CSV (admin only); same filters as list.',
  })
  async export(
    @Query() query: ListAuditDto,
    @Res() res: Response,
  ): Promise<void> {
    const rows = await this.auditService.listRaw({
      entityType: query.entityType,
      entityId: query.entityId,
      action: query.action,
      actorId: query.actorId,
      locationId: query.locationId,
      from: query.from,
      to: query.to,
      // Cap export size; tighten if it ever becomes a concern.
      limit: 10_000,
    });
    const csv = this.auditService.toCsv(rows);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header(
      'Content-Disposition',
      'attachment; filename="shiftsync-audit.csv"',
    );
    res.send(csv);
  }
}
