import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '@/database/repositories/user.repository';
import { CurrentUserDto } from '@/auth/dto/current-user.dto';
import type { AuthenticatedUser } from '@/types/auth';

@Injectable()
export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async getCurrentUser(user: AuthenticatedUser): Promise<CurrentUserDto> {
    const authUser = await this.userRepository.findAuthUserById(user.id);
    if (!authUser) {
      throw new NotFoundException(`User ${user.id} not found`);
    }

    return {
      id: authUser.id,
      email: authUser.email,
      role: user.role,
      lastSignInAt: authUser.last_sign_in_at ?? undefined,
      emailConfirmed: Boolean(authUser.email_confirmed_at),
    };
  }
}
