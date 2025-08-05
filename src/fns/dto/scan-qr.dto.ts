import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanQrDto {
  @ApiProperty({ description: 'QR-код чека', example: 't=20231201T1430&s=1234.56&fn=9287440300090728&i=12345&fp=1234567890&n=1' })
  @IsString()
  @IsNotEmpty()
  qrCode: string;

  @ApiProperty({ description: 'Токен пользователя', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'Дополнительные данные', required: false })
  @IsOptional()
  additionalData?: Record<string, any>;
}