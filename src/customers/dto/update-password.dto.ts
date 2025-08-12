import { IsString, MaxLength, MinLength } from 'class-validator';
import { CreateCustomerDto } from './create-customer.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
  @ApiProperty({
    description: 'Старый пароль',
    example: 'somePassword111',
    minLength: 4,
    maxLength: 16,
    required: true,
  })
  @MinLength(4)
  @MaxLength(16)
  @IsString()
  prevPassword: CreateCustomerDto['password'];
  @ApiProperty({
    description: 'Новый пароль',
    example: 'somePassword111',
    minLength: 4,
    maxLength: 16,
    required: true,
  })
  @MinLength(4)
  @MaxLength(16)
  @IsString()
  newPassword: CreateCustomerDto['password'];
}
