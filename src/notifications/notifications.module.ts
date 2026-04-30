import { Global, Module } from '@nestjs/common';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { NotificationsController } from '@/notifications/notifications.controller';
import { NotificationsService } from '@/notifications/notifications.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, SupabaseJwtGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
