import { Global, Module } from '@nestjs/common';
import { LocationScopeService } from '@/common/scope/location-scope.service';

@Global()
@Module({
  providers: [LocationScopeService],
  exports: [LocationScopeService],
})
export class ScopeModule {}
