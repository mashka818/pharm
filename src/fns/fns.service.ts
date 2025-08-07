import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FnsAuthService } from './fns-auth.service';
import { FnsCheckService } from './fns-check.service';
import { FnsQueueService } from './fns-queue.service';
import { FnsCashbackService } from './fns-cashback.service';
import { PrismaService } from '../prisma.service';
import { VerifyReceiptDto } from './dto/verify-receipt.dto';
import { ReceiptStatusDto } from './dto/receipt-status.dto';
import { ScanQrCodeDto } from './dto/scan-qr-code.dto';

@Injectable()
export class FnsService {
  private readonly logger = new Logger(FnsService.name);

  constructor(
    private readonly fnsAuthService: FnsAuthService,
    private readonly fnsCheckService: FnsCheckService,
    private readonly fnsQueueService: FnsQueueService,
    private readonly fnsCashbackService: FnsCashbackService,
    private readonly prisma: PrismaService,
  ) {}

  async processScanQrCode(qrData: ScanQrCodeDto, customerId: number, promotionId: string, host: string) {
    this.logger.log(`Processing QR scan for customer ${customerId}, promotion ${promotionId}, host: ${host}`);
    
    try {
      const promotion = await this.prisma.promotion.findUnique({
        where: { promotionId },
      });

      if (!promotion) {
        throw new BadRequestException('Promotion not found');
      }

      const expectedDomain = promotion.domain;
      if (!host.includes(expectedDomain)) {
        throw new BadRequestException('Invalid domain for this promotion');
      }

      const canReceiveCashback = await this.fnsCashbackService.checkCashbackLimitsForPromotion(
        customerId, 
        qrData, 
        promotionId
      );
      
      if (!canReceiveCashback) {
        return {
          requestId: null,
          status: 'rejected',
          message: 'Cashback already received for this receipt in this network',
        };
      }

      const dailyLimit = await this.checkDailyLimit(promotionId);
      if (!dailyLimit.allowed) {
        return {
          requestId: null,
          status: 'rejected',
          message: 'Daily request limit exceeded for this network',
        };
      }

      const requestId = await this.fnsQueueService.addToQueueWithPromotion(
        qrData, 
        customerId, 
        promotionId
      );
      
      return {
        requestId,
        status: 'pending',
        message: 'Receipt verification started',
        network: promotion.name,
      };
    } catch (error) {
      this.logger.error('Error processing QR scan:', error);
      throw error;
    }
  }

  async verifyReceipt(qrData: VerifyReceiptDto, customerId?: number) {
    this.logger.log(`Starting receipt verification for QR data: ${JSON.stringify(qrData)}`);
    
    try {
      if (customerId) {
        const canReceiveCashback = await this.fnsCashbackService.checkCashbackLimits(customerId, qrData);
        if (!canReceiveCashback) {
          return {
            requestId: null,
            status: 'rejected',
            message: 'Cashback already received for this receipt',
          };
        }
      }

      const requestId = await this.fnsQueueService.addToQueue(qrData, customerId);
      
      return {
        requestId,
        status: 'pending',
        message: 'Receipt verification started',
      };
    } catch (error) {
      this.logger.error('Error starting receipt verification:', error);
      throw error;
    }
  }

  async getRequestStatus(requestId: string): Promise<ReceiptStatusDto> {
    const request = await this.prisma.fnsRequest.findUnique({
      where: { id: requestId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    return {
      requestId,
      status: request.status,
      cashbackAmount: request.cashbackAmount,
      cashbackAwarded: request.cashbackAwarded,
      isValid: request.isValid,
      isReturn: request.isReturn,
      isFake: request.isFake,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      customer: request.customer,
    };
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processPendingRequests() {
    this.logger.debug('Processing pending FNS requests');
    
    try {
      const pendingRequests = await this.fnsQueueService.getPendingRequests();
      
      for (const request of pendingRequests) {
        await this.processRequest(request);
      }
    } catch (error) {
      this.logger.error('Error processing pending requests:', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshTokens() {
    this.logger.debug('Refreshing FNS tokens');
    
    try {
      await this.fnsAuthService.refreshToken();
    } catch (error) {
      this.logger.error('Error refreshing FNS tokens:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldRequests() {
    this.logger.debug('Cleaning up old FNS requests');
    
    try {
      await this.fnsQueueService.cleanupOldRequests();
    } catch (error) {
      this.logger.error('Error cleaning up old requests:', error);
    }
  }

  private async processRequest(request: any) {
    try {
      await this.fnsQueueService.incrementAttempts(request.id);
      await this.fnsQueueService.markRequestAsProcessing(request.id);
      
      const token = await this.fnsAuthService.getValidToken();
      
      const messageId = await this.fnsCheckService.sendCheckRequest(request.qrData, token);
      
      await this.prisma.fnsRequest.update({
        where: { id: request.id },
        data: { 
          messageId,
          lastAttemptAt: new Date(),
        },
      });
      
      const result = await this.fnsCheckService.waitForResult(messageId, token);
      
      await this.handleCheckResult(request.id, result, request.customerId);
      
    } catch (error) {
      this.logger.error(`Error processing request ${request.id}:`, error);
      
      if (error.message.includes('Rate limiting')) {
        this.logger.warn(`Rate limiting for request ${request.id}, will retry later`);
        await this.fnsQueueService.updateRequestStatus(request.id, 'pending');
        return;
      } else if (error.message.includes('Message not found')) {
        await this.fnsQueueService.markRequestAsFailed(request.id, 'Message not found');
      } else if (error.message.includes('Authentication')) {
        await this.fnsQueueService.markRequestAsFailed(request.id, 'Authentication failed');
      } else {
        await this.fnsQueueService.markRequestAsFailed(request.id, error.message);
      }
    }
  }

  private async handleCheckResult(requestId: string, result: any, customerId?: number) {
    const status = result.status;
    
    let fnsRequest;
    try {
      fnsRequest = await this.prisma.fnsRequest.findUnique({
        where: { id: requestId },
        select: { promotionId: true },
      });
    } catch (error) {
      if (error.message.includes('promotionId')) {
        fnsRequest = null;
      } else {
        throw error;
      }
    }
    
    if (status === 'success') {
      const cashbackAmount = await this.fnsCashbackService.calculateCashback(
        result.receiptData, 
        customerId, 
        fnsRequest?.promotionId
      );
      
      if (customerId && cashbackAmount > 0) {
        await this.fnsCashbackService.awardCashbackToCustomer(customerId, cashbackAmount);
        
        if (fnsRequest?.promotionId) {
          await this.createReceiptRecord(result.receiptData, customerId, fnsRequest.promotionId, cashbackAmount);
        }
      }
      
      await this.fnsQueueService.updateRequestStatus(requestId, 'success', {
        cashbackAmount,
        cashbackAwarded: cashbackAmount > 0,
        fnsResponse: result,
      });
    } else if (status === 'rejected') {
      await this.fnsQueueService.updateRequestStatus(requestId, 'rejected', {
        isReturn: result.isReturn,
        isFake: result.isFake,
        fnsResponse: result,
      });
    } else if (status === 'failed') {
      await this.fnsQueueService.updateRequestStatus(requestId, 'failed', {
        isReturn: false,
        isFake: true,
        fnsResponse: result,
      });
    } else {
      await this.fnsQueueService.updateRequestStatus(requestId, status, {
        fnsResponse: result,
      });
    }
  }

  async getQueueStats() {
    return await this.fnsQueueService.getQueueStats();
  }

  async getDailyRequestCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return await this.prisma.fnsRequest.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
  }

  async getCustomerCashbackHistory(customerId: number) {
    return await this.prisma.fnsRequest.findMany({
      where: {
        customerId,
        cashbackAwarded: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        cashbackAmount: true,
        createdAt: true,
        qrData: true,
      },
    });
  }

  private async checkDailyLimit(promotionId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let currentCount = 0;
    try {
      currentCount = await this.prisma.fnsRequest.count({
        where: {
          promotionId,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });
    } catch (error) {
      if (error.message.includes('promotionId')) {
        currentCount = await this.prisma.fnsRequest.count({
          where: {
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        });
      } else {
        throw error;
      }
    }
    
    const limit = 1000; 
    
    return {
      allowed: currentCount < limit,
      current: currentCount,
      limit,
    };
  }

  private async createReceiptRecord(receiptData: any, customerId: number, promotionId: string, cashback: number): Promise<void> {
    try {
      const receipt = await this.prisma.receipt.create({
        data: {
          date: new Date(receiptData.dateTime || receiptData.date),
          number: parseInt(receiptData.fiscalDocumentNumber || receiptData.fd),
          price: parseInt(receiptData.totalSum || receiptData.sum),
          cashback,
          status: 'success',
          address: receiptData.retailPlace || 'Неизвестно',
          promotionId,
          customerId,
        },
      });

      this.logger.log(`Created receipt record with ID: ${receipt.id}`);
    } catch (error) {
      this.logger.error('Error creating receipt record:', error);
    }
  }

  async testFnsConnection(): Promise<any> {
    this.logger.log('Testing FNS connection...');
    
    const result = {
      status: 'unknown',
      message: '',
      ip: process.env.PROD_SERVER_IP || 'not configured',
      timestamp: new Date().toISOString(),
      authTest: {},
      serviceTest: {}
    };

    try {
      const response = await require('axios').get('http://ipecho.net/plain', { timeout: 5000 });
      result.ip = response.data.trim();
    } catch (error) {
      this.logger.warn('Could not determine server IP:', error.message);
    }

    try {
      this.logger.log('Testing FNS authentication...');
      const token = await this.fnsAuthService.refreshToken();
      result.authTest = {
        status: 'success',
        message: 'Authentication successful',
        tokenReceived: !!token,
        tokenLength: token?.length || 0
      };
      result.status = 'partial_success';
      result.message = 'Authentication successful, but service test needed';
    } catch (error) {
      result.authTest = {
        status: 'failed',
        message: error.message,
        error: error.toString()
      };
      result.status = 'failed';
      result.message = 'Authentication failed - ' + error.message;
      return result;
    }

    try {
      this.logger.log('Testing FNS service endpoints...');
      const testQrData = {
        fn: '9287440300090728',
        fd: '77133',
        fp: '1482926127',
        sum: 240000,
        date: '2019-04-09T16:38:00',
        typeOperation: 1
      };

      const token = await this.fnsAuthService.getValidToken();
      const messageId = await this.fnsCheckService.sendCheckRequest(testQrData, token);
      
      result.serviceTest = {
        status: 'success',
        message: 'Service endpoint accessible',
        messageId: messageId,
        testData: testQrData
      };
      result.status = 'success';
      result.message = 'All tests passed successfully';
    } catch (error) {
      result.serviceTest = {
        status: 'failed',
        message: error.message,
        error: error.toString()
      };
      
      if (error.message.includes('IP address not whitelisted')) {
        result.status = 'ip_blocked';
        result.message = 'IP address not whitelisted in FNS. Contact support to add your IP.';
      } else {
        result.status = 'service_error';
        result.message = 'Service test failed - ' + error.message;
      }
    }

    return result;
  }

  async testQrProcessing(qrData: any): Promise<any> {
    this.logger.log(`Testing QR processing with data: ${JSON.stringify(qrData)}`);
    
    const result: any = {
      status: 'unknown',
      message: '',
      timestamp: new Date().toISOString(),
      qrData,
      steps: {},
      finalResult: null,
      error: null
    };

    try {
      result.steps['step1_auth'] = { status: 'running', message: 'Getting auth token...' };
      const token = await this.fnsAuthService.getValidToken();
      result.steps['step1_auth'] = { 
        status: 'success', 
        message: 'Token obtained',
        tokenLength: token.length 
      };

      result.steps['step2_send'] = { status: 'running', message: 'Sending request to FNS...' };
      const messageId = await this.fnsCheckService.sendCheckRequest(qrData, token);
      result.steps['step2_send'] = { 
        status: 'success', 
        message: 'Request sent successfully',
        messageId 
      };

      result.steps['step3_result'] = { status: 'running', message: 'Waiting for result...' };
      const checkResult = await this.fnsCheckService.waitForResult(messageId, token, 5);
      result.steps['step3_result'] = { 
        status: 'success', 
        message: 'Result received',
        result: checkResult 
      };

      result.status = 'success';
      result.message = 'QR processing completed successfully';
      result.finalResult = checkResult;

    } catch (error) {
      const currentStep = Object.keys(result.steps).find(key => 
        result.steps[key].status === 'running'
      );
      
      if (currentStep) {
        result.steps[currentStep] = {
          status: 'failed',
          message: error.message,
          error: error.toString()
        };
      }

      result.status = 'failed';
      result.message = error.message;
      result.error = error.toString();
    }

    return result;
  }
} 