import { ApiProperty } from '@nestjs/swagger';

export class CalculateCashbackDto {
  @ApiProperty({ description: 'Общая сумма кэшбека в копейках' })
  totalCashback: number;

  @ApiProperty({ description: 'Детализация кэшбека по товарам', type: [Object] })
  items: CashbackCalculationItemDto[];

  @ApiProperty({ description: 'Примененные акции', type: [Number] })
  appliedOffers: number[];
}

export class CashbackCalculationItemDto {
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

  @ApiProperty({ description: 'ID товара', nullable: true })
  productId?: number;

  @ApiProperty({ description: 'ID акции', nullable: true })
  offerId?: number;

  @ApiProperty({ description: 'Название акции', nullable: true })
  offerName?: string;
}