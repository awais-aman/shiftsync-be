import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  staffId!: string;
}
