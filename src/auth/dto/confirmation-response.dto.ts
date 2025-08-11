import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ConfirmationResponseDto {
  @ApiProperty({
    description: 'Сообщение об успешном подтверждении',
    example: 'User successfully confirmed',
    required: true,
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Email подтвержденного пользователя',
    example: 'user@example.com',
    required: true,
  })
  @IsString()
  email: string;
}
