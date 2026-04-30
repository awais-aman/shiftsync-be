import { ApiProperty } from '@nestjs/swagger';

export class ConstraintViolationDto {
  @ApiProperty()
  rule!: string;

  @ApiProperty({ enum: ['block', 'warn'] })
  severity!: 'block' | 'warn';

  @ApiProperty()
  message!: string;
}

export class DryRunResultDto {
  @ApiProperty({ description: 'true when there are zero blocking violations' })
  allowed!: boolean;

  @ApiProperty({ type: ConstraintViolationDto, isArray: true })
  blocking!: ConstraintViolationDto[];

  @ApiProperty({ type: ConstraintViolationDto, isArray: true })
  warnings!: ConstraintViolationDto[];
}
