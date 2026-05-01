import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { AnalyticsService } from '@/analytics/analytics.service';
import { FairnessReportDto } from '@/analytics/dto/fairness.dto';
import {
  FairnessQueryDto,
  OvertimeProjectionQueryDto,
} from '@/analytics/dto/list-analytics.dto';
import { OvertimeProjectionDto } from '@/analytics/dto/overtime-projection.dto';
import type { AuthenticatedUser } from '@/types/auth';

@ApiTags('Analytics')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired JWT' })
@ApiForbiddenResponse({ description: 'Authenticated but lacks required role' })
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.manager)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('fairness')
  @ApiOperation({
    summary:
      'Hours assigned per staff and premium-shift distribution over a period (default last 4 weeks).',
  })
  @ApiOkResponse({ type: FairnessReportDto })
  fairness(
    @Query() query: FairnessQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FairnessReportDto> {
    return this.analyticsService.fairness(user.id, {
      from: query.from,
      to: query.to,
    });
  }

  @Get('overtime')
  @ApiOperation({
    summary:
      'Projected weekly hours per staff for the target week, with warn/block flags.',
  })
  @ApiOkResponse({ type: OvertimeProjectionDto })
  overtime(
    @Query() query: OvertimeProjectionQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OvertimeProjectionDto> {
    return this.analyticsService.overtimeProjection(
      user.id,
      query.weekStart,
    );
  }
}
