import { ApiProperty } from '@nestjs/swagger';
import { AuditAction, AuditEntityType } from '@prisma/client';

export class AuditEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  actorId?: string | null;

  @ApiProperty({ enum: AuditEntityType })
  entityType!: AuditEntityType;

  @ApiProperty({ format: 'uuid' })
  entityId!: string;

  @ApiProperty({ enum: AuditAction })
  action!: AuditAction;

  @ApiProperty({ required: false, nullable: true })
  before?: unknown;

  @ApiProperty({ required: false, nullable: true })
  after?: unknown;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  locationId?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
