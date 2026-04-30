import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetManagedLocationsDto {
  @ApiProperty({
    type: String,
    isArray: true,
    format: 'uuid',
    description: 'Replaces the manager\'s full set of managed locations',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  locationIds!: string[];
}
