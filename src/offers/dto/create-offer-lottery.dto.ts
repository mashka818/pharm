import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsNumber, IsDateString, ValidateIf } from 'class-validator';

export class CreateOfferLotteryDto {
  @ApiPropertyOptional({
    description: 'Участвует ли предложение в розыгрыше',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isLottery?: boolean = false;

  @ApiPropertyOptional({
    description: 'Описание приза для розыгрыша',
    example: 'iPhone 15 Pro Max',
  })
  @IsOptional()
  @ValidateIf(o => o.isLottery === true)
  @IsString()
  lotteryPrize?: string;

  @ApiPropertyOptional({
    description: 'Количество победителей в розыгрыше',
    example: 5,
  })
  @IsOptional()
  @ValidateIf(o => o.isLottery === true)
  @IsNumber()
  lotteryWinners?: number;

  @ApiPropertyOptional({
    description: 'Дата окончания розыгрыша',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @ValidateIf(o => o.isLottery === true)
  @IsDateString()
  lotteryEndDate?: string;
}
