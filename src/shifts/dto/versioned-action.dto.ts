import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class VersionedActionDto {
  @ApiProperty({ description: 'Optimistic-lock version of the shift' })
  @IsInt()
  @Min(0)
  version!: number;
}
