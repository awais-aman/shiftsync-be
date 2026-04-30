import { Module } from '@nestjs/common';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { SkillsController } from '@/skills/skills.controller';
import { SkillsService } from '@/skills/skills.service';

@Module({
  controllers: [SkillsController],
  providers: [SkillsService, SupabaseJwtGuard, RolesGuard],
  exports: [SkillsService],
})
export class SkillsModule {}
