import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

export class ListShiftsDto {
  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiProperty({
    format: 'date-time',
    required: false,
    description: 'Filter shifts starting at or after this instant',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiProperty({
    format: 'date-time',
    required: false,
    description: 'Filter shifts starting before this instant',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
