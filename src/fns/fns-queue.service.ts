import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { VerifyReceiptDto } from './dto/verify-receipt.dto';
import { ScanQrCodeDto } from './dto/scan-qr-code.dto';

@Injectable()
export class FnsQueueService {
  private readonly logger = new Logger(FnsQueueService.name);

  constructor(private readonly prisma: PrismaService) {}

  async addToQueueWithPromotion(qrData: ScanQrCodeDto, customerId: number, promotionId: string): Promise<string> {
    this.logger.log(`Adding request to queue with promotion: ${JSON.stringify(qrData)}`);

    try {
      await this.checkDailyLimit();

      const request = await this.prisma.fnsRequest.create({
        data: {
          qrData: qrData as any,
          status: 'pending',
          attempts: 0,
          customerId,
          promotionId,
        },
      });

      this.logger.log(`Request added to queue with ID: ${request.id}`);
      return request.id;
    } catch (error) {
      this.logger.error('Error adding request to queue:', error);
      throw error;
    }
  }

  async addToQueue(qrData: VerifyReceiptDto, customerId?: number): Promise<string> {
    this.logger.log(`Adding request to queue: ${JSON.stringify(qrData)}`);

    try {
      await this.checkDailyLimit();

      // Для backward compatibility, если promotionId не указан, используем временное значение
      const promotionId = 'default-promotion';
      
      const request = await this.prisma.fnsRequest.create({
        data: {
          qrData: qrData as any,
          status: 'pending',
          attempts: 0,
          customerId,
          promotionId,
        },
      });

      this.logger.log(`Request added to queue with ID: ${request.id}`);
      return request.id;
    } catch (error) {
      this.logger.error('Error adding request to queue:', error);
      throw error;
    }
  }

  async getPendingRequests(): Promise<any[]> {
    try {
      const requests = await this.prisma.fnsRequest.findMany({
        where: {
          status: 'pending',
          attempts: {
            lt: 3,
          },
          OR: [
            { lastAttemptAt: null },
            { lastAttemptAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
          ],
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 5,
      });

      this.logger.debug(`Found ${requests.length} pending requests`);
      return requests;
    } catch (error) {
      this.logger.error('Error getting pending requests:', error);
      return [];
    }
  }

  async updateRequestStatus(requestId: string, status: 'pending' | 'processing' | 'success' | 'rejected' | 'failed', data?: any): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (status === 'success') {
        updateData.isValid = true;
        updateData.isReturn = false;
        updateData.isFake = false;
      } else if (status === 'rejected') {
        updateData.isValid = false;
        updateData.isReturn = data?.isReturn || false;
        updateData.isFake = data?.isFake || false;
      } else if (status === 'failed') {
        updateData.isValid = false;
        updateData.isReturn = false;
        updateData.isFake = true;
      } else if (status === 'processing') {
        updateData.isValid = null;
        updateData.isReturn = null;
        updateData.isFake = null;
      }

      if (data?.fnsResponse) {
        updateData.fnsResponse = data.fnsResponse;
      }

      if (data?.cashbackAmount !== undefined) {
        updateData.cashbackAmount = data.cashbackAmount;
      }

      if (data?.cashbackAwarded !== undefined) {
        updateData.cashbackAwarded = data.cashbackAwarded;
      }

      await this.prisma.fnsRequest.update({
        where: { id: requestId },
        data: updateData,
      });

      this.logger.log(`Updated request ${requestId} status to ${status}`);
    } catch (error) {
      this.logger.error(`Error updating request ${requestId}:`, error);
    }
  }

  async incrementAttempts(requestId: string): Promise<void> {
    try {
      await this.prisma.fnsRequest.update({
        where: { id: requestId },
        data: {
          attempts: {
            increment: 1,
          },
          lastAttemptAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Error incrementing attempts for request ${requestId}:`, error);
    }
  }

  async markRequestAsFailed(requestId: string, error?: string): Promise<void> {
    try {
      await this.prisma.fnsRequest.update({
        where: { id: requestId },
        data: {
          status: 'failed',
          isValid: false,
          isReturn: false,
          isFake: true,
          fnsResponse: error ? { error } : null,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Marked request ${requestId} as failed`);
    } catch (error) {
      this.logger.error(`Error marking request ${requestId} as failed:`, error);
    }
  }

  async markRequestAsProcessing(requestId: string): Promise<void> {
    try {
      await this.prisma.fnsRequest.update({
        where: { id: requestId },
        data: {
          status: 'processing',
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Marked request ${requestId} as processing`);
    } catch (error) {
      this.logger.error(`Error marking request ${requestId} as processing:`, error);
    }
  }

  private async checkDailyLimit(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayRequests = await this.prisma.fnsRequest.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const maxDailyRequests = parseInt(process.env.FNS_DAILY_LIMIT || '1000');

    if (todayRequests >= maxDailyRequests) {
      throw new Error('Daily request limit exceeded');
    }

    this.logger.debug(`Daily requests: ${todayRequests}/${maxDailyRequests}`);
  }

  async getQueueStats(): Promise<any> {
    try {
      const [pending, processing, success, rejected, failed] = await Promise.all([
        this.prisma.fnsRequest.count({ where: { status: 'pending' } }),
        this.prisma.fnsRequest.count({ where: { status: 'processing' } }),
        this.prisma.fnsRequest.count({ where: { status: 'success' } }),
        this.prisma.fnsRequest.count({ where: { status: 'rejected' } }),
        this.prisma.fnsRequest.count({ where: { status: 'failed' } }),
      ]);

      const totalCashbackAwarded = await this.prisma.fnsRequest.aggregate({
        where: { 
          status: 'success',
          cashbackAwarded: true 
        },
        _sum: {
          cashbackAmount: true,
        },
      });

      return {
        pending,
        processing,
        success,
        rejected,
        failed,
        total: pending + processing + success + rejected + failed,
        totalCashbackAwarded: totalCashbackAwarded._sum.cashbackAmount || 0,
      };
    } catch (error) {
      this.logger.error('Error getting queue stats:', error);
      return {};
    }
  }

  async cleanupOldRequests(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedCount = await this.prisma.fnsRequest.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
          status: {
            in: ['success', 'rejected', 'failed'],
          },
        },
      });

      this.logger.log(`Cleaned up ${deletedCount.count} old requests`);
    } catch (error) {
      this.logger.error('Error cleaning up old requests:', error);
    }
  }
} 