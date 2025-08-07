import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class CreateWithdrawalVariantDto {
  @ApiProperty({
    description: 'Тип варианта вывода',
    example: 'bank/phone',
    required: true,
  })
  @IsIn(['bank', 'phone'])
  type: WithdrawalType;

  @ApiProperty({
    description: 'Тип иконки варианта вывода',
    example: 'mir',
    required: true,
  })
  @IsString()
  iconType: string;

  @ApiProperty({
    description: 'Заголовок варианта вывода (номер телефона или карты)',
    example: '8 (999) 999 99-99 / 1234 1234 1234 1234',
    required: true,
  })
  @IsString()
  title: string;
}

type WithdrawalType = 'bank' | 'phone';
