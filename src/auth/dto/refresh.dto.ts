import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class refreshDto {
  @ApiProperty({
    description: 'refresh token',
    required: true,
  })
  @IsString()
  refresh: string;
}
