import { ApiProperty } from '@nestjs/swagger';
import { UpdateBrandDto } from './update-brand.dto';

class Range {
  @ApiProperty({
    description: 'Max of fix cashback',
    example: 1,
  })
  min: number;
  @ApiProperty({
    description: 'Min of fix cashback',
    example: 100,
  })
  max: number;
}

export class PromotionBrandDto extends UpdateBrandDto {
  @ApiProperty({
    description: 'Range amount',
    type: [Range],
  })
  amount?: Range;
  @ApiProperty({
    description: 'Range percent',
    type: [Range],
  })
  percent?: Range;
}
