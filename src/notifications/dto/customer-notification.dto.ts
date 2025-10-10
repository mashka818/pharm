import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsBoolean, IsInt } from 'class-validator';

export enum CustomerNotificationType {
  receipt_scanned = 'receipt_scanned',
  receipt_processing = 'receipt_processing',
  receipt_approved = 'receipt_approved',
  receipt_rejected = 'receipt_rejected',
  cashback_awarded = 'cashback_awarded',
  cashback_cancelled = 'cashback_cancelled',
  cashback_confirmed = 'cashback_confirmed',
  ticket_approved = 'ticket_approved',
  ticket_rejected = 'ticket_rejected',
  bonuses_added = 'bonuses_added',
  bonuses_deducted = 'bonuses_deducted',
}

export class CustomerNotificationDto {
  @ApiProperty({
    description: 'ID уведомления',
    example: 'uuid-string',
  })
  id: string;

  @ApiProperty({
    description: 'Тип уведомления',
    enum: CustomerNotificationType,
    example: CustomerNotificationType.cashback_awarded,
  })
  type: CustomerNotificationType;

  @ApiProperty({
    description: 'Заголовок уведомления',
    example: 'Кешбек начислен',
  })
  title: string;

  @ApiProperty({
    description: 'Текст уведомления',
    example: 'Вам начислено 150 бонусов за покупку',
  })
  message: string;

  @ApiProperty({
    description: 'ID клиента',
    example: 1,
  })
  customerId: number;

  @ApiProperty({
    description: 'ID связанной сущности (чека, кешбека, тикета)',
    example: '123',
    required: false,
  })
  @IsOptional()
  relatedEntityId?: string;

  @ApiProperty({
    description: 'Тип связанной сущности',
    example: 'receipt',
    required: false,
  })
  @IsOptional()
  relatedEntityType?: string;

  @ApiProperty({
    description: 'Дополнительные данные',
    example: { amount: 150, receiptNumber: '12345' },
    required: false,
  })
  @IsOptional()
  metadata?: any;

  @ApiProperty({
    description: 'Прочитано ли уведомление',
    example: false,
  })
  isRead: boolean;

  @ApiProperty({
    description: 'Дата создания',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;
}

export class CreateCustomerNotificationDto {
  @ApiProperty({
    description: 'Тип уведомления',
    enum: CustomerNotificationType,
  })
  @IsEnum(CustomerNotificationType)
  type: CustomerNotificationType;

  @ApiProperty({
    description: 'Заголовок уведомления',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Текст уведомления',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'ID клиента',
  })
  @IsInt()
  customerId: number;

  @ApiProperty({
    description: 'ID связанной сущности',
    required: false,
  })
  @IsOptional()
  @IsString()
  relatedEntityId?: string;

  @ApiProperty({
    description: 'Тип связанной сущности',
    required: false,
  })
  @IsOptional()
  @IsString()
  relatedEntityType?: string;

  @ApiProperty({
    description: 'Дополнительные данные',
    required: false,
  })
  @IsOptional()
  metadata?: any;
}

export class MarkAsReadDto {
  @ApiProperty({
    description: 'Массив ID уведомлений для отметки как прочитанные',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsString({ each: true })
  notificationIds: string[];
}

