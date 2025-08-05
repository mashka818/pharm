import { ApiProperty } from '@nestjs/swagger';
import { CreateWithdrawalVariantDto } from './create-withdrawal-variant.dto';
export class UpdateWithdrawalVariantDto extends CreateWithdrawalVariantDto {
  @ApiProperty({
    description: 'Id of withdrawal variant',
    example: 1,
    required: true,
  })
  id: number;
}
