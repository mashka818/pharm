import { CreateCustomerDto } from './create-customer.dto';
import { IsIn, IsNumber } from 'class-validator';
import { ApiProperty, OmitType } from '@nestjs/swagger';

export class CustomerDto extends OmitType(CreateCustomerDto, ['password']) {
  @ApiProperty({
    description: 'Идентификатор клиента',
    example: 1,
    required: true,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'Роль клиента',
    example: 'CUSTOMER',
    required: true,
  })
  @IsIn(['CUSTOMER'])
  role: 'CUSTOMER';

  @ApiProperty({
    description: 'Количество бонусов клиента',
    example: 100,
    required: true,
  })
  bonuses: number;

  @ApiProperty({
    description: 'Идентификатор основной схемы вывода средств клиента',
    example: 1,
    required: true,
  })
  mainWithdrawalVariant: number;

  password?: string;
}
