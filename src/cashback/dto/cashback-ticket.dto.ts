import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export { TicketStatus };

export class CreateCashbackTicketDto {
  @ApiProperty({
    description: 'Сумма бонусов для вывода',
    example: 1000,
  })
  @IsInt()
  amount: number;
}

export class UpdateCashbackTicketDto {
  @ApiProperty({
    description: 'Статус тикета',
    enum: TicketStatus,
    example: TicketStatus.approved,
  })
  @IsEnum(TicketStatus)
  status: TicketStatus;

  @ApiProperty({
    description: 'Комментарий администратора',
    example: 'Кешбек подтвержден',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminComment?: string;
}

export class CashbackTicketDto {
  @ApiProperty({
    description: 'ID тикета',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Сумма бонусов',
    example: 1000,
  })
  amount: number;

  @ApiProperty({
    description: 'ID клиента',
    example: 1,
  })
  customerId: number;

  @ApiProperty({
    description: 'ID промоакции',
    example: 'x-pharm',
  })
  promotionId: string;

  @ApiProperty({
    description: 'Статус тикета',
    enum: TicketStatus,
    example: TicketStatus.pending,
  })
  status: TicketStatus;

  @ApiProperty({
    description: 'ID администратора',
    example: 1,
    required: false,
  })
  adminId?: number;

  @ApiProperty({
    description: 'Комментарий администратора',
    example: 'Кешбек подтвержден',
    required: false,
  })
  adminComment?: string;

  @ApiProperty({
    description: 'Дата создания',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Дата обновления',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Дата разрешения',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  resolvedAt?: Date;
}
