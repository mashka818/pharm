import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginAdminDto {
  @ApiProperty({
    description: 'Имя пользователя администратора',
    example: 'adminUsername',
    required: true,
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: 'Пароль администратора',
    example: 'adminPassword',
    required: true,
  })
  @IsString()
  password: string;
}
