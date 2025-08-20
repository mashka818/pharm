import { ApiProperty } from '@nestjs/swagger';

export class AdminNotificationDto {
  @ApiProperty({ description: 'ID уведомления' })
  id: string;

  @ApiProperty({ description: 'Тип уведомления' })
  type: 'suspicious_activity' | 'repeated_scan' | 'fake_receipt' | 'system_error';

  @ApiProperty({ description: 'Заголовок уведомления' })
  title: string;

  @ApiProperty({ description: 'Сообщение' })
  message: string;

  @ApiProperty({ description: 'ID промоакции' })
  promotionId: string;

  @ApiProperty({ description: 'ID клиента (если применимо)', required: false })
  customerId?: number;

  @ApiProperty({ description: 'ID запроса к ФНС (если применимо)', required: false })
  fnsRequestId?: string;

  @ApiProperty({ description: 'Дополнительные данные', required: false })
  metadata?: any;

  @ApiProperty({ description: 'Прочитано ли уведомление' })
  isRead: boolean;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;
}

export class ScanningStatsDto {
  @ApiProperty({ description: 'Всего сканирований' })
  totalScans: number;

  @ApiProperty({ description: 'Успешных сканирований' })
  successfulScans: number;

  @ApiProperty({ description: 'Отклоненных сканирований' })
  rejectedScans: number;

  @ApiProperty({ description: 'Поддельных чеков' })
  fakeReceipts: number;

  @ApiProperty({ description: 'Возвратных чеков' })
  returnReceipts: number;

  @ApiProperty({ description: 'Статистика по ИНН' })
  innStats: Array<{
    inn: string;
    count: number;
    successRate: number;
  }>;

  @ApiProperty({ description: 'Статистика по времени (по часам)' })
  timeStats: Array<{
    hour: number;
    count: number;
  }>;

  @ApiProperty({ description: 'Период статистики' })
  period: {
    from: Date;
    to: Date;
  };
}
