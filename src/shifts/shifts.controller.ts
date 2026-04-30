import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { RoutePaths } from '@/shared/constants';
import { CreateShiftDto } from '@/shifts/dto/create-shift.dto';
import { ListShiftsDto } from '@/shifts/dto/list-shifts.dto';
import { ShiftDto } from '@/shifts/dto/shift.dto';
import { UpdateShiftDto } from '@/shifts/dto/update-shift.dto';
import { VersionedActionDto } from '@/shifts/dto/versioned-action.dto';
import { ShiftsService } from '@/shifts/shifts.service';

@ApiTags('Shifts')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired JWT' })
@ApiForbiddenResponse({ description: 'Authenticated but lacks required role' })
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller(RoutePaths.Shifts)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @ApiOperation({
    summary: 'List shifts (any auth user); filter by locationId and date range',
  })
  @ApiOkResponse({ type: ShiftDto, isArray: true })
  list(@Query() query: ListShiftsDto): Promise<ShiftDto[]> {
    return this.shiftsService.list({
      locationId: query.locationId,
      from: query.from,
      to: query.to,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a shift by id' })
  @ApiOkResponse({ type: ShiftDto })
  @ApiNotFoundResponse({ description: 'Shift not found' })
  findById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ShiftDto> {
    return this.shiftsService.findById(id);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.manager)
  @ApiOperation({ summary: 'Create a draft shift (admin or manager)' })
  @ApiCreatedResponse({ type: ShiftDto })
  @ApiBadRequestResponse({
    description: 'Invalid times, location, or required skill',
  })
  create(@Body() dto: CreateShiftDto): Promise<ShiftDto> {
    return this.shiftsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiOperation({
    summary:
      'Update a shift (admin or manager); requires matching optimistic version',
  })
  @ApiOkResponse({ type: ShiftDto })
  @ApiNotFoundResponse({ description: 'Shift not found' })
  @ApiConflictResponse({ description: 'Version mismatch' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateShiftDto,
  ): Promise<ShiftDto> {
    return this.shiftsService.update(id, dto);
  }

  @Post(':id/publish')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiOperation({
    summary: 'Publish a draft shift (blocked within the publish cutoff window)',
  })
  @ApiOkResponse({ type: ShiftDto })
  @ApiNotFoundResponse({ description: 'Shift not found' })
  @ApiConflictResponse({ description: 'Version mismatch' })
  @ApiBadRequestResponse({
    description: 'Already published, or within publish cutoff',
  })
  publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: VersionedActionDto,
  ): Promise<ShiftDto> {
    return this.shiftsService.publish(id, body.version);
  }

  @Post(':id/unpublish')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiOperation({
    summary:
      'Revert a published shift to draft (blocked within the publish cutoff window)',
  })
  @ApiOkResponse({ type: ShiftDto })
  @ApiNotFoundResponse({ description: 'Shift not found' })
  @ApiConflictResponse({ description: 'Version mismatch' })
  @ApiBadRequestResponse({
    description: 'Not currently published, or within publish cutoff',
  })
  unpublish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: VersionedActionDto,
  ): Promise<ShiftDto> {
    return this.shiftsService.unpublish(id, body.version);
  }

  @Delete(':id')
  @Roles(UserRole.admin, UserRole.manager)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a shift (admin or manager)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Shift not found' })
  async delete(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.shiftsService.delete(id);
  }
}
