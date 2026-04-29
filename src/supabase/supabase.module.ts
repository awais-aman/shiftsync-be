import { Global, Module } from '@nestjs/common';
import {
  SupabaseClientProvider,
  SupabaseJwksProvider,
} from '@/common/providers/supabase.provider';

@Global()
@Module({
  providers: [SupabaseClientProvider, SupabaseJwksProvider],
  exports: [SupabaseClientProvider, SupabaseJwksProvider],
})
export class SupabaseModule {}
