import { Module } from '@nestjs/common';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { AnalyticsController } from '@/analytics/analytics.controller';
import { AnalyticsService } from '@/analytics/analytics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, SupabaseJwtGuard, RolesGuard],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
