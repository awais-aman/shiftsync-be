import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SupabaseClient,
  type User as SupabaseAuthUser,
} from '@supabase/supabase-js';
import type { User as UserProfile } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { Provides } from '@/shared/constants';

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(
    @Inject(Provides.Supabase) private readonly supabase: SupabaseClient,
    private readonly prisma: PrismaService,
  ) {}

  async findAuthUserById(userId: string): Promise<SupabaseAuthUser | null> {
    const { data, error } = await this.supabase.auth.admin.getUserById(userId);

    if (error) {
      this.logger.error(
        `Failed to fetch auth user ${userId}: ${error.message}`,
      );
      return null;
    }

    return data.user;
  }

  findProfileById(userId: string): Promise<UserProfile | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }
}
