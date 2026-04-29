import { ApiProperty } from '@nestjs/swagger';

export class LocationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'IANA timezone identifier' })
  timezone!: string;

  @ApiProperty({ required: false, nullable: true })
  address?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
