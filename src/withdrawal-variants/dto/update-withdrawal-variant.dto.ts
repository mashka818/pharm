import { ApiProperty } from '@nestjs/swagger';
import { CreateWithdrawalVariantDto } from './create-withdrawal-variant.dto';
export class UpdateWithdrawalVariantDto extends CreateWithdrawalVariantDto {
  @ApiProperty({
    description: 'Идентификатор варианта вывода',
    example: 1,
    required: true,
  })
  id: number;
}
