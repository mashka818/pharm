import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateCustomerDto } from './create-customer.dto';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @ApiProperty({
    description: 'Id of main withdrawal variant of customer',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  mainWithdrawalVariant?: number;
}
