import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

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

  @ApiProperty({ description: 'Сумма чека в копейках', example: 240000 })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  sum: number;

  @ApiProperty({ description: 'Дата чека', example: '2019-04-09T16:38:00' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ description: 'Тип операции', example: 1, required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  typeOperation?: number;

  @ApiProperty({ description: 'Дополнительные данные QR-кода', required: false })
  @IsOptional()
  additionalData?: Record<string, any>;
} 