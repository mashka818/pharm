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
    description: 'Сумма чека в рублях (будет конвертирована в копейки автоматически)', 
    example: 1200,
    minimum: 0.01
  })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  sum: number;

  @ApiProperty({ 
    description: 'Дата и время операции в московском времени (ISO 8601 или YYYY-MM-DD HH:mm:ss)', 
    example: '2019-04-09T16:38:00+03:00' 
  })
  @Transform(({ value }) => {
    if (!value) return value;
    
    // Если уже в правильном ISO формате с часовым поясом
    if (value.includes('+') || value.includes('Z')) {
      return value;
    }
    
    // Если в формате YYYY-MM-DD HH:mm:ss (московское время)
    if (value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      return value.replace(' ', 'T') + '+03:00';
    }
    
    // Если в формате YYYY-MM-DDTHH:mm:ss (без часового пояса)
    if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
      return value + '+03:00';
    }
    
    return value;
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