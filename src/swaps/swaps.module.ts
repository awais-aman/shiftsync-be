import { Module } from '@nestjs/common';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { SwapsController } from '@/swaps/swaps.controller';
import { SwapsService } from '@/swaps/swaps.service';

@Module({
  controllers: [SwapsController],
  providers: [SwapsService, SupabaseJwtGuard, RolesGuard],
  exports: [SwapsService],
})
export class SwapsModule {}
