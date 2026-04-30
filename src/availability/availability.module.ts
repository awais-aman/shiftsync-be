import { Module } from '@nestjs/common';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { AvailabilityController } from '@/availability/availability.controller';
import { AvailabilityService } from '@/availability/availability.service';

@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService, SupabaseJwtGuard, RolesGuard],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
