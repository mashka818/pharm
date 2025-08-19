import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelCashbackDto {
  @ApiProperty({ 
    description: 'Причина отмены кэшбека', 
    example: 'Дублирующий чек',
    maxLength: 500
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}