import { Module } from '@nestjs/common';
import { UserRepository } from '@/database/repositories/user.repository';

@Module({
  providers: [UserRepository],
  exports: [UserRepository],
})
export class DatabaseModule {}
