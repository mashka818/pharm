import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({
    description: 'Имя пользователя компании',
    example: 'ivan_x-farm',
    required: true,
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: 'Пароль пользователя компании',
    example: 'ivan_x-farm_password',
    required: true,
  })
  @IsString()
  password: string;

  @ApiProperty({
    description: 'Идентификатор промоакции компании (нельзя изменить)',
    example: 'x-pharm',
    required: true,
  })
  @IsString()
  promotionId: string;
}
