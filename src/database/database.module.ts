import { Global, Module } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { AssignmentRepository } from '@/database/repositories/assignment.repository';
import { AvailabilityRepository } from '@/database/repositories/availability.repository';
import { LocationRepository } from '@/database/repositories/location.repository';
import { NotificationRepository } from '@/database/repositories/notification.repository';
import { OvertimeOverrideRepository } from '@/database/repositories/overtime-override.repository';
import { ShiftRepository } from '@/database/repositories/shift.repository';
import { SkillRepository } from '@/database/repositories/skill.repository';
import { SwapRepository } from '@/database/repositories/swap.repository';
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
    OvertimeOverrideRepository,
    SwapRepository,
    NotificationRepository,
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
    OvertimeOverrideRepository,
    SwapRepository,
    NotificationRepository,
  ],
})
export class DatabaseModule {}
