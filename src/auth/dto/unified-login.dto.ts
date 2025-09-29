import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnifiedLoginDto {
  @ApiProperty({ 
    description: 'Email или имя пользователя', 
    example: 'user@example.com или adminUsername' 
  })
  @IsString()
  @IsNotEmpty()
  emailOrUsername: string;

  @ApiProperty({ 
    description: 'Пароль', 
    example: 'password123' 
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ 
    description: 'ID промоакции (обязательно для клиентов, не нужно для админов)', 
    example: 'r-farm-network',
    required: false
  })
  @IsString()
  @IsOptional()
  promotionId?: string;
}
