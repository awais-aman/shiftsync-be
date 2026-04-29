import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { IsPublic, Provides } from '@/shared/constants';
import type { AuthenticatedUser } from '@/types/auth';

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseJwtGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Inject(Provides.SupabaseJwks) private readonly jwks: JWTVerifyGetKey,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IsPublic, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: `${supabaseUrl}/auth/v1`,
        audience: 'authenticated',
      });

      request.user = {
        id: payload.sub as string,
        email: payload.email as string | undefined,
        role: payload.role as string | undefined,
        appMetadata: payload.app_metadata as Record<string, unknown> | undefined,
        userMetadata: payload.user_metadata as
          | Record<string, unknown>
          | undefined,
      } satisfies AuthenticatedUser;

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';
      this.logger.warn(`JWT verification failed: ${message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: {
    headers: Record<string, string | string[] | undefined>;
  }): string | undefined {
    const header = request.headers.authorization;
    if (typeof header !== 'string') return undefined;
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;
    return token;
  }
}
