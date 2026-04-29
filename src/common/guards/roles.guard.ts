import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { UserRepository } from '@/database/repositories/user.repository';
import type { AuthenticatedUser } from '@/types/auth';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const userId = request.user?.id;
    if (!userId) {
      throw new ForbiddenException('Not authenticated');
    }

    const profile = await this.userRepository.findProfileById(userId);
    if (!profile) {
      throw new ForbiddenException('Profile not found');
    }

    if (!requiredRoles.includes(profile.role)) {
      throw new ForbiddenException(
        `Requires role: ${requiredRoles.join(' or ')}`,
      );
    }

    request.user!.role = profile.role;
    return true;
  }
}
