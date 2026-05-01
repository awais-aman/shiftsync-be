import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class FairnessQueryDto {
  @ApiProperty({ format: 'date-time', required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiProperty({ format: 'date-time', required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class OvertimeProjectionQueryDto {
  @ApiProperty({
    format: 'date',
    required: false,
    description: 'Sunday-anchored start of the target week (YYYY-MM-DD); defaults to current week.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  weekStart?: Date;
}
