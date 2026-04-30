import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsUUID, Min } from 'class-validator';

export class CreateShiftDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ format: 'date-time', description: 'ISO 8601 UTC timestamp' })
  @Type(() => Date)
  @IsDate()
  startAt!: Date;

  @ApiProperty({ format: 'date-time', description: 'Must be after startAt' })
  @Type(() => Date)
  @IsDate()
  endAt!: Date;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  requiredSkillId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  headcount!: number;
}
