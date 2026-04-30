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
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { CreateSkillDto } from '@/skills/dto/create-skill.dto';
import { SkillDto } from '@/skills/dto/skill.dto';
import { UpdateSkillDto } from '@/skills/dto/update-skill.dto';
import { SkillsService } from '@/skills/skills.service';
import { RoutePaths } from '@/shared/constants';

@ApiTags('Skills')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired JWT' })
@ApiForbiddenResponse({ description: 'Authenticated but lacks required role' })
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller(RoutePaths.Skills)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'List all skills' })
  @ApiOkResponse({ type: SkillDto, isArray: true })
  list(): Promise<SkillDto[]> {
    return this.skillsService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a skill by id' })
  @ApiOkResponse({ type: SkillDto })
  @ApiNotFoundResponse({ description: 'Skill not found' })
  findById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SkillDto> {
    return this.skillsService.findById(id);
  }

  @Post()
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Create a skill (admin only)' })
  @ApiCreatedResponse({ type: SkillDto })
  @ApiConflictResponse({ description: 'Skill name already exists' })
  create(@Body() dto: CreateSkillDto): Promise<SkillDto> {
    return this.skillsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Update a skill (admin only)' })
  @ApiOkResponse({ type: SkillDto })
  @ApiNotFoundResponse({ description: 'Skill not found' })
  @ApiConflictResponse({ description: 'Skill name already exists' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSkillDto,
  ): Promise<SkillDto> {
    return this.skillsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a skill (admin only)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Skill not found' })
  async delete(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.skillsService.delete(id);
  }
}
