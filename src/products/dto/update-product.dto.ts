import { CreateProductDto } from './create-product.dto';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiProperty({
    description: 'Id of product',
    example: '1',
    required: true,
  })
  @IsNumber()
  @IsOptional()
  id: number;

  @ApiProperty({
    description: 'Id of promotion(Not available to change)',
    example: 'x-pharm(Not available to change)',
    required: true,
  })
  @IsString()
  @IsOptional()
  promotionId: string;
}
