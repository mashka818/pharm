import { ApiProperty } from '@nestjs/swagger';
import { CashbackStatus } from '@prisma/client';

export class CashbackHistoryItemDto {
  @ApiProperty({ description: 'ID кэшбека' })
  id: number;

  @ApiProperty({ description: 'Сумма кэшбека в копейках' })
  amount: number;

  @ApiProperty({ description: 'Статус кэшбека', enum: CashbackStatus })
  status: CashbackStatus;

  @ApiProperty({ description: 'Причина отмены', nullable: true })
  reason?: string;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата отмены', nullable: true })
  cancelledAt?: Date;

  @ApiProperty({ description: 'Информация о клиенте' })
  customer: {
    id: number;
    name: string;
    surname: string;
    email: string;
  };

  @ApiProperty({ description: 'Информация о промоакции' })
  promotion: {
    promotionId: string;
    name: string;
  };

  @ApiProperty({ description: 'Администратор, отменивший кэшбек', nullable: true })
  cancelledByAdmin?: {
    id: number;
    username: string;
  };

  @ApiProperty({ description: 'Детализация кэшбека по товарам' })
  items: CashbackItemDto[];
}

export class CashbackItemDto {
  @ApiProperty({ description: 'ID позиции кэшбека' })
  id: number;

  @ApiProperty({ description: 'Название товара' })
  productName: string;

  @ApiProperty({ description: 'SKU товара', nullable: true })
  productSku?: string;

  @ApiProperty({ description: 'Количество' })
  quantity: number;

  @ApiProperty({ description: 'Цена за единицу в копейках' })
  itemPrice: number;

  @ApiProperty({ description: 'Общая стоимость позиции в копейках' })
  totalPrice: number;

  @ApiProperty({ description: 'Сумма кэшбека за позицию в копейках' })
  cashbackAmount: number;

  @ApiProperty({ description: 'Тип кэшбека', enum: ['percent', 'amount'] })
  cashbackType: 'percent' | 'amount';

  @ApiProperty({ description: 'Размер кэшбека (процент или сумма)', nullable: true })
  cashbackRate?: number;

  @ApiProperty({ description: 'Информация о товаре', nullable: true })
  product?: {
    id: number;
    name: string;
    sku: string;
  };

  @ApiProperty({ description: 'Информация об акции', nullable: true })
  offer?: {
    id: number;
    profit: number;
    profitType: string;
  };
}