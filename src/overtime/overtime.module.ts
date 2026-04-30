import { Module } from '@nestjs/common';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { OvertimeController } from '@/overtime/overtime.controller';
import { OvertimeService } from '@/overtime/overtime.service';

@Module({
  controllers: [OvertimeController],
  providers: [OvertimeService, SupabaseJwtGuard, RolesGuard],
  exports: [OvertimeService],
})
export class OvertimeModule {}
