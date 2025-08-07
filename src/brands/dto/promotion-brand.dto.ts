import { ApiProperty } from '@nestjs/swagger';
import { UpdateBrandDto } from './update-brand.dto';

class Range {
  @ApiProperty({
    description: 'Минимальное значение фиксированного кешбэка',
    example: 1,
  })
  min: number;
  @ApiProperty({
    description: 'Максимальное значение фиксированного кешбэка',
    example: 100,
  })
  max: number;
}

export class PromotionBrandDto extends UpdateBrandDto {
  @ApiProperty({
    description: 'Диапазон суммы',
    type: [Range],
  })
  amount?: Range;
  @ApiProperty({
    description: 'Диапазон процентов',
    type: [Range],
  })
  percent?: Range;
}
