import { Module } from '@nestjs/common';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { LocationsController } from '@/locations/locations.controller';
import { LocationsService } from '@/locations/locations.service';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService, SupabaseJwtGuard, RolesGuard],
  exports: [LocationsService],
})
export class LocationsModule {}
