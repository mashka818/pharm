import { ApiProperty } from '@nestjs/swagger';

export class ReceiptStatusDto {
  @ApiProperty({ description: 'ID запроса' })
  requestId: string;

  @ApiProperty({ description: 'Статус обработки', enum: ['pending', 'processing', 'success', 'rejected', 'failed'] })
  status: string;

  @ApiProperty({ description: 'Сумма кешбэка', required: false })
  cashbackAmount?: number;

  @ApiProperty({ description: 'Кешбэк начислен', required: false })
  cashbackAwarded?: boolean;

  @ApiProperty({ description: 'Чек валидный', required: false })
  isValid?: boolean;

  @ApiProperty({ description: 'Чек возвратный', required: false })
  isReturn?: boolean;

  @ApiProperty({ description: 'Чек фальшивый', required: false })
  isFake?: boolean;

  @ApiProperty({ description: 'Дата создания запроса' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата последнего обновления' })
  updatedAt: Date;

  @ApiProperty({ description: 'Информация о пользователе', required: false })
  customer?: {
    id: number;
    name: string;
    email: string;
  };
} 