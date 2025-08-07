import { CreateBrandDto } from './create-brand.dto';
import { IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class UpdateBrandDto extends PartialType(CreateBrandDto) {
  @ApiProperty({
    description: 'Идентификатор бренда',
    example: 1,
    required: true,
  })
  @IsOptional()
  @IsNumber()
  id?: number;
}
