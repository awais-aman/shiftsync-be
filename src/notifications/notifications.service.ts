import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Notification, NotificationType } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { NotificationRepository } from '@/database/repositories/notification.repository';
import { NotificationDto } from '@/notifications/dto/notification.dto';

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
  /** Whether to also "send" a simulated email (logged to console for now). */
  email?: boolean;
};

export type NotifyTemplate = Omit<NotifyInput, 'userId'>;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** Notify every manager who manages the given location. */
  async notifyManagersOfLocation(
    locationId: string,
    template: NotifyTemplate,
  ): Promise<void> {
    const rows = await this.prisma.managerLocation.findMany({
      where: { locationId },
      select: { managerId: true },
    });
    if (rows.length === 0) return;
    await this.notifyMany(
      rows.map((r) => ({ ...template, userId: r.managerId })),
    );
  }

  /** Notify every manager who manages at least one location the staff is certified at. */
  async notifyManagersOfStaff(
    staffId: string,
    template: NotifyTemplate,
  ): Promise<void> {
    const rows = await this.prisma.managerLocation.findMany({
      where: {
        location: {
          certifiedStaff: { some: { staffId } },
        },
      },
      distinct: ['managerId'],
      select: { managerId: true },
    });
    if (rows.length === 0) return;
    await this.notifyMany(
      rows.map((r) => ({ ...template, userId: r.managerId })),
    );
  }

  async notify(input: NotifyInput): Promise<void> {
    try {
      const wantsEmail =
        input.email === true && (await this.userWantsEmail(input.userId));
      await this.notificationRepository.create({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload as never,
        emailSimulated: wantsEmail,
      });
      if (wantsEmail) {
        this.logger.log(
          `[email-sim] to=${input.userId} type=${input.type} title="${input.title}"`,
        );
      }
    } catch (error) {
      // Notifications must never break the parent operation. Log and move on.
      this.logger.error(
        `Failed to write notification for user ${input.userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async notifyMany(inputs: NotifyInput[]): Promise<void> {
    if (inputs.length === 0) return;
    try {
      const ids = Array.from(new Set(inputs.map((i) => i.userId)));
      const emailEnabled = await this.userEmailMap(ids);
      await this.notificationRepository.createMany(
        inputs.map((i) => ({
          userId: i.userId,
          type: i.type,
          title: i.title,
          body: i.body,
          payload: i.payload as never,
          emailSimulated: i.email === true && emailEnabled.get(i.userId) === true,
        })),
      );
      for (const i of inputs) {
        if (i.email === true && emailEnabled.get(i.userId)) {
          this.logger.log(
            `[email-sim] to=${i.userId} type=${i.type} title="${i.title}"`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to write batch notifications: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async userWantsEmail(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationChannel: true },
    });
    return user?.notificationChannel === 'in_app_email';
  }

  private async userEmailMap(
    userIds: string[],
  ): Promise<Map<string, boolean>> {
    const map = new Map<string, boolean>();
    if (userIds.length === 0) return map;
    const rows = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, notificationChannel: true },
    });
    for (const row of rows) {
      map.set(row.id, row.notificationChannel === 'in_app_email');
    }
    return map;
  }

  async getChannelFor(userId: string): Promise<{ channel: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationChannel: true },
    });
    return { channel: user?.notificationChannel ?? 'in_app_email' };
  }

  async setChannelFor(
    userId: string,
    channel: 'in_app' | 'in_app_email',
  ): Promise<{ channel: string }> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { notificationChannel: channel },
      select: { notificationChannel: true },
    });
    return { channel: updated.notificationChannel };
  }

  async listForUser(userId: string): Promise<NotificationDto[]> {
    const rows = await this.notificationRepository.listForUser(userId);
    return rows.map((row) => this.toDto(row));
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationRepository.countUnreadForUser(userId);
    return { count };
  }

  async markRead(id: string, userId: string): Promise<NotificationDto> {
    const existing = await this.notificationRepository.findById(id);
    if (!existing) throw new NotFoundException(`Notification ${id} not found`);
    if (existing.userId !== userId) {
      throw new ForbiddenException(
        'Cannot mark another user\'s notification as read',
      );
    }
    const updated = await this.notificationRepository.markRead(id);
    return this.toDto(updated);
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const count = await this.notificationRepository.markAllRead(userId);
    return { count };
  }

  private toDto(row: Notification): NotificationDto {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      body: row.body,
      payload: row.payload as Record<string, unknown> | null,
      emailSimulated: row.emailSimulated,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
