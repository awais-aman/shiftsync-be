import type { NotificationType } from '@prisma/client';

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  emailSimulated: boolean;
  readAt?: string | null;
  createdAt: string;
};
