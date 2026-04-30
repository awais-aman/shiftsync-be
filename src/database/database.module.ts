import { Global, Module } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { LocationRepository } from '@/database/repositories/location.repository';
import { SkillRepository } from '@/database/repositories/skill.repository';
import { UserRepository } from '@/database/repositories/user.repository';

@Global()
@Module({
  providers: [PrismaService, UserRepository, LocationRepository, SkillRepository],
  exports: [PrismaService, UserRepository, LocationRepository, SkillRepository],
})
export class DatabaseModule {}
