import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetCertificationsDto {
  @ApiProperty({
    type: String,
    isArray: true,
    format: 'uuid',
    description: 'Replaces the staff member\'s full certification list',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  locationIds!: string[];
}
