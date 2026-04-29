import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '@/database/repositories/user.repository';
import { CurrentUserDto } from '@/auth/dto/current-user.dto';
import type { AuthenticatedUser } from '@/types/auth';

@Injectable()
export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async getCurrentUser(user: AuthenticatedUser): Promise<CurrentUserDto> {
    const [authUser, profile] = await Promise.all([
      this.userRepository.findAuthUserById(user.id),
      this.userRepository.findProfileById(user.id),
    ]);

    if (!authUser || !profile) {
      throw new NotFoundException(`User ${user.id} not found`);
    }

    return {
      id: profile.id,
      email: authUser.email,
      role: profile.role,
      displayName: profile.displayName ?? undefined,
      desiredHoursPerWeek: profile.desiredHoursPerWeek ?? undefined,
      lastSignInAt: authUser.last_sign_in_at ?? undefined,
      emailConfirmed: Boolean(authUser.email_confirmed_at),
    };
  }
}
