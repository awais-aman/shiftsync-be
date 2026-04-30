import { Module } from '@nestjs/common';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { AssignmentsController } from '@/assignments/assignments.controller';
import { AssignmentsService } from '@/assignments/assignments.service';

@Module({
  controllers: [AssignmentsController],
  providers: [AssignmentsService, SupabaseJwtGuard, RolesGuard],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
