import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AdminNotificationDto, ScanningStatsDto } from './dto/admin-notification.dto';

@Injectable()
export class AdminNotificationService {
  private readonly logger = new Logger(AdminNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Получение уведомлений для администратора
   */
  async getNotifications(
    promotionId?: string,
    isRead?: boolean,
    limit: number = 50
  ): Promise<AdminNotificationDto[]> {
    this.logger.log(`Getting notifications for promotion: ${promotionId || 'all'}, isRead: ${isRead}`);

    const whereClause: any = {};

    if (promotionId) {
      whereClause.promotionId = promotionId;
    }

    if (typeof isRead === 'boolean') {
      whereClause.isRead = isRead;
    }

    const notifications = await this.prisma.adminNotification.findMany({
      where: whereClause,
      include: {
        promotion: {
          select: {
            promotionId: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
          },
        },
        fnsRequest: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    this.logger.log(`Retrieved ${notifications.length} notifications`);
    return notifications as AdminNotificationDto[];
  }

  /**
   * Отметить уведомление как прочитанное
   */
  async markAsRead(notificationId: string): Promise<void> {
    await this.prisma.adminNotification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    this.logger.log(`Marked notification ${notificationId} as read`);
  }

  /**
   * Отметить все уведомления как прочитанные
   */
  async markAllAsRead(promotionId?: string): Promise<number> {
    const whereClause: any = { isRead: false };

    if (promotionId) {
      whereClause.promotionId = promotionId;
    }

    const result = await this.prisma.adminNotification.updateMany({
      where: whereClause,
      data: { isRead: true },
    });

    this.logger.log(`Marked ${result.count} notifications as read`);
    return result.count;
  }

  /**
   * Получение статистики сканирования чеков
   */
  async getScanningStats(
    promotionId?: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<ScanningStatsDto> {
    this.logger.log(`Getting scanning stats for promotion: ${promotionId || 'all'}`);

    const from = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 дней назад
    const to = toDate || new Date();

    const whereClause: any = {
      createdAt: {
        gte: from,
        lte: to,
      },
    };

    if (promotionId) {
      whereClause.promotionId = promotionId;
    }

    // Общая статистика
    const totalScans = await this.prisma.fnsRequest.count({ where: whereClause });

    const successfulScans = await this.prisma.fnsRequest.count({
      where: { ...whereClause, status: 'success' },
    });

    const rejectedScans = await this.prisma.fnsRequest.count({
      where: { ...whereClause, status: 'rejected' },
    });

    const fakeReceipts = await this.prisma.fnsRequest.count({
      where: { ...whereClause, isFake: true },
    });

    const returnReceipts = await this.prisma.fnsRequest.count({
      where: { ...whereClause, isReturn: true },
    });

    // Статистика по ИНН (извлекаем из fnsResponse)
    const fnsRequests = await this.prisma.fnsRequest.findMany({
      where: whereClause,
      select: {
        fnsResponse: true,
        status: true,
      },
    });

    const innStats = this.calculateInnStats(fnsRequests);

    // Статистика по времени (по часам)
    const timeStats = await this.calculateTimeStats(whereClause);

    return {
      totalScans,
      successfulScans,
      rejectedScans,
      fakeReceipts,
      returnReceipts,
      innStats,
      timeStats,
      period: { from, to },
    };
  }

  /**
   * Расчет статистики по ИНН
   */
  private calculateInnStats(fnsRequests: any[]): Array<{
    inn: string;
    count: number;
    successRate: number;
  }> {
    const innMap = new Map<string, { total: number; successful: number }>();

    fnsRequests.forEach(request => {
      if (request.fnsResponse?.inn) {
        const inn = request.fnsResponse.inn;
        const current = innMap.get(inn) || { total: 0, successful: 0 };
        
        current.total++;
        if (request.status === 'success') {
          current.successful++;
        }
        
        innMap.set(inn, current);
      }
    });

    return Array.from(innMap.entries())
      .map(([inn, stats]) => ({
        inn,
        count: stats.total,
        successRate: stats.total > 0 ? (stats.successful / stats.total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Топ 10 ИНН
  }

  /**
   * Расчет статистики по времени
   */
  private async calculateTimeStats(whereClause: any): Promise<Array<{
    hour: number;
    count: number;
  }>> {
    // Получаем количество запросов по часам за последние 24 часа
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const timeWhereClause = {
      ...whereClause,
      createdAt: {
        gte: twentyFourHoursAgo,
        lte: new Date(),
      },
    };

    const requests = await this.prisma.fnsRequest.findMany({
      where: timeWhereClause,
      select: {
        createdAt: true,
      },
    });

    const hourlyStats = new Array(24).fill(0);

    requests.forEach(request => {
      const hour = request.createdAt.getHours();
      hourlyStats[hour]++;
    });

    return hourlyStats.map((count, hour) => ({ hour, count }));
  }

  /**
   * Получение количества непрочитанных уведомлений
   */
  async getUnreadCount(promotionId?: string): Promise<number> {
    const whereClause: any = { isRead: false };

    if (promotionId) {
      whereClause.promotionId = promotionId;
    }

    return await this.prisma.adminNotification.count({ where: whereClause });
  }
}
