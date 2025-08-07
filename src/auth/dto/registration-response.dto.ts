import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RegistrationResponseDto {
  @ApiProperty({
    description: 'Сообщение об успешной регистрации',
    example: 'Registration request has been created',
    required: true,
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Токен подтверждения для активации аккаунта',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: true,
  })
  @IsString()
  confirmationToken: string;

  @ApiProperty({
    description: 'Ссылка для подтверждения email',
    example: 'https://example.com/auth/confirm/550e8400-e29b-41d4-a716-446655440000',
    required: true,
  })
  @IsString()
  confirmationLink: string;
}
