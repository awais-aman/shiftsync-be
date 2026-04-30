import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

const HHMM = /^[0-2]\d:[0-5]\d$/;

export class CreateAvailabilityExceptionDto {
  @ApiProperty({ format: 'date', example: '2026-05-15' })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiProperty()
  @IsBoolean()
  isAvailable!: boolean;

  @ApiProperty({ required: false, example: '14:00' })
  @IsOptional()
  @IsString()
  @Matches(HHMM, { message: 'startTime must be HH:MM' })
  startTime?: string;

  @ApiProperty({ required: false, example: '17:00' })
  @IsOptional()
  @IsString()
  @Matches(HHMM, { message: 'endTime must be HH:MM' })
  endTime?: string;

  @ApiProperty()
  @IsString()
  timezone!: string;
}

export class UpdateAvailabilityExceptionDto extends CreateAvailabilityExceptionDto {}
