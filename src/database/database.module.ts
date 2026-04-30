import { Global, Module } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { AssignmentRepository } from '@/database/repositories/assignment.repository';
import { AvailabilityRepository } from '@/database/repositories/availability.repository';
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
    AvailabilityRepository,
    AssignmentRepository,
  ],
  exports: [
    PrismaService,
    UserRepository,
    LocationRepository,
    SkillRepository,
    TeamRepository,
    ShiftRepository,
    AvailabilityRepository,
    AssignmentRepository,
  ],
})
export class DatabaseModule {}
