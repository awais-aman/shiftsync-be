import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
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
import { CreateOvertimeOverrideDto } from '@/overtime/dto/create-override.dto';
import { OvertimeOverrideDto } from '@/overtime/dto/override.dto';
import { OvertimeService } from '@/overtime/overtime.service';
import { RoutePaths } from '@/shared/constants';
import type { AuthenticatedUser } from '@/types/auth';

@ApiTags('Overtime')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired JWT' })
@ApiForbiddenResponse({ description: 'Authenticated but lacks required role' })
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.manager)
@Controller(`${RoutePaths.Overtime}/overrides`)
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  @Get()
  @ApiOperation({
    summary:
      'List overtime overrides for a staff member (admin or manager)',
  })
  @ApiOkResponse({ type: OvertimeOverrideDto, isArray: true })
  list(
    @Query('staffId', new ParseUUIDPipe()) staffId: string,
  ): Promise<OvertimeOverrideDto[]> {
    return this.overtimeService.listForStaff(staffId);
  }

  @Post()
  @ApiOperation({
    summary:
      'Grant a 7th-consecutive-day override for a staff member on a date',
  })
  @ApiCreatedResponse({ type: OvertimeOverrideDto })
  @ApiConflictResponse({
    description: 'Override already exists for this staff/date pair',
  })
  create(
    @Body() dto: CreateOvertimeOverrideDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OvertimeOverrideDto> {
    return this.overtimeService.create(dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an override' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Override not found' })
  async delete(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.overtimeService.delete(id);
  }
}
