import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { PromotionDto } from 'src/promotions/dto/promotion.dto';

export class CreateBrandDto {
  @ApiProperty({
    description: 'Name of Brand',
    example: 'Нурофен',
    required: true,
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Description of Brand',
    example: 'Лекарство от головной боли',
    required: true,
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'PromotionId of Promotion(Pharm company)',
    example: 'x-pharm',
    required: true,
  })
  @IsString()
  promotionId: PromotionDto['promotionId'];

  @ApiProperty({
    description: 'File with Image TO UPDATE/CREATE IMAGE or FileName(Unnecessary)',
    example: 'File with Image TO UPDATE/CREATE IMAGE or FileName',
    required: false,
  })
  logo?: string;
}
