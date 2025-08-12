import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginResponseDto {
  @ApiProperty({
    description: 'access token',
    required: true,
  })
  @IsString()
  access: string;

  @ApiProperty({
    description: 'refresh token',
    required: true,
  })
  @IsString()
  refresh: string;
}
