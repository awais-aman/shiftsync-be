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
import { OnDutyLocationDto } from '@/on-duty/dto/on-duty.dto';
import { OnDutyService } from '@/on-duty/on-duty.service';
import type { AuthenticatedUser } from '@/types/auth';

@ApiTags('On-Duty')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired JWT' })
@UseGuards(SupabaseJwtGuard)
@Controller('on-duty')
export class OnDutyController {
  constructor(private readonly onDutyService: OnDutyService) {}

  @Get()
  @ApiOperation({
    summary:
      'Currently active shifts grouped by location; scoped per role (admin = all, manager = managed, staff = certified)',
  })
  @ApiOkResponse({ type: OnDutyLocationDto, isArray: true })
  list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OnDutyLocationDto[]> {
    return this.onDutyService.listForActor(user.id);
  }
}
