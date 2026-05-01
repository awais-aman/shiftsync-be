import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { NotificationDto } from '@/notifications/dto/notification.dto';
import { NotificationsService } from '@/notifications/notifications.service';
import { RoutePaths } from '@/shared/constants';
import type { AuthenticatedUser } from '@/types/auth';

class UnreadCountDto {
  count!: number;
}

class ChannelDto {
  channel!: string;
}

class SetChannelDto {
  @IsIn(['in_app', 'in_app_email'])
  channel!: 'in_app' | 'in_app_email';
}

@ApiTags('Notifications')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired JWT' })
@UseGuards(SupabaseJwtGuard)
@Controller(RoutePaths.Notifications)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List the current user\'s notifications' })
  @ApiOkResponse({ type: NotificationDto, isArray: true })
  list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationDto[]> {
    return this.notificationsService.listForUser(user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count unread notifications for the current user' })
  @ApiOkResponse({ type: UnreadCountDto })
  unreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UnreadCountDto> {
    return this.notificationsService.unreadCount(user.id);
  }

  @Get('channel')
  @ApiOperation({
    summary: 'Get the current user\'s notification channel preference',
  })
  @ApiOkResponse({ type: ChannelDto })
  getChannel(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChannelDto> {
    return this.notificationsService.getChannelFor(user.id);
  }

  @Put('channel')
  @ApiOperation({
    summary: 'Set notification channel: "in_app" or "in_app_email"',
  })
  @ApiOkResponse({ type: ChannelDto })
  setChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SetChannelDto,
  ): Promise<ChannelDto> {
    if (body.channel !== 'in_app' && body.channel !== 'in_app_email') {
      throw new BadRequestException('Invalid channel');
    }
    return this.notificationsService.setChannelFor(user.id, body.channel);
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark every unread notification as read' })
  @ApiOkResponse({ type: UnreadCountDto })
  markAllRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UnreadCountDto> {
    return this.notificationsService.markAllRead(user.id);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiOkResponse({ type: NotificationDto })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<NotificationDto> {
    return this.notificationsService.markRead(id, user.id);
  }
}
