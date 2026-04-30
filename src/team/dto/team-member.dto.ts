import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { LocationDto } from '@/locations/dto/location.dto';
import { SkillDto } from '@/skills/dto/skill.dto';

export class TeamMemberDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ required: false })
  displayName?: string;

  @ApiProperty({ required: false })
  desiredHoursPerWeek?: number;

  @ApiProperty({ type: LocationDto, isArray: true })
  certifications!: LocationDto[];

  @ApiProperty({ type: SkillDto, isArray: true })
  skills!: SkillDto[];

  @ApiProperty({ type: LocationDto, isArray: true })
  managedLocations!: LocationDto[];
}
