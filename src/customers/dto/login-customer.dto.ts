import { PickType } from '@nestjs/swagger';
import { CreateCustomerDto } from './create-customer.dto';

export class LoginCustomerDto extends PickType(CreateCustomerDto, [
  'email',
  'password',
  'promotionId',
]) {}
