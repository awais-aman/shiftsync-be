import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { Provides } from '@/shared/constants';

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(
    @Inject(Provides.Supabase) private readonly supabase: SupabaseClient,
  ) {}

  async findAuthUserById(userId: string): Promise<User | null> {
    const { data, error } = await this.supabase.auth.admin.getUserById(userId);

    if (error) {
      this.logger.error(
        `Failed to fetch auth user ${userId}: ${error.message}`,
      );
      return null;
    }

    return data.user;
  }
}
