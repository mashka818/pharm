import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  UseGuards, 
  Request,
  Headers,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { FnsService } from './fns.service';
import { ScanQrCodeDto } from './dto/scan-qr-code.dto';
import { VerifyReceiptDto } from './dto/verify-receipt.dto';
import { ReceiptStatusDto } from './dto/receipt-status.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@ApiTags('FNS Integration')
@Controller('fns')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class FnsController {
  private readonly logger = new Logger(FnsController.name);

  constructor(private readonly fnsService: FnsService) {}

  @Post('scan-qr')
  @ApiOperation({ 
    summary: 'Сканировать QR код чека для конкретной сети аптек',
    description: 'Принимает QR код чека и токен авторизации. Из токена извлекается ID пользователя и ID сети для начисления кешбека в рамках конкретной промоакции.'
  })
  @ApiHeader({
    name: 'host',
    description: 'Поддомен сети аптек (например: р-фарм.чекпоинт.рф)',
    required: true,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'QR код успешно отправлен на обработку',
    schema: {
      type: 'object',
      properties: {
        requestId: { type: 'string', nullable: true },
        status: { type: 'string', enum: ['pending', 'rejected'] },
        message: { type: 'string' },
        network: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Неверные данные QR кода или превышен лимит'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Неавторизованный доступ'
  })
  async scanQrCode(
    @Body() qrData: ScanQrCodeDto,
    @Request() req: any,
    @Headers('host') host: string,
  ) {
    this.logger.log(`QR scan request from host: ${host}, user: ${req.user?.id}`);
    
    if (!host) {
      throw new BadRequestException('Host header is required');
    }

    if (!req.user?.id) {
      throw new BadRequestException('User not authenticated');
    }

    if (!req.user?.promotionId) {
      throw new BadRequestException('Promotion ID not found in token');
    }

    return this.fnsService.processScanQrCode(
      qrData, 
      req.user.id, 
      req.user.promotionId, 
      host
    );
  }

  @Post('verify')
  @ApiOperation({ 
    summary: 'Проверить чек по QR коду (legacy метод)',
    description: 'Проверяет валидность чека и рассчитывает кешбек для общей системы (без привязки к конкретной сети)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Чек успешно отправлен на проверку',
    type: Object
  })
  async verifyReceipt(
    @Body() verifyReceiptDto: VerifyReceiptDto,
    @Request() req: any,
  ) {
    const customerId = req.user?.id;
    return this.fnsService.verifyReceipt(verifyReceiptDto, customerId);
  }

  @Get('status/:requestId')
  @ApiOperation({ 
    summary: 'Получить статус обработки запроса',
    description: 'Возвращает текущий статус обработки запроса на проверку чека в ФНС'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Статус запроса',
    type: ReceiptStatusDto
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Запрос не найден'
  })
  async getRequestStatus(@Param('requestId') requestId: string) {
    return this.fnsService.getRequestStatus(requestId);
  }

  @Get('queue/stats')
  @ApiOperation({ 
    summary: 'Получить статистику очереди обработки',
    description: 'Возвращает статистику по очереди запросов к ФНС'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Статистика очереди',
    schema: {
      type: 'object',
      properties: {
        pending: { type: 'number' },
        processing: { type: 'number' },
        success: { type: 'number' },
        failed: { type: 'number' },
        total: { type: 'number' }
      }
    }
  })
  async getQueueStats() {
    return this.fnsService.getQueueStats();
  }

  @Get('daily-count')
  @ApiOperation({ 
    summary: 'Получить количество запросов за сегодня',
    description: 'Возвращает количество запросов к ФНС API за текущий день'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Количество запросов за день',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number' },
        limit: { type: 'number' }
      }
    }
  })
  async getDailyRequestCount() {
    const count = await this.fnsService.getDailyRequestCount();
    return {
      count,
      limit: 1000 
    };
  }

  @Post('debug-receipt')
  @ApiOperation({ 
    summary: 'Отладка конкретного чека (только для разработки)',
    description: 'Специальный endpoint для отладки проблем с проверкой чеков через ФНС. Включает детальное логирование всех этапов.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Результат отладки чека',
    schema: {
      type: 'object',
      properties: {
        originalData: { type: 'object' },
        formattedData: { type: 'object' },
        fnsResponse: { type: 'object' },
        finalResult: { type: 'object' },
        debugInfo: { type: 'object' }
      }
    }
  })
  async debugReceipt(
    @Body() qrData: ScanQrCodeDto,
  ) {
    this.logger.log(`🔍 DEBUG: Starting receipt debug for data: ${JSON.stringify(qrData)}`);
    
    try {
      // Не требуем авторизацию для отладки
      const debugInfo = {
        timestamp: new Date().toISOString(),
        originalData: qrData,
        formattedData: null,
        fnsResponse: null,
        finalResult: null,
        errors: [],
        warnings: []
      };

      // Проверяем данные
      if (qrData.sum === 120) {
        debugInfo.warnings.push('Sum is 120 - this might be 1.20 rubles. FNS expects sum in kopecks (120 kopecks = 1.20 rubles)');
      }

      const qrDate = new Date(qrData.date);
      const now = new Date();
      if (qrDate > now) {
        debugInfo.warnings.push(`Receipt date ${qrData.date} is in the future. This will likely cause FNS to reject the receipt.`);
      }

      if (qrDate.getFullYear() === 2025) {
        debugInfo.errors.push('Receipt date is in 2025 which is definitely incorrect. Please check the date.');
      }

      // Для отладки используем тестовые данные вместо реального ФНС
      debugInfo.finalResult = {
        status: 'debug',
        message: 'This is a debug response. Check warnings and errors above.',
        originalSum: qrData.sum,
        suggestedSum: qrData.sum === 120 ? 12000 : qrData.sum, // Если 120, предлагаем 12000 копеек (120 рублей)
        dateAnalysis: {
          original: qrData.date,
          parsed: qrDate.toISOString(),
          isInFuture: qrDate > now,
          year: qrDate.getFullYear(),
          isReasonableYear: qrDate.getFullYear() >= 2020 && qrDate.getFullYear() <= now.getFullYear()
        }
      };

      this.logger.log(`🔍 DEBUG: Complete analysis: ${JSON.stringify(debugInfo)}`);
      return debugInfo;

    } catch (error) {
      this.logger.error('🔍 DEBUG: Error during debug:', error);
      return {
        error: error.message,
        originalData: qrData,
        timestamp: new Date().toISOString()
      };
    }
  }


} 