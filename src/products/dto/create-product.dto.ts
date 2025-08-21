import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    description: 'Название продукта',
    example: 'Терафлю в пак. 6 шт.',
    required: true,
  })
  @IsString()
  name: string;
  @ApiProperty({
    description: 'SKU продукта',
    example: '21nSq1n',
    required: true,
  })
  @IsString()
  sku: string;



  @ApiProperty({
    description: 'Идентификатор бренда продукта (нельзя изменить)',
    example: 1,
    required: true,
  })
  @IsNumber()
  brandId: number;
}
