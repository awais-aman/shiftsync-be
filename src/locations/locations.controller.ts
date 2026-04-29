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
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { CreateLocationDto } from '@/locations/dto/create-location.dto';
import { LocationDto } from '@/locations/dto/location.dto';
import { UpdateLocationDto } from '@/locations/dto/update-location.dto';
import { LocationsService } from '@/locations/locations.service';
import { RoutePaths } from '@/shared/constants';

@ApiTags('Locations')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired JWT' })
@ApiForbiddenResponse({ description: 'Authenticated but lacks required role' })
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller(RoutePaths.Locations)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all locations' })
  @ApiOkResponse({ type: LocationDto, isArray: true })
  list(): Promise<LocationDto[]> {
    return this.locationsService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a location by id' })
  @ApiOkResponse({ type: LocationDto })
  @ApiNotFoundResponse({ description: 'Location not found' })
  findById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<LocationDto> {
    return this.locationsService.findById(id);
  }

  @Post()
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Create a location (admin only)' })
  @ApiCreatedResponse({ type: LocationDto })
  create(@Body() dto: CreateLocationDto): Promise<LocationDto> {
    return this.locationsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Update a location (admin only)' })
  @ApiOkResponse({ type: LocationDto })
  @ApiNotFoundResponse({ description: 'Location not found' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationDto> {
    return this.locationsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a location (admin only)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Location not found' })
  async delete(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.locationsService.delete(id);
  }
}
