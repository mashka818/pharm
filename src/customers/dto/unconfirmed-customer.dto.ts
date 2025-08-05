import { IsNumber, IsString } from 'class-validator';
import { CreateCustomerDto } from './create-customer.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUnconfirmedCustomerDto extends CreateCustomerDto {
  @ApiProperty({
    description: 'Confirmation token of unconfirmed customer',
    required: true,
  })
  @IsString()
  confirmationToken: string;
}

export class UpdateUnconfirmedCustomerDto extends CreateUnconfirmedCustomerDto {
  @ApiProperty({
    description: 'Id of unconfirmed customer',
    example: 1,
    required: true,
  })
  @IsNumber()
  id: number;
}
