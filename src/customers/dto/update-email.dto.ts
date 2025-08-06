import { ApiProperty, PickType } from '@nestjs/swagger';
import { CreateCustomerDto } from './create-customer.dto';
import { IsString } from 'class-validator';

export class UpdateEmailDto extends PickType(CreateCustomerDto, ['email']) {}

export class confirmEmailDto {
  @ApiProperty({
    description: 'Confirmation token',
    required: true,
  })
  @IsString()
  token: string;
}
