import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
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
import { SetCertificationsDto } from '@/team/dto/set-certifications.dto';
import { SetManagedLocationsDto } from '@/team/dto/set-managed-locations.dto';
import { SetSkillsDto } from '@/team/dto/set-skills.dto';
import { TeamMemberDto } from '@/team/dto/team-member.dto';
import { TeamService } from '@/team/team.service';

@ApiTags('Team')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired JWT' })
@ApiForbiddenResponse({ description: 'Authenticated but lacks required role' })
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller(RoutePaths.Team)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @ApiOperation({ summary: 'List all team members with their joins (admin)' })
  @ApiOkResponse({ type: TeamMemberDto, isArray: true })
  list(): Promise<TeamMemberDto[]> {
    return this.teamService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a team member by id (admin)' })
  @ApiOkResponse({ type: TeamMemberDto })
  @ApiNotFoundResponse({ description: 'Team member not found' })
  findById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TeamMemberDto> {
    return this.teamService.findById(id);
  }

  @Put(':id/certifications')
  @ApiOperation({
    summary: 'Replace a staff member\'s location certifications (admin)',
  })
  @ApiOkResponse({ type: TeamMemberDto })
  @ApiNotFoundResponse({ description: 'Team member not found' })
  @ApiBadRequestResponse({
    description: 'Member is not staff, or one of the locationIds is invalid',
  })
  setCertifications(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetCertificationsDto,
  ): Promise<TeamMemberDto> {
    return this.teamService.setCertifications(id, dto.locationIds);
  }

  @Put(':id/skills')
  @ApiOperation({
    summary: 'Replace a staff member\'s skill list (admin)',
  })
  @ApiOkResponse({ type: TeamMemberDto })
  @ApiNotFoundResponse({ description: 'Team member not found' })
  @ApiBadRequestResponse({
    description: 'Member is not staff, or one of the skillIds is invalid',
  })
  setSkills(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetSkillsDto,
  ): Promise<TeamMemberDto> {
    return this.teamService.setSkills(id, dto.skillIds);
  }

  @Put(':id/managed-locations')
  @ApiOperation({
    summary: 'Replace the locations a manager runs (admin)',
  })
  @ApiOkResponse({ type: TeamMemberDto })
  @ApiNotFoundResponse({ description: 'Team member not found' })
  @ApiBadRequestResponse({
    description:
      'Member is not a manager, or one of the locationIds is invalid',
  })
  setManagedLocations(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetManagedLocationsDto,
  ): Promise<TeamMemberDto> {
    return this.teamService.setManagedLocations(id, dto.locationIds);
  }
}
