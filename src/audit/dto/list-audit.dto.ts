import { ApiProperty } from '@nestjs/swagger';
import { AuditAction, AuditEntityType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ListAuditDto {
  @ApiProperty({ enum: AuditEntityType, required: false })
  @IsOptional()
  @IsEnum(AuditEntityType)
  entityType?: AuditEntityType;

  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiProperty({ enum: AuditAction, required: false })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiProperty({ format: 'date-time', required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiProperty({ format: 'date-time', required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
