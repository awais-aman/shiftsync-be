import { ApiProperty } from '@nestjs/swagger';

export class OvertimeProjectionRowDto {
  @ApiProperty({ format: 'uuid' })
  staffId!: string;

  @ApiProperty({ required: false, nullable: true })
  displayName?: string | null;

  @ApiProperty()
  weeklyHours!: number;

  @ApiProperty({ enum: ['ok', 'warn', 'block'] })
  warningLevel!: 'ok' | 'warn' | 'block';
}

export class OvertimeProjectionDto {
  @ApiProperty({ format: 'date' })
  weekStart!: string;

  @ApiProperty({ format: 'date' })
  weekEnd!: string;

  @ApiProperty({ type: OvertimeProjectionRowDto, isArray: true })
  rows!: OvertimeProjectionRowDto[];
}
