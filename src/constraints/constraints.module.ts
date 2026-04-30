import { Global, Module } from '@nestjs/common';
import { ConstraintEngine } from '@/constraints/constraint-engine';

@Global()
@Module({
  providers: [ConstraintEngine],
  exports: [ConstraintEngine],
})
export class ConstraintsModule {}
