import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { PromotionDto } from 'src/promotions/dto/promotion.dto';

export class CreateBrandDto {
  @ApiProperty({
    description: 'Название бренда',
    example: 'Нурофен',
    required: true,
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Описание бренда',
    example: 'Лекарство от головной боли',
    required: true,
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Идентификатор промоакции (компании)',
    example: 'x-pharm',
    required: true,
  })
  @IsString()
  promotionId: PromotionDto['promotionId'];

  @ApiProperty({
    description: 'Файл с изображением для создания/обновления или имя файла (необязательно)',
    example: 'logo.png',
    required: false,
  })
  logo?: string;
}
