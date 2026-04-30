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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
