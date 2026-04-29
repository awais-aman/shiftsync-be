import { PartialType } from '@nestjs/swagger';
import { CreateLocationDto } from '@/locations/dto/create-location.dto';

export class UpdateLocationDto extends PartialType(CreateLocationDto) {}
