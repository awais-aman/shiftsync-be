import type { SwapStatus, SwapType } from '@prisma/client';

export type SwapRequest = {
  id: string;
  type: SwapType;
  status: SwapStatus;
  requestingAssignmentId: string;
  requesterId: string;
  requesterDisplayName?: string | null;
  targetStaffId?: string | null;
  targetStaffDisplayName?: string | null;
  targetAssignmentId?: string | null;
  expiresAt?: string | null;
  decidedById?: string | null;
  decidedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;

  // Denormalised shift info for the requester's assignment, useful for UI.
  shiftId: string;
  shiftStartAt: string;
  shiftEndAt: string;
  shiftLocationName?: string | null;
  shiftLocationTimezone?: string | null;
};
