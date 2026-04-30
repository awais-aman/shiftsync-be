import { ApiProperty } from '@nestjs/swagger';
import { SwapStatus, SwapType } from '@prisma/client';

export class SwapRequestDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: SwapType })
  type!: SwapType;

  @ApiProperty({ enum: SwapStatus })
  status!: SwapStatus;

  @ApiProperty({ format: 'uuid' })
  requestingAssignmentId!: string;

  @ApiProperty({ format: 'uuid' })
  requesterId!: string;

  @ApiProperty({ required: false, nullable: true })
  requesterDisplayName?: string | null;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  targetStaffId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  targetStaffDisplayName?: string | null;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  targetAssignmentId?: string | null;

  @ApiProperty({ format: 'date-time', required: false, nullable: true })
  expiresAt?: string | null;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  decidedById?: string | null;

  @ApiProperty({ format: 'date-time', required: false, nullable: true })
  decidedAt?: string | null;

  @ApiProperty({ required: false, nullable: true })
  rejectionReason?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ format: 'uuid' })
  shiftId!: string;

  @ApiProperty({ format: 'date-time' })
  shiftStartAt!: string;

  @ApiProperty({ format: 'date-time' })
  shiftEndAt!: string;

  @ApiProperty({ required: false, nullable: true })
  shiftLocationName?: string | null;

  @ApiProperty({ required: false, nullable: true })
  shiftLocationTimezone?: string | null;
}
