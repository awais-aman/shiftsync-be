import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateShiftDto {
  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiProperty({ format: 'date-time', required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startAt?: Date;

  @ApiProperty({ format: 'date-time', required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endAt?: Date;

  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  requiredSkillId?: string;

  @ApiProperty({ minimum: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  headcount?: number;

  @ApiProperty({
    description:
      'Optimistic-lock version of the row being updated. Mismatch returns 409.',
  })
  @IsInt()
  @Min(0)
  version!: number;
}
