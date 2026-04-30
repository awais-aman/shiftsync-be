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
import type { AuthenticatedUser } from '@/types/auth';
import { AssignmentsService } from '@/assignments/assignments.service';
import { AssignmentDto } from '@/assignments/dto/assignment.dto';
import { CreateAssignmentDto } from '@/assignments/dto/create-assignment.dto';

@ApiTags('Assignments')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired JWT' })
@ApiForbiddenResponse({ description: 'Authenticated but lacks required role' })
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller('shifts/:shiftId/assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List assignments for a shift' })
  @ApiOkResponse({ type: AssignmentDto, isArray: true })
  list(
    @Param('shiftId', new ParseUUIDPipe()) shiftId: string,
  ): Promise<AssignmentDto[]> {
    return this.assignmentsService.listForShift(shiftId);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.manager)
  @ApiOperation({
    summary:
      'Assign a staff member to a shift; runs the constraint engine before write',
  })
  @ApiCreatedResponse({ type: AssignmentDto })
  @ApiBadRequestResponse({
    description:
      'Constraint violation (not certified, missing skill, unavailable, double-booking, min-rest)',
  })
  @ApiConflictResponse({
    description: 'Already assigned, or DB rejected as overlapping',
  })
  create(
    @Param('shiftId', new ParseUUIDPipe()) shiftId: string,
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssignmentDto> {
    return this.assignmentsService.create(shiftId, dto.staffId, user.id);
  }

  @Delete(':staffId')
  @Roles(UserRole.admin, UserRole.manager)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unassign a staff member from a shift' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Assignment not found' })
  async delete(
    @Param('shiftId', new ParseUUIDPipe()) shiftId: string,
    @Param('staffId', new ParseUUIDPipe()) staffId: string,
  ): Promise<void> {
    await this.assignmentsService.delete(shiftId, staffId);
  }
}
