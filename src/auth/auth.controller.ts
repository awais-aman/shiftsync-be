import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { RoutePaths } from '@/shared/constants';
import type { AuthenticatedUser } from '@/types/auth';
import { AuthService } from '@/auth/auth.service';
import { CurrentUserDto } from '@/auth/dto/current-user.dto';

@ApiTags('Auth')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard)
@Controller(RoutePaths.Me)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @ApiOperation({ summary: 'Return the authenticated user' })
  @ApiOkResponse({ type: CurrentUserDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired JWT' })
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserDto> {
    return this.authService.getCurrentUser(user);
  }
}
