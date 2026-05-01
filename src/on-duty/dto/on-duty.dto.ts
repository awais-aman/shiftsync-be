import { ApiProperty } from '@nestjs/swagger';

export class OnDutyAssignedStaffDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ required: false, nullable: true })
  displayName?: string | null;

  @ApiProperty({ required: false })
  email?: string;
}

export class OnDutyShiftDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  startAt!: string;

  @ApiProperty({ format: 'date-time' })
  endAt!: string;

  @ApiProperty()
  requiredSkillName!: string;

  @ApiProperty()
  headcount!: number;

  @ApiProperty({ type: OnDutyAssignedStaffDto, isArray: true })
  assignedStaff!: OnDutyAssignedStaffDto[];
}

export class OnDutyLocationDto {
  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  locationName!: string;

  @ApiProperty()
  locationTimezone!: string;

  @ApiProperty({ type: OnDutyShiftDto, isArray: true })
  shifts!: OnDutyShiftDto[];
}
