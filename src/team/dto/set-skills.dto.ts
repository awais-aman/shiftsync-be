import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetSkillsDto {
  @ApiProperty({
    type: String,
    isArray: true,
    format: 'uuid',
    description: 'Replaces the staff member\'s full skill list',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  skillIds!: string[];
}
