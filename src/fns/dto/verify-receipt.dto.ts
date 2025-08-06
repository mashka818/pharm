import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyReceiptDto {
  @ApiProperty({ description: 'ФН (Федеральный номер)', example: '9287440300090728' })
  @IsString()
  @IsNotEmpty()
  fn: string;

  @ApiProperty({ description: 'ФД (Федеральный документ)', example: '77133' })
  @IsString()
  @IsNotEmpty()
  fd: string;

  @ApiProperty({ description: 'ФП (Федеральный признак)', example: '1482926127' })
  @IsString()
  @IsNotEmpty()
  fp: string;

  @ApiProperty({ description: 'Сумма чека', example: '2400' })
  @IsString()
  @IsNotEmpty()
  sum: string;

  @ApiProperty({ description: 'Дата чека', example: '2019-04-09T16:38:00' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ description: 'Тип операции', example: '1', required: false })
  @IsOptional()
  @IsString()
  typeOperation?: string;

  @ApiProperty({ description: 'Дополнительные данные QR-кода', required: false })
  @IsOptional()
  additionalData?: Record<string, any>;
} 