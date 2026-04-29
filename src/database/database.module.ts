import { Global, Module } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { LocationRepository } from '@/database/repositories/location.repository';
import { UserRepository } from '@/database/repositories/user.repository';

@Global()
@Module({
  providers: [PrismaService, UserRepository, LocationRepository],
  exports: [PrismaService, UserRepository, LocationRepository],
})
export class DatabaseModule {}
