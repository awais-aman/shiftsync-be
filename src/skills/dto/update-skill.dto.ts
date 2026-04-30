import { PartialType } from '@nestjs/swagger';
import { CreateSkillDto } from '@/skills/dto/create-skill.dto';

export class UpdateSkillDto extends PartialType(CreateSkillDto) {}
