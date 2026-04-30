import { Module } from '@nestjs/common';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { TeamController } from '@/team/team.controller';
import { TeamService } from '@/team/team.service';

@Module({
  controllers: [TeamController],
  providers: [TeamService, SupabaseJwtGuard, RolesGuard],
  exports: [TeamService],
})
export class TeamModule {}
