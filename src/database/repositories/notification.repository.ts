import { Injectable } from '@nestjs/common';
import type { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string, limit = 50): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  countUnreadForUser(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  findById(id: string): Promise<Notification | null> {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  create(data: Prisma.NotificationUncheckedCreateInput): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  createMany(rows: Prisma.NotificationUncheckedCreateInput[]): Promise<number> {
    if (rows.length === 0) return Promise.resolve(0);
    return this.prisma.notification
      .createMany({ data: rows })
      .then((r) => r.count);
  }

  markRead(id: string): Promise<Notification> {
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  markAllRead(userId: string): Promise<number> {
    return this.prisma.notification
      .updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      })
      .then((r) => r.count);
  }
}
