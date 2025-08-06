import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Name of customer',
    example: 'Ivan',
    required: true,
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Surname of customer',
    example: 'Ivanov',
    required: true,
  })
  @IsString()
  surname: string;

  @ApiProperty({
    description: 'Patronymic of customer',
    example: 'Ivanovich',
    required: false,
  })
  @IsOptional()
  @IsString()
  patronymic?: string;

  @ApiProperty({
    description: 'Email of customer',
    example: 'ivanov@example.com',
    required: true,
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'PromotionId of customer account',
    example: 'r-pharm',
    required: true,
  })
  @IsString()
  promotionId: string;

  @ApiProperty({
    description: 'Password of customer',
    example: 'somePassword111',
    minLength: 4,
    maxLength: 16,
    required: true,
  })
  @MinLength(4)
  @MaxLength(16)
  @IsString()
  password: string;

  @ApiProperty({
    description: 'Address of customer account',
    example: 'Г. Москва',
    required: true,
  })
  @IsString()
  address: string;
}
