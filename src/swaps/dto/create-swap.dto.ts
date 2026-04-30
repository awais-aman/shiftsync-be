import { ApiProperty } from '@nestjs/swagger';
import { SwapType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateSwapRequestDto {
  @ApiProperty({ enum: SwapType })
  @IsEnum(SwapType)
  type!: SwapType;

  @ApiProperty({
    format: 'uuid',
    description: 'The requester\'s assignment they want to swap or drop',
  })
  @IsUUID()
  requestingAssignmentId!: string;

  @ApiProperty({
    format: 'uuid',
    required: false,
    description: 'Required for type=swap; the peer being asked to swap',
  })
  @IsOptional()
  @IsUUID()
  targetStaffId?: string;

  @ApiProperty({
    format: 'uuid',
    required: false,
    description:
      'Optional for swap; the peer\'s assignment that the requester wants in exchange',
  })
  @IsOptional()
  @IsUUID()
  targetAssignmentId?: string;
}
