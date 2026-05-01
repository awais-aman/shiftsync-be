import { ApiProperty } from '@nestjs/swagger';

export class StaffFairnessRowDto {
  @ApiProperty({ format: 'uuid' })
  staffId!: string;

  @ApiProperty({ required: false, nullable: true })
  displayName?: string | null;

  @ApiProperty()
  totalHours!: number;

  @ApiProperty()
  premiumShifts!: number;

  @ApiProperty({ required: false, nullable: true })
  desiredHoursPerWeek?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'totalHours minus desiredHoursPerWeek (over/under). Null when no desired hours set.',
  })
  varianceVsDesired!: number | null;
}

export class FairnessReportDto {
  @ApiProperty({ format: 'date-time' })
  from!: string;

  @ApiProperty({ format: 'date-time' })
  to!: string;

  @ApiProperty({ type: StaffFairnessRowDto, isArray: true })
  rows!: StaffFairnessRowDto[];

  @ApiProperty({ description: 'Average number of premium shifts per staff in the window' })
  premiumShiftsAverage!: number;
}
