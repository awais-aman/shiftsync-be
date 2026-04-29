import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CurrentUserDto {
  @ApiProperty({ format: 'uuid', description: 'Supabase auth user id' })
  id!: string;

  @ApiProperty({ required: false, format: 'email' })
  email?: string;

  @ApiProperty({ enum: UserRole, description: 'Application role' })
  role!: UserRole;

  @ApiProperty({ required: false })
  displayName?: string;

  @ApiProperty({ required: false })
  desiredHoursPerWeek?: number;

  @ApiProperty({
    required: false,
    description: 'Last sign-in timestamp from auth.users',
  })
  lastSignInAt?: string;

  @ApiProperty({
    required: false,
    description: 'Whether the email is confirmed',
  })
  emailConfirmed?: boolean;
}
