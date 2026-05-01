import { Module } from '@nestjs/common';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { OnDutyController } from '@/on-duty/on-duty.controller';
import { OnDutyService } from '@/on-duty/on-duty.service';

@Module({
  controllers: [OnDutyController],
  providers: [OnDutyService, SupabaseJwtGuard],
  exports: [OnDutyService],
})
export class OnDutyModule {}
