import { Global, Module } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { UserRepository } from '@/database/repositories/user.repository';

@Global()
@Module({
  providers: [PrismaService, UserRepository],
  exports: [PrismaService, UserRepository],
})
export class DatabaseModule {}
