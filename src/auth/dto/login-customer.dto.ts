import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginCustomerDto {
  @ApiProperty({ 
    description: 'Email клиента', 
    example: 'user@example.com' 
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ 
    description: 'Пароль клиента', 
    example: 'password123' 
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ 
    description: 'ID промоакции (сети аптек)', 
    example: 'r-farm-network' 
  })
  @IsString()
  @IsNotEmpty()
  promotionId: string;
}