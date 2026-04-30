import { ApiProperty } from '@nestjs/swagger';

export class OvertimeOverrideDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  staffId!: string;

  @ApiProperty({ format: 'date', description: 'YYYY-MM-DD' })
  effectiveDate!: string;

  @ApiProperty()
  reason!: string;

  @ApiProperty({ format: 'uuid' })
  approvedById!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
