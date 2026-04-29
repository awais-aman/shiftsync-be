import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createRemoteJWKSet } from 'jose';
import { Provides } from '@/shared/constants';

export const SupabaseClientProvider: Provider = {
  provide: Provides.Supabase,
  useFactory: (configService: ConfigService): SupabaseClient => {
    const url = configService.get<string>('SUPABASE_URL');
    const secret = configService.get<string>('SUPABASE_SECRET_KEY');

    if (!url || !secret) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SECRET_KEY must be set for the admin client',
      );
    }

    return createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  },
  inject: [ConfigService],
};

export const SupabaseJwksProvider: Provider = {
  provide: Provides.SupabaseJwks,
  useFactory: (configService: ConfigService) => {
    const url = configService.get<string>('SUPABASE_URL');
    if (!url) throw new Error('SUPABASE_URL must be set for JWT verification');
    return createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  },
  inject: [ConfigService],
};
