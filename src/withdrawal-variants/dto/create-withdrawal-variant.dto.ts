import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class CreateWithdrawalVariantDto {
  @ApiProperty({
    description: 'Type of withdrawal variant',
    example: 'bank/phone',
    required: true,
  })
  @IsIn(['bank', 'phone'])
  type: WithdrawalType;

  @ApiProperty({
    description: 'Icon type of withdrawal variant',
    example: 'mir',
    required: true,
  })
  @IsString()
  iconType: string;

  @ApiProperty({
    description: 'Title of withdrawal variant (phone number or card number)',
    example: '8 (999) 999 99-99 / 1234 1234 1234 1234',
    required: true,
  })
  @IsString()
  title: string;
}

type WithdrawalType = 'bank' | 'phone';
