import { CreateCustomerDto } from './create-customer.dto';
import { IsIn, IsNumber } from 'class-validator';
import { ApiProperty, OmitType } from '@nestjs/swagger';

export class CustomerDto extends OmitType(CreateCustomerDto, ['password']) {
  @ApiProperty({
    description: 'Id of customer',
    example: 1,
    required: true,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'Role of customer',
    example: 'CUSTOMER',
    required: true,
  })
  @IsIn(['CUSTOMER'])
  role: 'CUSTOMER';

  @ApiProperty({
    description: 'Bonuses amount of customer',
    example: 100,
    required: true,
  })
  bonuses: number;

  @ApiProperty({
    description: 'Id of main withdrawal variant of customer',
    example: 1,
    required: true,
  })
  mainWithdrawalVariant: number;

  password?: string;
}
