import { Global, Module } from '@nestjs/common';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { AuditController } from '@/audit/audit.controller';
import { AuditService } from '@/audit/audit.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, SupabaseJwtGuard, RolesGuard],
  exports: [AuditService],
})
export class AuditModule {}
