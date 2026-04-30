import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { SupabaseModule } from '@/supabase/supabase.module';
import { DatabaseModule } from '@/database/database.module';
import { AuthModule } from '@/auth/auth.module';
import { LocationsModule } from '@/locations/locations.module';
import { SkillsModule } from '@/skills/skills.module';
import { TeamModule } from '@/team/team.module';
import { ShiftsModule } from '@/shifts/shifts.module';
import { AvailabilityModule } from '@/availability/availability.module';
import { ConstraintsModule } from '@/constraints/constraints.module';
import { AssignmentsModule } from '@/assignments/assignments.module';
import { OvertimeModule } from '@/overtime/overtime.module';
import { SwapsModule } from '@/swaps/swaps.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    SupabaseModule,
    DatabaseModule,
    AuthModule,
    LocationsModule,
    SkillsModule,
    TeamModule,
    ShiftsModule,
    AvailabilityModule,
    ConstraintsModule,
    AssignmentsModule,
    OvertimeModule,
    SwapsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
