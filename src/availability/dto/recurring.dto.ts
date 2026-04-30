import { ApiProperty } from '@nestjs/swagger';

export class RecurringAvailabilityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  staffId!: string;

  @ApiProperty({ minimum: 0, maximum: 6, description: '0=Sunday, 6=Saturday' })
  weekday!: number;

  @ApiProperty({ description: 'HH:MM in 24h format' })
  startTime!: string;

  @ApiProperty({ description: 'HH:MM in 24h format' })
  endTime!: string;

  @ApiProperty({ description: 'IANA timezone (staff\'s home tz)' })
  timezone!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
