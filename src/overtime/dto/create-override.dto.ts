import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateOvertimeOverrideDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  staffId!: string;

  @ApiProperty({ format: 'date', example: '2026-05-15' })
  @Type(() => Date)
  @IsDate()
  effectiveDate!: Date;

  @ApiProperty({ minLength: 5, maxLength: 500 })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
