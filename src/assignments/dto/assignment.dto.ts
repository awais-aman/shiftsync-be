import { ApiProperty } from '@nestjs/swagger';

export class AssignmentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  shiftId!: string;

  @ApiProperty({ format: 'uuid' })
  staffId!: string;

  @ApiProperty({ required: false, nullable: true })
  staffDisplayName?: string | null;

  @ApiProperty({ required: false })
  staffEmail?: string;

  @ApiProperty({ format: 'uuid' })
  assignedById!: string;

  @ApiProperty({ format: 'date-time' })
  assignedAt!: string;
}
