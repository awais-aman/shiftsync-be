import { Global, Module } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { LocationRepository } from '@/database/repositories/location.repository';
import { ShiftRepository } from '@/database/repositories/shift.repository';
import { SkillRepository } from '@/database/repositories/skill.repository';
import { TeamRepository } from '@/database/repositories/team.repository';
import { UserRepository } from '@/database/repositories/user.repository';

@Global()
@Module({
  providers: [
    PrismaService,
    UserRepository,
    LocationRepository,
    SkillRepository,
    TeamRepository,
    ShiftRepository,
  ],
  exports: [
    PrismaService,
    UserRepository,
    LocationRepository,
    SkillRepository,
    TeamRepository,
    ShiftRepository,
  ],
})
export class DatabaseModule {}
