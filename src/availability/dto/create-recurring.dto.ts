import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const HHMM = /^[0-2]\d:[0-5]\d$/;

export class CreateRecurringAvailabilityDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0=Sunday' })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(HHMM, { message: 'startTime must be HH:MM' })
  startTime!: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @Matches(HHMM, { message: 'endTime must be HH:MM' })
  endTime!: string;

  @ApiProperty({ description: 'IANA timezone identifier' })
  @IsString()
  timezone!: string;
}

export class UpdateRecurringAvailabilityDto extends CreateRecurringAvailabilityDto {}
