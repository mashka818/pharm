import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Имя клиента',
    example: 'Иван',
    required: true,
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Фамилия клиента',
    example: 'Иванов',
    required: true,
  })
  @IsString()
  surname: string;

  @ApiProperty({
    description: 'Отчество клиента',
    example: 'Иванович',
    required: false,
  })
  @IsOptional()
  @IsString()
  patronymic?: string;

  @ApiProperty({
    description: 'Email клиента',
    example: 'ivanov@example.com',
    required: true,
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Идентификатор промоакции клиента',
    example: 'r-pharm',
    required: true,
  })
  @IsString()
  promotionId: string;

  @ApiProperty({
    description: 'Пароль клиента',
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
    description: 'Адрес клиента',
    example: 'г. Москва',
    required: true,
  })
  @IsString()
  address: string;
}
