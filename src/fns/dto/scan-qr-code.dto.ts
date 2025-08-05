import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ScanQrCodeDto {
  @ApiProperty({ 
    description: 'Фискальный номер (ФН)', 
    example: '9287440300090728',
    minLength: 16,
    maxLength: 16
  })
  @IsString()
  @IsNotEmpty()
  fn: string;

  @ApiProperty({ 
    description: 'Фискальный документ (ФД)', 
    example: '77133' 
  })
  @IsString()
  @IsNotEmpty()
  fd: string;

  @ApiProperty({ 
    description: 'Фискальный признак (ФП)', 
    example: '1482926127' 
  })
  @IsString()
  @IsNotEmpty()
  fp: string;

  @ApiProperty({ 
    description: 'Сумма чека в копейках', 
    example: 240000,
    minimum: 1
  })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  sum: number;

  @ApiProperty({ 
    description: 'Дата и время операции в формате ISO', 
    example: '2019-04-09T16:38:00' 
  })
  @IsDateString()
  date: string;

  @ApiProperty({ 
    description: 'Тип операции (1 - приход, 2 - возврат прихода)', 
    example: 1,
    enum: [1, 2],
    required: false,
    default: 1
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  typeOperation?: number;

  @ApiProperty({ 
    description: 'Дополнительные параметры QR-кода', 
    required: false 
  })
  @IsOptional()
  additionalData?: Record<string, any>;
}