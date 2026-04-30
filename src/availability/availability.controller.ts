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
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { RoutePaths } from '@/shared/constants';
import type { AuthenticatedUser } from '@/types/auth';
import { AvailabilityService } from '@/availability/availability.service';
import { AvailabilityDto } from '@/availability/dto/availability.dto';
import { CreateAvailabilityExceptionDto } from '@/availability/dto/create-exception.dto';
import { CreateRecurringAvailabilityDto } from '@/availability/dto/create-recurring.dto';
import { AvailabilityExceptionDto } from '@/availability/dto/exception.dto';
import { RecurringAvailabilityDto } from '@/availability/dto/recurring.dto';

@ApiTags('Availability')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired JWT' })
@ApiForbiddenResponse({ description: 'Authenticated but lacks required role' })
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller(RoutePaths.Availability)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user\'s availability' })
  @ApiOkResponse({ type: AvailabilityDto })
  getMine(@CurrentUser() user: AuthenticatedUser): Promise<AvailabilityDto> {
    return this.availabilityService.getForStaff(user.id);
  }

  @Post('me/recurring')
  @ApiOperation({ summary: 'Add a recurring weekly availability window' })
  @ApiCreatedResponse({ type: RecurringAvailabilityDto })
  @ApiConflictResponse({
    description: 'A window already exists for this weekday and start time',
  })
  @ApiBadRequestResponse({
    description: 'Invalid times (overnight not supported, end must follow start)',
  })
  createRecurring(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecurringAvailabilityDto,
  ): Promise<RecurringAvailabilityDto> {
    return this.availabilityService.createRecurring(user.id, dto);
  }

  @Put('me/recurring/:id')
  @ApiOperation({ summary: 'Update one of my recurring windows' })
  @ApiOkResponse({ type: RecurringAvailabilityDto })
  @ApiNotFoundResponse({ description: 'Window not found' })
  @ApiForbiddenResponse({ description: 'Window belongs to a different user' })
  updateRecurring(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateRecurringAvailabilityDto,
  ): Promise<RecurringAvailabilityDto> {
    return this.availabilityService.updateRecurring(user.id, id, dto);
  }

  @Delete('me/recurring/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove one of my recurring windows' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Window not found' })
  async deleteRecurring(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.availabilityService.deleteRecurring(user.id, id);
  }

  @Post('me/exceptions')
  @ApiOperation({ summary: 'Add a one-off availability exception' })
  @ApiCreatedResponse({ type: AvailabilityExceptionDto })
  createException(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAvailabilityExceptionDto,
  ): Promise<AvailabilityExceptionDto> {
    return this.availabilityService.createException(user.id, dto);
  }

  @Put('me/exceptions/:id')
  @ApiOperation({ summary: 'Update one of my exceptions' })
  @ApiOkResponse({ type: AvailabilityExceptionDto })
  @ApiNotFoundResponse({ description: 'Exception not found' })
  updateException(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateAvailabilityExceptionDto,
  ): Promise<AvailabilityExceptionDto> {
    return this.availabilityService.updateException(user.id, id, dto);
  }

  @Delete('me/exceptions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove one of my exceptions' })
  @ApiNoContentResponse()
  async deleteException(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.availabilityService.deleteException(user.id, id);
  }

  @Get('staff/:staffId')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiOperation({
    summary: 'View any staff member\'s availability (admin or manager)',
  })
  @ApiOkResponse({ type: AvailabilityDto })
  getForStaff(
    @Param('staffId', new ParseUUIDPipe()) staffId: string,
  ): Promise<AvailabilityDto> {
    return this.availabilityService.getForStaff(staffId);
  }
}
