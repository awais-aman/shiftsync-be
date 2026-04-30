import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class NotificationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty()
  title!: string;

  @ApiProperty({ required: false, nullable: true })
  body?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Arbitrary event payload (e.g. shiftId, swapId)',
  })
  payload?: Record<string, unknown> | null;

  @ApiProperty()
  emailSimulated!: boolean;

  @ApiProperty({ format: 'date-time', required: false, nullable: true })
  readAt?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
