import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ParseQrDto {
  @ApiProperty({ 
    description: 'QR код в виде строки (URL или отдельные параметры)', 
    example: 't=20240101T1200&s=1500.00&fn=9287440300090728&i=12345&fp=1234567890&n=1' 
  })
  @IsString()
  @IsNotEmpty()
  qrData: string;
}

export class QrParseResultDto {
  @ApiProperty({ description: 'Результат парсинга QR кода' })
  success: boolean;

  @ApiProperty({ description: 'Распарсенные данные чека', required: false })
  data?: {
    fn: string;
    fd: string;
    fp: string;
    sum: string;
    date: string;
    typeOperation?: string;
  };

  @ApiProperty({ description: 'Сообщение об ошибке', required: false })
  error?: string;
}