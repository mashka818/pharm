import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginAdminDto {
  @ApiProperty({
    description: 'username of admin',
    example: 'adminUsername',
    required: true,
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: 'password of admin',
    example: 'adminPassword',
    required: true,
  })
  @IsString()
  password: string;
}
