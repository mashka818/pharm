import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateCustomerDto } from './create-customer.dto';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @ApiProperty({
    description: 'Идентификатор основной схемы вывода средств клиента',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  mainWithdrawalVariant?: number;
}
