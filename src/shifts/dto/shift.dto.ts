import { ApiProperty } from '@nestjs/swagger';
import { ShiftStatus } from '@prisma/client';
import { LocationDto } from '@/locations/dto/location.dto';
import { SkillDto } from '@/skills/dto/skill.dto';

export class ShiftDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty({ format: 'date-time' })
  startAt!: string;

  @ApiProperty({ format: 'date-time' })
  endAt!: string;

  @ApiProperty({ format: 'uuid' })
  requiredSkillId!: string;

  @ApiProperty({ minimum: 1 })
  headcount!: number;

  @ApiProperty({ description: 'Fri/Sat 17:00–close in the location\'s timezone' })
  isPremium!: boolean;

  @ApiProperty({ enum: ShiftStatus })
  status!: ShiftStatus;

  @ApiProperty({ format: 'date-time', required: false, nullable: true })
  publishedAt?: string | null;

  @ApiProperty({ description: 'Optimistic-lock version, incremented per write' })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: LocationDto, required: false })
  location?: LocationDto;

  @ApiProperty({ type: SkillDto, required: false })
  requiredSkill?: SkillDto;
}
