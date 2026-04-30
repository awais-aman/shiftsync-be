import { Module } from '@nestjs/common';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { ShiftsController } from '@/shifts/shifts.controller';
import { ShiftsService } from '@/shifts/shifts.service';

@Module({
  controllers: [ShiftsController],
  providers: [ShiftsService, SupabaseJwtGuard, RolesGuard],
  exports: [ShiftsService],
})
export class ShiftsModule {}
