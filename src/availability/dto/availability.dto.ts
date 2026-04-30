import { ApiProperty } from '@nestjs/swagger';
import { AvailabilityExceptionDto } from '@/availability/dto/exception.dto';
import { RecurringAvailabilityDto } from '@/availability/dto/recurring.dto';

export class AvailabilityDto {
  @ApiProperty({ type: RecurringAvailabilityDto, isArray: true })
  recurring!: RecurringAvailabilityDto[];

  @ApiProperty({ type: AvailabilityExceptionDto, isArray: true })
  exceptions!: AvailabilityExceptionDto[];
}
