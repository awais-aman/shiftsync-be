import { ApiProperty } from '@nestjs/swagger';

export class AvailabilityExceptionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  staffId!: string;

  @ApiProperty({ format: 'date', description: 'YYYY-MM-DD' })
  date!: string;

  @ApiProperty({
    description:
      'true = extra availability on this date; false = blackout for this date',
  })
  isAvailable!: boolean;

  @ApiProperty({
    description:
      'HH:MM. Null with start/end means whole day. Required as a pair.',
    required: false,
    nullable: true,
  })
  startTime?: string | null;

  @ApiProperty({ required: false, nullable: true })
  endTime?: string | null;

  @ApiProperty({ description: 'IANA timezone' })
  timezone!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
