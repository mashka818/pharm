import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { 
  CustomerNotificationDto, 
  CreateCustomerNotificationDto, 
  CustomerNotificationType 
} from './dto/customer-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  
  async createNotification(
    createDto: CreateCustomerNotificationDto
  ): Promise<CustomerNotificationDto> {
    this.logger.debug(
      `Creating notification for customer ${createDto.customerId}: ${createDto.title}`
    );

    return await (this.prisma as any).customerNotification.create({
      data: {
        type: createDto.type,
        title: createDto.title,
        message: createDto.message,
        customerId: createDto.customerId,
        relatedEntityId: createDto.relatedEntityId,
        relatedEntityType: createDto.relatedEntityType,
        metadata: createDto.metadata,
      },
    });
  }

  
  async getCustomerNotifications(
    customerId: number,
    onlyUnread: boolean = false
  ): Promise<CustomerNotificationDto[]> {
    const whereClause: any = { customerId };
    
    if (onlyUnread) {
      whereClause.isRead = false;
    }

    return await (this.prisma as any).customerNotification.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  
  async markAsRead(notificationIds: string[]): Promise<{ count: number }> {
    const result = await (this.prisma as any).customerNotification.updateMany({
      where: {
        id: { in: notificationIds },
      },
      data: {
        isRead: true,
      },
    });

    this.logger.debug(`Marked ${result.count} notifications as read`);
    return { count: result.count };
  }

  
  async markAllAsRead(customerId: number): Promise<{ count: number }> {
    const result = await (this.prisma as any).customerNotification.updateMany({
      where: {
        customerId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    this.logger.debug(`Marked all ${result.count} notifications as read for customer ${customerId}`);
    return { count: result.count };
  }

  
  async getUnreadCount(customerId: number): Promise<number> {
    return await (this.prisma as any).customerNotification.count({
      where: {
        customerId,
        isRead: false,
      },
    });
  }

  
  async deleteNotification(notificationId: string, customerId: number): Promise<void> {
    const notification = await (this.prisma as any).customerNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Уведомление не найдено');
    }

    if (notification.customerId !== customerId) {
      throw new NotFoundException('Уведомление не найдено');
    }

    await (this.prisma as any).customerNotification.delete({
      where: { id: notificationId },
    });

    this.logger.debug(`Deleted notification ${notificationId}`);
  }

  
  async notifyReceiptScanned(customerId: number, receiptId: number): Promise<void> {
    await this.createNotification({
      type: CustomerNotificationType.receipt_scanned,
      title: 'Чек отправлен на проверку',
      message: 'Ваш чек успешно отсканирован и отправлен на проверку в ФНС',
      customerId,
      relatedEntityId: receiptId.toString(),
      relatedEntityType: 'receipt',
    });
  }

  
  async notifyReceiptProcessing(customerId: number, receiptId: number): Promise<void> {
    await this.createNotification({
      type: CustomerNotificationType.receipt_processing,
      title: 'Чек обрабатывается',
      message: 'Ваш чек находится в процессе обработки',
      customerId,
      relatedEntityId: receiptId.toString(),
      relatedEntityType: 'receipt',
    });
  }

  
  async notifyReceiptApproved(
    customerId: number, 
    receiptId: number, 
    cashbackAmount: number
  ): Promise<void> {
    await this.createNotification({
      type: CustomerNotificationType.receipt_approved,
      title: 'Чек успешно проверен',
      message: `Ваш чек успешно проверен. Начислено ${(cashbackAmount / 100).toFixed(2)} руб. кешбека`,
      customerId,
      relatedEntityId: receiptId.toString(),
      relatedEntityType: 'receipt',
      metadata: { cashbackAmount },
    });
  }

  
  async notifyReceiptRejected(
    customerId: number, 
    receiptId: number, 
    reason?: string
  ): Promise<void> {
    await this.createNotification({
      type: CustomerNotificationType.receipt_rejected,
      title: 'Чек отклонен',
      message: reason || 'Ваш чек был отклонен при проверке',
      customerId,
      relatedEntityId: receiptId.toString(),
      relatedEntityType: 'receipt',
      metadata: { reason },
    });
  }

  
  async notifyCashbackAwarded(
    customerId: number, 
    cashbackId: number, 
    amount: number
  ): Promise<void> {
    await this.createNotification({
      type: CustomerNotificationType.cashback_awarded,
      title: 'Кешбек начислен',
      message: `Вам начислено ${(amount / 100).toFixed(2)} руб. кешбека`,
      customerId,
      relatedEntityId: cashbackId.toString(),
      relatedEntityType: 'cashback',
      metadata: { amount },
    });
  }

 
  async notifyCashbackCancelled(
    customerId: number, 
    cashbackId: number, 
    amount: number,
    reason?: string
  ): Promise<void> {
    await this.createNotification({
      type: CustomerNotificationType.cashback_cancelled,
      title: 'Кешбек отменен',
      message: reason 
        ? `Кешбек на сумму ${(amount / 100).toFixed(2)} руб. отменен. Причина: ${reason}`
        : `Кешбек на сумму ${(amount / 100).toFixed(2)} руб. отменен администратором`,
      customerId,
      relatedEntityId: cashbackId.toString(),
      relatedEntityType: 'cashback',
      metadata: { amount, reason },
    });
  }

  
  async notifyCashbackConfirmed(
    customerId: number, 
    cashbackId: number, 
    amount: number
  ): Promise<void> {
    await this.createNotification({
      type: CustomerNotificationType.cashback_confirmed,
      title: 'Кешбек подтвержден',
      message: `Кешбек на сумму ${(amount / 100).toFixed(2)} руб. подтвержден администратором`,
      customerId,
      relatedEntityId: cashbackId.toString(),
      relatedEntityType: 'cashback',
      metadata: { amount },
    });
  }

  
  async notifyTicketApproved(
    customerId: number, 
    ticketId: number, 
    amount: number
  ): Promise<void> {
    await this.createNotification({
      type: CustomerNotificationType.ticket_approved,
      title: 'Заявка одобрена',
      message: `Ваша заявка на вывод ${(amount / 100).toFixed(2)} руб. одобрена`,
      customerId,
      relatedEntityId: ticketId.toString(),
      relatedEntityType: 'ticket',
      metadata: { amount },
    });
  }

 
  async notifyTicketRejected(
    customerId: number, 
    ticketId: number, 
    amount: number,
    reason?: string
  ): Promise<void> {
    await this.createNotification({
      type: CustomerNotificationType.ticket_rejected,
      title: 'Заявка отклонена',
      message: reason 
        ? `Ваша заявка на вывод ${(amount / 100).toFixed(2)} руб. отклонена. Причина: ${reason}`
        : `Ваша заявка на вывод ${(amount / 100).toFixed(2)} руб. отклонена`,
      customerId,
      relatedEntityId: ticketId.toString(),
      relatedEntityType: 'ticket',
      metadata: { amount, reason },
    });
  }

 
  async notifyBonusesAdded(
    customerId: number, 
    amount: number,
    reason?: string
  ): Promise<void> {
    await this.createNotification({
      type: CustomerNotificationType.bonuses_added,
      title: 'Бонусы начислены',
      message: reason 
        ? `Вам начислено ${(amount / 100).toFixed(2)} руб. Причина: ${reason}`
        : `Вам начислено ${(amount / 100).toFixed(2)} руб.`,
      customerId,
      metadata: { amount, reason },
    });
  }

  
  async notifyBonusesDeducted(
    customerId: number, 
    amount: number,
    reason?: string
  ): Promise<void> {
    await this.createNotification({
      type: CustomerNotificationType.bonuses_deducted,
      title: 'Бонусы списаны',
      message: reason 
        ? `С вашего счета списано ${(amount / 100).toFixed(2)} руб. Причина: ${reason}`
        : `С вашего счета списано ${(amount / 100).toFixed(2)} руб.`,
      customerId,
      metadata: { amount, reason },
    });
  }
}

