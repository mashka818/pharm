import { CreateProductDto } from './create-product.dto';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiProperty({
    description: 'Идентификатор продукта',
    example: 1,
    required: true,
  })
  @IsNumber()
  @IsOptional()
  id: number;

  @ApiProperty({
    description: 'Идентификатор промоакции (нельзя изменить)',
    example: 'x-pharm',
    required: true,
  })
  @IsString()
  @IsOptional()
  promotionId: string;
}
