import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { AuthController } from '@/auth/auth.controller';
import { AuthService } from '@/auth/auth.service';

@Module({
  imports: [DatabaseModule],
  providers: [AuthService, SupabaseJwtGuard],
  controllers: [AuthController],
  exports: [AuthService, SupabaseJwtGuard],
})
export class AuthModule {}
