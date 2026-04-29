import { ApiProperty } from '@nestjs/swagger';

export class CurrentUserDto {
  @ApiProperty({ format: 'uuid', description: 'Supabase auth user id' })
  id!: string;

  @ApiProperty({ required: false, format: 'email' })
  email?: string;

  @ApiProperty({ required: false, description: "Supabase role claim, e.g. 'authenticated'" })
  role?: string;

  @ApiProperty({ required: false, description: 'Last sign-in timestamp from auth.users' })
  lastSignInAt?: string;

  @ApiProperty({ required: false, description: 'Whether the email is confirmed' })
  emailConfirmed?: boolean;
}
